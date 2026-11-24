import type { Product } from "@/types/product";
import type { SearchArgs, SearchProvider } from "./types";
import { ShoppingApiProvider } from "./providers/shopping-api";
import { QuickCommerceProvider } from "./providers/quick-commerce";
import { searchCache } from "./cache";
import { searchProducts as searchProductsMock } from "./mock";
import { scoreProducts } from "@/lib/trust/score";
import { filterRelevant } from "./relevance";

export * from "./types";

/**
 * Sorts products by trustScore descending, placing risky items last.
 */
function sortByTrustScore(products: Product[]): Product[] {
  return products.sort((a, b) => {
    // Put "risky" items last
    const aRisky = a.trustLabel === "risky" ? 1 : 0;
    const bRisky = b.trustLabel === "risky" ? 1 : 0;
    if (aRisky !== bRisky) return aRisky - bRisky;

    // Then sort by trustScore descending
    const aScore = a.trustScore ?? 0;
    const bScore = b.trustScore ?? 0;
    return bScore - aScore;
  });
}

/**
 * Main searchProducts function executing across all registered search providers.
 * Runs providers in parallel with a 6-second timeout per provider via AbortController.
 * Evaluates server-side trust scores and sorts by trustScore desc (risky items last).
 */
export async function searchProducts(args: SearchArgs): Promise<Product[]> {
  // 1. Check in-memory cache first
  const cached = searchCache.get(args);
  if (cached) {
    console.log(`[SearchCache] Cache hit for "${args.query}" (${cached.length} items)`);
    return cached;
  }

  // 2. Check offline demo flag
  if (process.env.USE_MOCK_SEARCH === "true") {
    console.log(`[Search] USE_MOCK_SEARCH is enabled. Serving mock results for "${args.searchQuery || args.query}".`);
    const rawMock = await searchProductsMock(args);
    const { relevant: relevantMock } = filterRelevant(rawMock, {
      category: args.category,
      searchQuery: args.searchQuery || args.query,
      excludeTerms: args.excludeTerms,
      maxPrice: args.maxPrice,
    });
    const scoredMock = sortByTrustScore(scoreProducts(relevantMock));
    searchCache.set(args, scoredMock);
    return scoredMock;
  }

  // If no live search API key is configured, fallback to mock catalog
  const hasKey = Boolean(
    process.env.SERPAPI_KEY?.trim() || process.env.SERPER_KEY?.trim()
  );
  if (!hasKey) {
    console.warn(`[Search] No SERPAPI_KEY or SERPER_KEY configured. Falling back to mock dataset.`);
    const rawMock = await searchProductsMock(args);
    const { relevant: relevantMock } = filterRelevant(rawMock, {
      category: args.category,
      searchQuery: args.searchQuery || args.query,
      excludeTerms: args.excludeTerms,
      maxPrice: args.maxPrice,
    });
    const scoredMock = sortByTrustScore(scoreProducts(relevantMock));
    searchCache.set(args, scoredMock);
    return scoredMock;
  }

  // 3. Register Providers
  const providers: SearchProvider[] = [
    new ShoppingApiProvider(),
    new QuickCommerceProvider(),
  ];

  // Helper to detect timeout or 5xx errors
  const isTimeoutOr5xx = (err: unknown): boolean => {
    if (!err) return false;
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout =
      (err as { name?: string })?.name === "AbortError" ||
      msg.toLowerCase().includes("timeout") ||
      msg.toLowerCase().includes("aborted");
    const is5xx =
      /\b5\d{2}\b/.test(msg) ||
      msg.includes("500") ||
      msg.includes("502") ||
      msg.includes("503") ||
      msg.includes("504");
    return isTimeout || is5xx;
  };

  // 4. Run all providers with 12s timeout via Promise.allSettled
  const TIMEOUT_MS = 12000;
  const resultsByProvider = await Promise.allSettled(
    providers.map(async (provider) => {
      const runSearch = (signal: AbortSignal) => provider.search(args, signal);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const start = performance.now();

      try {
        const products = await runSearch(controller.signal);
        const duration = Math.round(performance.now() - start);
        console.log(`[SearchProvider] ${provider.name}: ${products.length} results in ${duration}ms`);
        return products;
      } catch (err: unknown) {
        // Retry Shopping API provider ONCE if it fails with a timeout or 5xx, with a 1 second wait
        if (provider instanceof ShoppingApiProvider && isTimeoutOr5xx(err)) {
          console.warn(
            `[SearchProvider] ${provider.name} failed with timeout/5xx. Retrying ONCE after 1s wait...`
          );
          await new Promise((r) => setTimeout(r, 1000));
          const retryController = new AbortController();
          const retryTimeoutId = setTimeout(() => retryController.abort(), TIMEOUT_MS);
          try {
            const retryProducts = await runSearch(retryController.signal);
            const duration = Math.round(performance.now() - start);
            console.log(
              `[SearchProvider] ${provider.name} (retry succeeded): ${retryProducts.length} results in ${duration}ms`
            );
            return retryProducts;
          } catch (retryErr: unknown) {
            const duration = Math.round(performance.now() - start);
            const errorMsg = retryErr instanceof Error ? retryErr.message : "Provider retry failure";
            console.error(`[SearchProvider] ${provider.name} retry failed after ${duration}ms: ${errorMsg}`);
            throw retryErr;
          } finally {
            clearTimeout(retryTimeoutId);
          }
        }

        const duration = Math.round(performance.now() - start);
        const errorMsg = err instanceof Error ? err.message : "Provider failure";
        console.error(`[SearchProvider] ${provider.name} failed after ${duration}ms: ${errorMsg}`);
        throw err;
      } finally {
        clearTimeout(timeoutId);
      }
    })
  );

  // 5. Aggregate results
  const allProducts: Product[] = [];
  let failureCount = 0;

  for (const res of resultsByProvider) {
    if (res.status === "fulfilled") {
      allProducts.push(...res.value);
    } else {
      failureCount++;
    }
  }

  // If every provider failed and no results found, return providerFailed fallback
  if (allProducts.length === 0 && failureCount === providers.length) {
    console.warn(
      "[Search] All search providers failed. Returning providerFailed fallback product."
    );
    return [
      {
        id: "search-provider-failed",
        title: "Store search unavailable",
        platform: "All Platforms",
        domain: "",
        link: "",
        linkType: "platform_search",
        providerFailed: true,
        trustScore: 0,
        trustLabel: "risky",
        confidence: "low",
        whyPicked: "I couldn't reach the stores right now.",
      },
    ];
  }

  // 6. Filter Relevant Products (run BEFORE scoreProducts so medians are computed only on relevant items)
  const { relevant, droppedCount } = filterRelevant(allProducts, {
    category: args.category,
    searchQuery: args.searchQuery || args.query,
    excludeTerms: args.excludeTerms,
    maxPrice: args.maxPrice,
  });
  console.log(
    `[Search] Relevance filter dropped ${droppedCount} products. Remaining relevant: ${relevant.length}`
  );

  // 7. Score products with Trust Score engine & sort (trustScore desc, risky items last)
  const scoredProducts = scoreProducts(relevant);
  const sorted = sortByTrustScore(scoredProducts);

  // Limit to max 12 products
  const finalResults = sorted.slice(0, 12);

  // 8. Store in cache (keep cache intact; only cache valid results)
  if (finalResults.length > 0 && !finalResults[0].providerFailed) {
    searchCache.set(args, finalResults);
  }

  return finalResults;
}
