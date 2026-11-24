import fs from "node:fs";
import { searchProducts } from "../lib/search/index";
import { upgradeToDirectLink } from "../lib/search/providers/shopping-api";

// Load environment variables from .env.local
if (fs.existsSync(".env.local") && typeof process.loadEnvFile === "function") {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Ignore if already loaded
  }
}

const QUERIES = [
  "boat earbuds under 2000",
  "samsung galaxy under 15000",
  "milk and bread",
  "laptop for students",
];

async function main() {
  console.log("======================================================");
  console.log("KARTLY SEARCH PROVIDER TEST SUITE (WITH DIRECT LINK UPGRADE)");
  console.log(`Has Live Search API Key: ${Boolean(process.env.SERPAPI_KEY || process.env.SERPER_KEY)}`);
  console.log("======================================================");

  for (let i = 0; i < QUERIES.length; i++) {
    const query = QUERIES[i];
    console.log(`\n------------------------------------------------------`);
    console.log(`[Query ${i + 1}/4]: "${query}"`);
    console.log(`------------------------------------------------------`);

    const start = performance.now();
    try {
      const results = await searchProducts({ query });
      const duration = Math.round(performance.now() - start);

      console.log(`Total search duration: ${duration}ms`);
      console.log(`Total results returned: ${results.length}`);

      const sliceCount = Math.min(3, results.length);
      console.log(`\nUpgrading top ${sliceCount} products to direct store links...`);
      const top3 = await Promise.all(
        results.slice(0, sliceCount).map((p) => upgradeToDirectLink(p))
      );

      console.log(`\nFirst ${top3.length} products (after upgrade attempt):`);
      top3.forEach((p, idx) => {
        console.log(`  ${idx + 1}. Title: ${p.title}`);
        console.log(`     Platform: ${p.platform} (${p.domain})`);
        console.log(
          `     Price: ${typeof p.price === "number" ? "₹" + p.price.toLocaleString("en-IN") : "Price not available"}`
        );
        console.log(`     LinkType: ${p.linkType}`);
        console.log(`     Link: ${p.link}`);
      });
    } catch (err: unknown) {
      console.error(
        `Search failed for "${query}":`,
        err instanceof Error ? err.message : err
      );
    }
  }

  console.log("\n======================================================");
  console.log("ALL 4 SEARCH TESTS COMPLETED");
  console.log("======================================================\n");
}

main().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
