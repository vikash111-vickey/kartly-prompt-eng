import type { Product } from "@/types/product";

export interface RelevanceFilterOptions {
  category?: string;
  searchQuery?: string;
  excludeTerms?: string[];
  maxPrice?: number;
}

export interface RelevanceFilterResult {
  relevant: Product[];
  droppedCount: number;
  lowRelevance: boolean;
}

/**
 * Built-in default accessory and irrelevant item terms.
 */
export const DEFAULT_ACCESSORY_TERMS = [
  "case",
  "cover",
  "strap",
  "charger",
  "cable",
  "protector",
  "tempered glass",
  "skin",
  "stand",
  "holder",
  "toy",
  "replica",
  "dummy",
  "refill",
  "spare part",
];

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Filters out irrelevant products, accessories, and misleading items.
 * Must run BEFORE scoreProducts so median prices are calculated purely on relevant products.
 */
export function filterRelevant(
  products: Product[],
  options: RelevanceFilterOptions = {}
): RelevanceFilterResult {
  if (!products || products.length === 0) {
    return { relevant: [], droppedCount: 0, lowRelevance: true };
  }

  const { category = "", searchQuery = "", excludeTerms = [], maxPrice } = options;

  const targetCategory = (category || searchQuery).toLowerCase();
  const isGroceriesOrSmall =
    targetCategory.includes("grocer") ||
    targetCategory.includes("food") ||
    targetCategory.includes("milk") ||
    targetCategory.includes("bread") ||
    targetCategory.includes("dairy") ||
    targetCategory.includes("snack") ||
    targetCategory.includes("beverage") ||
    (typeof maxPrice === "number" && maxPrice <= 200);

  // Combine model-specified excludeTerms with default accessories
  // Do not drop an accessory term if the user is explicitly searching for that accessory
  const activeExcludes = new Set<string>();

  for (const term of excludeTerms) {
    const clean = term.trim().toLowerCase();
    if (clean) activeExcludes.add(clean);
  }

  for (const term of DEFAULT_ACCESSORY_TERMS) {
    // Only exclude default accessories if the query/category is not explicitly asking for them
    if (!targetCategory.includes(term.toLowerCase())) {
      activeExcludes.add(term);
    }
  }

  const regexList = Array.from(activeExcludes).map(
    (term) => new RegExp(`\\b${escapeRegex(term)}\\b`, "i")
  );

  const priceThreshold =
    typeof maxPrice === "number" && maxPrice > 0 ? 0.12 * maxPrice : null;

  const relevant: Product[] = [];
  let droppedCount = 0;

  for (const product of products) {
    const title = (product.title || "").toLowerCase();

    // 1. Check title against exclude terms (case-insensitive, whole word)
    const matchesExclude = regexList.some((regex) => regex.test(title));
    if (matchesExclude) {
      droppedCount++;
      continue;
    }

    // 2. If maxPrice is known, drop products priced under 12% of maxPrice (likely accessory)
    // unless the category is groceries or small everyday items
    if (
      !isGroceriesOrSmall &&
      priceThreshold !== null &&
      typeof product.price === "number" &&
      product.price < priceThreshold
    ) {
      droppedCount++;
      continue;
    }

    relevant.push(product);
  }

  const lowRelevance = relevant.length < 3;

  return {
    relevant,
    droppedCount,
    lowRelevance,
  };
}
