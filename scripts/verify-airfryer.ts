import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { searchProducts } from "../lib/search/index";
import { upgradeToDirectLink } from "../lib/search/providers/shopping-api";

async function verify() {
  console.log("Searching for 'air fryer under 5000' (maxPrice: 5000)...");
  const products = await searchProducts({
    query: "air fryer under 5000",
    maxPrice: 5000,
  });

  console.log(`\nFound ${products.length} products matching criteria.`);
  const top3 = products.slice(0, 3);

  // Upgrade top 3 to direct link just like chat route does
  const upgradedTop3 = await Promise.all(
    top3.map((p) => upgradeToDirectLink(p))
  );

  console.log("\n==========================================");
  console.log("TOP 3 PRODUCTS FOR 'air fryer under 5000'");
  console.log("==========================================");

  upgradedTop3.forEach((p, idx) => {
    console.log(`\n[#${idx + 1}] ${p.title}`);
    console.log(`     Platform:   ${p.platform} (${p.domain})`);
    console.log(`     Price:      ₹${p.price?.toLocaleString("en-IN")}`);
    console.log(`     Rating:     ${p.rating ? `${p.rating}★ (${p.reviewCount} reviews)` : "N/A"}`);
    console.log(`     Trust Score:${p.trustScore}/100 (${p.trustLabel?.toUpperCase()})`);
    console.log(`     Confidence: ${p.confidence}`);
    console.log(`     Breakdown:  ${JSON.stringify(p.scoreBreakdown)}`);
    console.log(`     Positives:  ${p.positives?.join(" | ") || "None"}`);
    console.log(`     Red Flags:  ${p.redFlags?.join(" | ") || "None"}`);
    console.log(`     Link (${p.linkType}): ${p.link}`);
  });
}

verify().catch((err) => {
  console.error("Verification failed:", err);
  process.exit(1);
});
