import { scoreProducts } from "../lib/trust/score";
import type { Product } from "../types/product";

function makeBaseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "test-prod-" + Math.random().toString(36).slice(2, 7),
    title: "Test Product",
    platform: "Amazon",
    domain: "amazon.in",
    link: "https://www.amazon.in/dp/B0001",
    linkType: "direct",
    price: 2000,
    rating: 4.3,
    reviewCount: 150,
    seller: "Appario Retail",
    sellerVerified: true,
    deliveryEta: "Tomorrow, Free delivery",
    deliveryFee: 0,
    returnPolicy: "10-day replacement",
    ...overrides,
  };
}

let passedCount = 0;
let failedCount = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${message}`);
  } else {
    console.error(`  ✗ FAIL: ${message}`);
    failedCount++;
  }
}

console.log("==========================================");
console.log("KARTLY TRUST SCORE ENGINE TEST SUITE");
console.log("==========================================\n");

// ----------------------------------------------------
// TEST 1: Normal Good Product
// ----------------------------------------------------
console.log("Test 1: Normal Good Product");
{
  const dataset: Product[] = [
    makeBaseProduct({ id: "peer-1", price: 1950 }),
    makeBaseProduct({ id: "peer-2", price: 2050 }),
    makeBaseProduct({
      id: "good-prod",
      title: "boAt Airdopes 141 True Wireless Earbuds",
      platform: "Amazon",
      price: 1999,
      rating: 4.4,
      reviewCount: 450,
      sellerVerified: true,
      deliveryEta: "Tomorrow, Free delivery",
      deliveryFee: 0,
    }),
  ];

  const scored = scoreProducts(dataset);
  const target = scored.find((p) => p.id === "good-prod")!;

  console.log(`  Score: ${target.trustScore}/100, Label: ${target.trustLabel}, Confidence: ${target.confidence}`);
  console.log(`  Breakdown:`, target.scoreBreakdown);
  console.log(`  Positives:`, target.positives);

  assert(typeof target.trustScore === "number" && target.trustScore >= 75, `Trust score >= 75 (got ${target.trustScore})`);
  assert(target.trustLabel === "great" || target.trustLabel === "good", `Trust label is "great" or "good" (got ${target.trustLabel})`);
  assert(target.confidence === "high", `Confidence is "high" (got ${target.confidence})`);
  assert((target.redFlags?.length ?? 0) === 0, `No red flags flagged (got ${target.redFlags?.length})`);
  assert((target.positives?.length ?? 0) > 0, `Has positive highlights (got ${target.positives?.length})`);
  if (typeof target.trustScore === "number" && target.trustScore >= 75 && (target.trustLabel === "great" || target.trustLabel === "good")) {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// TEST 2: 60% Below Median with 3 reviews @ 5.0
// ----------------------------------------------------
console.log("Test 2: 60% Below Median with 3 reviews @ 5.0");
{
  // Median price: 5000 (from peers)
  // Suspicious item: price = 2000 (which is 60% below median, ratio = 0.40)
  const dataset: Product[] = [
    makeBaseProduct({ id: "peer-1", price: 5000 }),
    makeBaseProduct({ id: "peer-2", price: 5200 }),
    makeBaseProduct({ id: "peer-3", price: 4800 }),
    makeBaseProduct({
      id: "suspicious-prod",
      title: "Ultra Luxury Smartwatch Too Cheap",
      platform: "Snapdeal",
      price: 2000, // 60% below median of 5000
      rating: 5.0,
      reviewCount: 3,
      sellerVerified: false,
      deliveryEta: "Check on store",
      returnPolicy: "No returns allowed",
    }),
  ];

  const scored = scoreProducts(dataset);
  const target = scored.find((p) => p.id === "suspicious-prod")!;

  console.log(`  Score: ${target.trustScore}/100, Label: ${target.trustLabel}, Confidence: ${target.confidence}`);
  console.log(`  Breakdown:`, target.scoreBreakdown);
  console.log(`  Red Flags:`, target.redFlags);

  assert(target.trustLabel === "careful" || target.trustLabel === "risky", `Label must be "careful" or "risky" (got ${target.trustLabel})`);
  assert(target.trustLabel !== "great", `Far-below-price product can NEVER be "great" (got ${target.trustLabel})`);
  assert(target.redFlags?.includes("Price far below the usual range") === true, `Includes red flag: "Price far below the usual range"`);
  assert(target.redFlags?.some((rf) => rf.toLowerCase().includes("suspiciously high rating") || rf.toLowerCase().includes("few reviews")) === true, `Flags suspicious 5.0 rating with few reviews`);

  if ((target.trustLabel === "careful" || target.trustLabel === "risky") && target.redFlags?.includes("Price far below the usual range")) {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// TEST 3: Product with No Rating (Low Confidence Score)
// ----------------------------------------------------
console.log("Test 3: Product with No Rating (Low Confidence Score)");
{
  const dataset: Product[] = [
    makeBaseProduct({ id: "peer-1", price: 1000 }),
    makeBaseProduct({ id: "peer-2", price: 1200 }),
    {
      id: "no-rating-prod",
      title: "Fresh Arrival Widget",
      platform: "UnknownStore",
      domain: "",
      link: "https://unknown.com/widget",
      linkType: "platform_search",
      // rating and reviewCount are undefined
      rating: undefined,
      reviewCount: undefined,
      // delivery fee and eta are undefined
      deliveryEta: undefined,
      deliveryFee: undefined,
      sellerVerified: undefined,
    },
  ];

  const scored = scoreProducts(dataset);
  const target = scored.find((p) => p.id === "no-rating-prod")!;

  console.log(`  Score: ${target.trustScore}/100, Label: ${target.trustLabel}, Confidence: ${target.confidence}`);
  console.log(`  Breakdown:`, target.scoreBreakdown);

  assert(target.scoreBreakdown?.reviews === undefined, "Reviews factor is omitted from breakdown");
  assert(typeof target.trustScore === "number" && !isNaN(target.trustScore), `Trust score is valid numeric (got ${target.trustScore})`);
  assert(target.confidence === "low", `Confidence is "low" due to sparse factors (got ${target.confidence})`);

  if (target.scoreBreakdown?.reviews === undefined && target.confidence === "low" && !isNaN(target.trustScore!)) {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// TEST 4: Identical Price with Differing Review Counts
// ----------------------------------------------------
console.log("Test 4: Identical Price with Differing Review Counts");
{
  // Both have identical price 2500, same platform, same 4.8 rating
  // Product A has 1,000 reviews; Product B has 5 reviews
  const dataset: Product[] = [
    makeBaseProduct({
      id: "prod-high-reviews",
      title: "Popular Brand Wireless Earbuds",
      platform: "Amazon",
      price: 2500,
      rating: 4.8,
      reviewCount: 1000,
      sellerVerified: true,
      deliveryEta: "Tomorrow",
      deliveryFee: 0,
    }),
    makeBaseProduct({
      id: "prod-few-reviews",
      title: "New Seller Wireless Earbuds",
      platform: "Amazon",
      price: 2500,
      rating: 4.8,
      reviewCount: 5,
      sellerVerified: true,
      deliveryEta: "Tomorrow",
      deliveryFee: 0,
    }),
  ];

  const scored = scoreProducts(dataset);
  const prodA = scored.find((p) => p.id === "prod-high-reviews")!;
  const prodB = scored.find((p) => p.id === "prod-few-reviews")!;

  console.log(`  Product A (1000 reviews @ 4.8★): Trust Score = ${prodA.trustScore}, Reviews Score = ${prodA.scoreBreakdown?.reviews}`);
  console.log(`  Product B (5 reviews @ 4.8★):    Trust Score = ${prodB.trustScore}, Reviews Score = ${prodB.scoreBreakdown?.reviews}`);

  assert(prodA.scoreBreakdown!.reviews! > prodB.scoreBreakdown!.reviews!, `Product A reviews score (${prodA.scoreBreakdown?.reviews}) > Product B reviews score (${prodB.scoreBreakdown?.reviews})`);
  assert(prodA.trustScore! > prodB.trustScore!, `Product A trustScore (${prodA.trustScore}) > Product B trustScore (${prodB.trustScore})`);

  if (prodA.trustScore! > prodB.trustScore!) {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// TEST 5: 2.5 stars with 1 review -> careful at best, low confidence
// ----------------------------------------------------
console.log("Test 5: 2.5 stars with 1 review -> careful at best, low confidence");
{
  const dataset: Product[] = [
    makeBaseProduct({ id: "peer-1", price: 2000 }),
    makeBaseProduct({ id: "peer-2", price: 2100 }),
    makeBaseProduct({
      id: "low-review-low-rating",
      title: "Poorly Reviewed New Item",
      price: 2050,
      rating: 2.5,
      reviewCount: 1,
      sellerVerified: true,
    }),
  ];

  const scored = scoreProducts(dataset);
  const target = scored.find((p) => p.id === "low-review-low-rating")!;

  console.log(`  Score: ${target.trustScore}/100, Label: ${target.trustLabel}, Confidence: ${target.confidence}`);
  console.log(`  Red Flags:`, target.redFlags);

  assert(target.confidence === "low", `Confidence must be "low" (got ${target.confidence})`);
  assert(target.trustLabel === "careful" || target.trustLabel === "risky", `Label must be "careful" or "risky" (got ${target.trustLabel})`);
  assert(target.trustLabel !== "great" && target.trustLabel !== "good", `Label must not be "great" or "good" (got ${target.trustLabel})`);
  assert(target.redFlags?.includes("Too few reviews to verify quality") === true, `Has red flag "Too few reviews to verify quality"`);

  if (target.confidence === "low" && (target.trustLabel === "careful" || target.trustLabel === "risky")) {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// TEST 6: 4.6 stars with 4000 reviews -> great
// ----------------------------------------------------
console.log("Test 6: 4.6 stars with 4000 reviews -> great");
{
  const dataset: Product[] = [
    makeBaseProduct({ id: "peer-1", price: 1999 }),
    makeBaseProduct({ id: "peer-2", price: 2050 }),
    makeBaseProduct({
      id: "high-volume-top-seller",
      title: "Well established top seller",
      platform: "Amazon",
      price: 2000,
      rating: 4.6,
      reviewCount: 4000,
      sellerVerified: true,
      deliveryEta: "Tomorrow, Free delivery",
      deliveryFee: 0,
    }),
  ];

  const scored = scoreProducts(dataset);
  const target = scored.find((p) => p.id === "high-volume-top-seller")!;

  console.log(`  Score: ${target.trustScore}/100, Label: ${target.trustLabel}, Confidence: ${target.confidence}`);
  console.log(`  Breakdown:`, target.scoreBreakdown);

  assert(target.trustScore! >= 75, `Trust score >= 75 (got ${target.trustScore})`);
  assert(target.trustLabel === "great", `Trust label must be "great" (got ${target.trustLabel})`);
  assert(target.confidence === "high", `Confidence must be "high" (got ${target.confidence})`);
  assert((target.redFlags?.length ?? 0) === 0, `No red flags flagged (got ${target.redFlags?.length})`);

  if (target.trustLabel === "great" && target.confidence === "high") {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// TEST 7: Good product with no review data -> must not be great
// ----------------------------------------------------
console.log("Test 7: Good product with no review data -> must not be great");
{
  const dataset: Product[] = [
    makeBaseProduct({ id: "peer-1", price: 2500 }),
    makeBaseProduct({ id: "peer-2", price: 2600 }),
    makeBaseProduct({
      id: "brand-new-no-reviews",
      title: "Brand New Platform Listing",
      platform: "Amazon",
      price: 2550,
      rating: undefined,
      reviewCount: undefined,
      sellerVerified: true,
      deliveryEta: "Tomorrow, Free delivery",
      deliveryFee: 0,
    }),
  ];

  const scored = scoreProducts(dataset);
  const target = scored.find((p) => p.id === "brand-new-no-reviews")!;

  console.log(`  Score: ${target.trustScore}/100, Label: ${target.trustLabel}, Confidence: ${target.confidence}`);

  assert(target.trustLabel !== "great", `Trust label must NOT be "great" without reviews (got ${target.trustLabel})`);
  assert(target.confidence === "low", `Confidence must be "low" without review data (got ${target.confidence})`);
  assert(target.trustLabel === "careful" || target.trustLabel === "risky", `Label must be capped at "careful" (got ${target.trustLabel})`);

  if (target.trustLabel !== "great" && target.confidence === "low") {
    passedCount++;
  }
}
console.log("");

// ----------------------------------------------------
// SUMMARY
// ----------------------------------------------------
console.log("==========================================");
console.log(`SUMMARY: ${passedCount} of 7 test groups passed (${failedCount} failed assertions)`);
console.log("==========================================");

if (failedCount > 0 || passedCount < 7) {
  console.error("TEST FAILED: Not all trust engine test cases passed.");
  process.exit(1);
} else {
  console.log("ALL TRUST ENGINE TESTS PASSED SUCCESSFULLY.");
  process.exit(0);
}
