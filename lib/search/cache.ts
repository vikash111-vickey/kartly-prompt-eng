import type { Product } from "@/types/product";
import type { SearchArgs } from "./types";

interface CacheEntry {
  products: Product[];
  timestamp: number;
}

const MAX_CACHE_ENTRIES = 100;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

class SearchCache {
  private cache = new Map<string, CacheEntry>();

  private normalizeKey(args: SearchArgs): string {
    return JSON.stringify({
      q: args.query.toLowerCase().trim(),
      maxPrice: args.maxPrice ?? null,
      minRating: args.minRating ?? null,
      mustHave: (args.mustHave ?? []).map((s) => s.toLowerCase().trim()).sort(),
      urgency: args.urgency ?? null,
    });
  }

  get(args: SearchArgs): Product[] | null {
    const key = this.normalizeKey(args);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      this.cache.delete(key);
      return null;
    }

    return entry.products;
  }

  set(args: SearchArgs, products: Product[]): void {
    const key = this.normalizeKey(args);

    // Evict oldest entry when reaching max size
    if (this.cache.size >= MAX_CACHE_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      products,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

export const searchCache = new SearchCache();
