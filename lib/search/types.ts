import type { Product } from "@/types/product";

export interface SearchArgs {
  query: string;
  searchQuery?: string;
  excludeTerms?: string[];
  category?: string;
  maxPrice?: number;
  minRating?: number;
  mustHave?: string[];
  urgency?: "10min" | "today" | "normal";
}

export interface SearchProvider {
  name: string;
  search(args: SearchArgs, signal: AbortSignal): Promise<Product[]>;
}
