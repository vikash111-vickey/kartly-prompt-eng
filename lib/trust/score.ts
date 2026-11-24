import { Product, ScoreBreakdown, TrustConfidence, TrustLabel } from "@/types/product";
import { getPlatformReliability } from "./platforms";

/**
 * Calculates the median of an array of numbers.
 */
function calculateMedian(numbers: number[]): number | null {
  if (numbers.length === 0) return null;
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 !== 0) {
    return sorted[mid];
  }
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Scores a list of products using a multi-factor trust evaluation engine.
 * Server-computed trust scores, labels, and explanations.
 */
export function scoreProducts(products: Product[]): Product[] {
  if (!products || products.length === 0) return [];

  // Compute median price across all products with valid numeric price
  const validPrices = products
    .map((p) => p.price)
    .filter((price): price is number => typeof price === "number" && !isNaN(price) && price > 0);
  const medianPrice = calculateMedian(validPrices);

  return products.map((product) => {
    const breakdown: ScoreBreakdown = {};
    const redFlags: string[] = [];
    const positives: string[] = [];

    // 1. REVIEWS (30%)
    // Bayesian-style rating: (rating * reviewCount + 3.8 * 50) / (reviewCount + 50), scaled to 0-100
    const hasRating = typeof product.rating === "number" && !isNaN(product.rating);
    const reviewCount = typeof product.reviewCount === "number" && product.reviewCount > 0
      ? product.reviewCount
      : 0;

    if (hasRating) {
      const bayesian = (product.rating! * reviewCount + 3.8 * 50) / (reviewCount + 50);
      let reviewsScore = Math.min(100, Math.max(0, (bayesian / 5.0) * 100));

      // Products with < 10 reviews: cap review factor at 40
      if (reviewCount < 10) {
        reviewsScore = Math.min(reviewsScore, 40);
      }
      breakdown.reviews = Math.round(reviewsScore);

      if (product.rating! >= 4.2 && reviewCount >= 20) {
        positives.push(`Strong ratings (${product.rating}★ across ${reviewCount.toLocaleString()} reviews)`);
      } else if (product.rating! < 3.0 && reviewCount >= 5) {
        redFlags.push("Low customer rating");
      } else if (product.rating! < 3.5 && reviewCount >= 10) {
        redFlags.push(`Below-average rating (${product.rating}★)`);
      }
    }

    // 2. PRICE FAIRNESS (25%)
    let priceRatio: number | null = null;
    if (typeof product.price === "number" && medianPrice !== null && medianPrice > 0) {
      priceRatio = product.price / medianPrice;
      let priceScore = 70;

      if (priceRatio < 0.55) {
        // More than 45% below median -> suspicious
        priceScore = 20;
        redFlags.push("Price far below the usual range");
      } else if (priceRatio < 0.75) {
        // 25% to 45% below median
        priceScore = 60 + ((priceRatio - 0.55) / 0.20) * 30;
        positives.push("Significantly discounted vs. market median");
      } else if (priceRatio <= 1.0) {
        // Up to 25% below median -> rises from 70 to 90
        priceScore = 70 + ((1.0 - priceRatio) / 0.25) * 20;
        positives.push("Competitively priced near market median");
      } else if (priceRatio <= 1.25) {
        // Up to 25% above median
        priceScore = 70 - ((priceRatio - 1.0) / 0.25) * 20;
      } else {
        // More than 25% above median -> falls toward 30
        priceScore = Math.max(25, 50 - ((priceRatio - 1.25) / 0.50) * 20);
      }

      breakdown.price = Math.round(priceScore);
    }

    // 3. SELLER AND PLATFORM (20%)
    const platformData = getPlatformReliability(product.platform);
    const platformScore = platformData.score;

    if (platformScore >= 85) {
      positives.push(`Reputable platform (${product.platform})`);
    } else if (platformScore < 60) {
      redFlags.push(`Platform has lower reliability score (${product.platform})`);
    }

    let sellerScoreTotal: number;
    if (product.sellerVerified === true) {
      sellerScoreTotal = (platformScore + 90) / 2;
      positives.push("Verified seller");
    } else if (product.sellerVerified === false) {
      sellerScoreTotal = (platformScore + 40) / 2;
      redFlags.push("Unverified seller");
    } else {
      // Unknown seller verification -> omit seller portion, use platform score
      sellerScoreTotal = platformScore;
    }
    breakdown.seller = Math.round(sellerScoreTotal);

    // 4. DELIVERY (15%)
    const hasEta = typeof product.deliveryEta === "string" && product.deliveryEta.trim().length > 0;
    const hasFee = typeof product.deliveryFee === "number";

    if (hasEta || hasFee) {
      let deliveryScore = 70;
      const etaText = (product.deliveryEta || "").toLowerCase();

      // Check for free delivery
      if (product.deliveryFee === 0 || etaText.includes("free")) {
        deliveryScore += 15;
        positives.push("Free delivery");
      } else if (typeof product.deliveryFee === "number" && product.deliveryFee > 0) {
        deliveryScore -= Math.min(25, product.deliveryFee > 100 ? 25 : 15);
      }

      // Check for fast delivery
      if (
        etaText.includes("10 min") ||
        etaText.includes("15 min") ||
        etaText.includes("today") ||
        etaText.includes("tomorrow") ||
        etaText.includes("same day") ||
        etaText.includes("express")
      ) {
        deliveryScore += 15;
        positives.push("Fast or same-day delivery");
      }

      breakdown.delivery = Math.min(100, Math.max(20, Math.round(deliveryScore)));
    }

    // 5. FRAUD SAFETY (10%)
    let fraudScore = 100;

    // Penalty for far-below price (-40)
    if (priceRatio !== null && priceRatio < 0.55) {
      fraudScore -= 40;
    }

    // Penalty for few reviews with near-perfect rating (-30)
    if (
      typeof product.rating === "number" &&
      product.rating >= 4.8 &&
      (product.reviewCount ?? 0) > 0 &&
      (product.reviewCount ?? 0) <= 10
    ) {
      fraudScore -= 30;
      redFlags.push("Suspiciously high rating with very few reviews");
    }

    // Penalty for unverified seller (-15)
    if (product.sellerVerified === false) {
      fraudScore -= 15;
    }

    // Penalty for no return policy with unknown/unverified seller (-10)
    const returnPolicyText = (product.returnPolicy || "").toLowerCase();
    const hasNoReturns =
      returnPolicyText.includes("no return") ||
      returnPolicyText.includes("non-returnable") ||
      returnPolicyText.includes("not returnable");
    if (hasNoReturns && product.sellerVerified !== true) {
      fraudScore -= 10;
      redFlags.push("Non-returnable item from unverified seller");
    }

    breakdown.fraud = Math.max(0, Math.min(100, fraudScore));
    if (fraudScore >= 95) {
      positives.push("Clean listing with no fraud flags");
    }

    // FINAL WEIGHTED TRUST SCORE (Renormalized over available factors)
    const factorWeights: Record<keyof ScoreBreakdown, number> = {
      reviews: 0.30,
      price: 0.25,
      seller: 0.20,
      delivery: 0.15,
      fraud: 0.10,
    };

    let totalWeight = 0;
    let weightedSum = 0;
    let factorCount = 0;

    for (const [key, weight] of Object.entries(factorWeights)) {
      const factorKey = key as keyof ScoreBreakdown;
      const score = breakdown[factorKey];
      if (typeof score === "number") {
        weightedSum += score * weight;
        totalWeight += weight;
        factorCount++;
      }
    }

    const rawTrustScore = totalWeight > 0 ? weightedSum / totalWeight : 50;
    const finalTrustScore = Math.max(0, Math.min(100, Math.round(rawTrustScore)));

    // CONFIDENCE (High: >= 4 factors, Medium: 3 factors, Low: <= 2 factors)
    let confidence: TrustConfidence;
    if (factorCount >= 4) {
      confidence = "high";
    } else if (factorCount === 3) {
      confidence = "medium";
    } else {
      confidence = "low";
    }

    // Rule: If reviewCount is missing or below 10:
    // confidence is forced to 'low', the label can be at best 'careful',
    // and add redFlag "Too few reviews to verify quality".
    const isSparseReviews = typeof product.reviewCount !== "number" || product.reviewCount < 10;
    if (isSparseReviews) {
      confidence = "low";
      redFlags.push("Too few reviews to verify quality");
      positives.push("Very few reviews, so this score is tentative");
    }

    // Deduplicate lists early so label calculation can check red flags
    const uniqueRedFlags = Array.from(new Set(redFlags));
    const uniquePositives = Array.from(new Set(positives));

    // TRUST LABEL
    // Label "great" requires: confidence "high" or "medium", score >= 75, no red flags.
    let trustLabel: TrustLabel;
    if (
      finalTrustScore >= 75 &&
      (confidence === "high" || confidence === "medium") &&
      uniqueRedFlags.length === 0
    ) {
      trustLabel = "great";
    } else if (finalTrustScore >= 65) {
      trustLabel = "good";
    } else if (finalTrustScore >= 45) {
      trustLabel = "careful";
    } else {
      trustLabel = "risky";
    }

    // Rule: Products with < 10 reviews: never label "great" (cap at "careful")
    if (isSparseReviews) {
      if (trustLabel === "great" || trustLabel === "good") {
        trustLabel = "careful";
      }
    }

    // Rule: Far-below-price products or items with red flags can never be "great"
    if (
      trustLabel === "great" &&
      (uniqueRedFlags.length > 0 || (priceRatio !== null && priceRatio < 0.55))
    ) {
      trustLabel = "good";
    }

    return {
      ...product,
      trustScore: finalTrustScore,
      trustLabel,
      confidence,
      scoreBreakdown: breakdown,
      redFlags: uniqueRedFlags,
      positives: uniquePositives,
    };
  });
}
