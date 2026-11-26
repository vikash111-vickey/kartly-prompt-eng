import type { Product } from "@/types/product";
import type { SearchArgs } from "./types";
import { ShoppingApiProvider } from "./providers/shopping-api";
import { QuickCommerceProvider } from "./providers/quick-commerce";
import { searchCache } from "./cache";
import { searchProducts as searchProductsMock } from "./mock";
import { scoreProducts } from "@/lib/trust/score";
import { filterRelevant } from "./relevance";
import { cleanSearchQuery } from "./query";

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

function normalizeTitleForDedup(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function areTitlesNearIdentical(titleA: string, titleB: string): boolean {
  const normA = normalizeTitleForDedup(titleA);
  const normB = normalizeTitleForDedup(titleB);
  if (!normA || !normB) return false;
  if (normA === normB) return true;

  // Prefix matching if one is a substantial prefix of the other
  if (normA.startsWith(normB) && normB.length / normA.length >= 0.75) return true;
  if (normB.startsWith(normA) && normA.length / normB.length >= 0.75) return true;

  // Jaccard word similarity
  const wordsA = new Set(normA.split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normB.split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]).size;
  return intersection / union >= 0.75;
}

/**
 * Deduplicates products that share the same platform and near-identical titles.
 */
function deduplicateProducts(products: Product[]): Product[] {
  const deduped: Product[] = [];

  for (const p of products) {
    const existingIndex = deduped.findIndex(
      (existing) =>
        existing.platform.toLowerCase() === p.platform.toLowerCase() &&
        areTitlesNearIdentical(existing.title, p.title)
    );

    if (existingIndex === -1) {
      deduped.push(p);
    } else {
      // Keep whichever has a direct link, a verified rating, or lower price
      const existing = deduped[existingIndex];
      const existingScore = (existing.linkType === "direct" ? 2 : 0) + (existing.rating ? 1 : 0);
      const newScore = (p.linkType === "direct" ? 2 : 0) + (p.rating ? 1 : 0);
      if (newScore > existingScore) {
        deduped[existingIndex] = p;
      }
    }
  }

  return deduped;
}

/**
 * Main searchProducts function executing across Shopping API (up to two query variants in parallel)
 * and QuickCommerceProvider.
 * Limits to 2 SerpAPI calls per search with 10-minute cache.
 * Evaluates server-side trust scores and keeps the best 12 products.
 */
export async function searchProducts(args: SearchArgs): Promise<Product[]> {
  // Determine cleaned searchQuery and effectiveMaxPrice
  const fallbackCleaned = cleanSearchQuery(args.query || "");
  const baseSearchQuery = (args.searchQuery || fallbackCleaned.searchQuery || args.query || "").trim();
  const effectiveMaxPrice =
    typeof args.maxPrice === "number" ? args.maxPrice : fallbackCleaned.maxPrice;

  // 1. Check in-memory 10-minute cache first
  const cached = searchCache.get({
    ...args,
    searchQuery: baseSearchQuery,
    maxPrice: effectiveMaxPrice,
  });
  if (cached) {
    console.log(`[SearchCache] Cache hit for "${baseSearchQuery}" (${cached.length} items)`);
    return cached;
  }

  // 2. Check offline demo flag
  if (process.env.USE_MOCK_SEARCH === "true") {
    console.log(`[Search] USE_MOCK_SEARCH is enabled. Serving mock results for "${baseSearchQuery}".`);
    const rawMock = await searchProductsMock({
      ...args,
      searchQuery: baseSearchQuery,
      maxPrice: effectiveMaxPrice,
    });
    const { relevant: relevantMock } = filterRelevant(rawMock, {
      category: args.category,
      searchQuery: baseSearchQuery,
      excludeTerms: args.excludeTerms,
      maxPrice: effectiveMaxPrice,
    });
    const scoredMock = sortByTrustScore(scoreProducts(deduplicateProducts(relevantMock)));
    searchCache.set(args, scoredMock);
    return scoredMock;
  }

  // If no live search API key is configured, fallback to mock catalog
  const hasKey = Boolean(
    process.env.SERPAPI_KEY?.trim() || process.env.SERPER_KEY?.trim()
  );
  if (!hasKey) {
    console.warn(`[Search] No SERPAPI_KEY or SERPER_KEY configured. Falling back to mock dataset.`);
    const rawMock = await searchProductsMock({
      ...args,
      searchQuery: baseSearchQuery,
      maxPrice: effectiveMaxPrice,
    });
    const { relevant: relevantMock } = filterRelevant(rawMock, {
      category: args.category,
      searchQuery: baseSearchQuery,
      excludeTerms: args.excludeTerms,
      maxPrice: effectiveMaxPrice,
    });
    const scoredMock = sortByTrustScore(scoreProducts(deduplicateProducts(relevantMock)));
    searchCache.set(args, scoredMock);
    return scoredMock;
  }

  // 3. Prepare up to TWO query variants for Shopping API provider
  // Variant 1: Main searchQuery (with price filter)
  const variant1Query = baseSearchQuery;

  // Variant 2: Second variant with category or rephrased form (e.g. "{searchQuery} buy online India")
  let variant2Query = `${baseSearchQuery} buy online India`;
  if (
    args.category &&
    args.category.toLowerCase() !== baseSearchQuery.toLowerCase() &&
    !baseSearchQuery.toLowerCase().includes(args.category.toLowerCase())
  ) {
    variant2Query = `${baseSearchQuery} ${args.category}`;
  }

  const shoppingProvider = new ShoppingApiProvider();
  const quickCommerceProvider = new QuickCommerceProvider();
  const TIMEOUT_MS = 8000;

  // Run a single variant search against ShoppingApiProvider
  const runVariantSearch = async (
    queryText: string,
    variantName: string
  ): Promise<Product[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const start = performance.now();
    try {
      const prods = await shoppingProvider.search(
        {
          ...args,
          query: queryText,
          searchQuery: queryText,
          maxPrice: effectiveMaxPrice,
        },
        controller.signal
      );
      const duration = Math.round(performance.now() - start);
      console.log(
        `[SearchVariant] ${variantName} ("${queryText}"): ${prods.length} results in ${duration}ms`
      );
      return prods;
    } catch (err) {
      const duration = Math.round(performance.now() - start);
      console.warn(
        `[SearchVariant] ${variantName} ("${queryText}") failed after ${duration}ms:`,
        err instanceof Error ? err.message : err
      );
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  };

  const runQuickCommerce = async (): Promise<Product[]> => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      return await quickCommerceProvider.search(
        {
          ...args,
          query: baseSearchQuery,
          searchQuery: baseSearchQuery,
          maxPrice: effectiveMaxPrice,
        },
        controller.signal
      );
    } catch {
      return [];
    } finally {
      clearTimeout(timeoutId);
    }
  };

  // 4. Run Shopping API variants and QuickCommerce in parallel
  // Limits strictly to 2 SerpAPI calls per search
  const [v1Res, v2Res, qcRes] = await Promise.allSettled([
    runVariantSearch(variant1Query, "Variant 1"),
    runVariantSearch(variant2Query, "Variant 2"),
    runQuickCommerce(),
  ]);

  const allRawProducts: Product[] = [];
  if (v1Res.status === "fulfilled") allRawProducts.push(...v1Res.value);
  if (v2Res.status === "fulfilled") allRawProducts.push(...v2Res.value);
  if (qcRes.status === "fulfilled") allRawProducts.push(...qcRes.value);

  // 5. Merge & Deduplicate (same platform and near-identical title)
  const dedupedProducts = deduplicateProducts(allRawProducts);
  console.log(
    `[Search] Raw results: ${allRawProducts.length}, after deduplication: ${dedupedProducts.length}`
  );

  // If every provider failed and no results found, return providerFailed fallback
  if (dedupedProducts.length === 0) {
    console.warn(
      "[Search] All search providers failed or returned 0 results. Returning providerFailed fallback product."
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

  // 6. Filter Relevant Products
  let filterResult = filterRelevant(dedupedProducts, {
    category: args.category,
    searchQuery: baseSearchQuery,
    excludeTerms: args.excludeTerms,
    maxPrice: effectiveMaxPrice,
  });

  console.log(
    `[Search] Relevance filter dropped ${filterResult.droppedCount} products (exclude terms: ${filterResult.droppedReasons.excludeTerms}, below 12% price threshold: ${filterResult.droppedReasons.belowMinPrice}). Remaining relevant: ${filterResult.relevant.length}`
  );

  // If after filtering fewer than 3 products remain, relax ONLY the price-below-12%-of-budget accessory rule once and report that you did.
  if (filterResult.relevant.length < 3 && filterResult.droppedReasons.belowMinPrice > 0) {
    console.log(
      "[Search] Relaxed price-below-12%-of-budget accessory rule because fewer than 3 products remained."
    );
    filterResult = filterRelevant(dedupedProducts, {
      category: args.category,
      searchQuery: baseSearchQuery,
      excludeTerms: args.excludeTerms,
      maxPrice: effectiveMaxPrice,
      relaxPriceThreshold: true,
    });
  }

  // 7. Score products with Trust Score engine & sort (trustScore desc, risky items last)
  const scoredProducts = scoreProducts(filterResult.relevant);
  const sorted = sortByTrustScore(scoredProducts);

  // Keep the best 12 products
  const finalResults = sorted.slice(0, 12);

  // 8. Store in 10-minute cache
  if (finalResults.length > 0 && !finalResults[0].providerFailed) {
    searchCache.set(
      {
        ...args,
        searchQuery: baseSearchQuery,
        maxPrice: effectiveMaxPrice,
      },
      finalResults
    );
  }

  return finalResults;
}
