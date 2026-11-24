import { getTotalCost } from "../lib/cost";

let failed = false;

function testCase(
  name: string,
  input: Parameters<typeof getTotalCost>[0],
  expected: { total: number | null; note: string }
) {
  const result = getTotalCost(input);
  const matchTotal = result.total === expected.total;
  const matchNote = result.note === expected.note;

  if (matchTotal && matchNote) {
    console.log(`PASS: ${name} -> total: ${result.total}, note: "${result.note}"`);
  } else {
    console.error(`FAIL: ${name}`);
    console.error(`  Expected: total=${expected.total}, note="${expected.note}"`);
    console.error(`  Received: total=${result.total}, note="${result.note}"`);
    failed = true;
  }
}

console.log("=== Testing getTotalCost (lib/cost.ts) ===");

// Case 1: Both price and deliveryFee are known
testCase(
  "Case 1: Price and deliveryFee both known",
  { price: 2999, deliveryFee: 99 },
  { total: 3098, note: "Price + delivery" }
);

// Case 2: Price is known and delivery text says free delivery
testCase(
  "Case 2: Price known and delivery text says free delivery",
  { price: 1999, deliveryEta: "Get it tomorrow, Free delivery" },
  { total: 1999, note: "Free delivery" }
);

// Also test deliveryFee === 0 variant of free delivery
testCase(
  "Case 2b: Price known and deliveryFee is 0",
  { price: 1999, deliveryFee: 0 },
  { total: 1999, note: "Free delivery" }
);

// Case 3: Delivery cost is unknown
testCase(
  "Case 3: Delivery cost unknown (not free, no fee)",
  { price: 4499, deliveryEta: "Standard delivery in 3-5 days" },
  { total: null, note: "Delivery fee not confirmed" }
);

// Case 3b: Price known but absolutely no delivery info provided
testCase(
  "Case 3b: No delivery info provided at all",
  { price: 3499 },
  { total: null, note: "Delivery fee not confirmed" }
);

if (failed) {
  console.error("\nTEST SUITE FAILED");
  process.exit(1);
} else {
  console.log("\nALL 5 TESTS PASSED");
  process.exit(0);
}
