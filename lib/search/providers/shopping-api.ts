import type { Product, LinkType } from "@/types/product";
import type { SearchArgs, SearchProvider } from "../types";
import {
  ALLOWED_DOMAINS,
  validateProductLink,
  buildPlatformSearchLink,
} from "@/lib/links";

interface SerpApiShoppingItem {
  position?: number;
  title?: string;
  source?: string;
  price?: string;
  extracted_price?: number;
  rating?: number;
  reviews?: number;
  thumbnail?: string;
  serpapi_thumbnail?: string;
  delivery?: string;
  link?: string;
  product_link?: string;
  product_id?: string;
  immersive_product_page_token?: string;
  serpapi_immersive_product_api?: string;
}

/**
 * Normalizes merchant/source names to recognized platforms and their canonical domains.
 */
function normalizeMerchant(rawSource?: string): {
  platform: string;
  domain: string;
  isAllowed: boolean;
} {
  if (!rawSource) {
    return { platform: "Unknown", domain: "", isAllowed: false };
  }

  const clean = rawSource.toLowerCase().trim();

  if (clean.includes("amazon")) {
    return { platform: "Amazon", domain: "amazon.in", isAllowed: true };
  }
  if (clean.includes("flipkart") || clean.includes("shopsy")) {
    return { platform: "Flipkart", domain: "flipkart.com", isAllowed: true };
  }
  if (clean.includes("croma")) {
    return { platform: "Croma", domain: "croma.com", isAllowed: true };
  }
  if (clean.includes("reliance") || clean.includes("reliancedigital")) {
    return {
      platform: "Reliance Digital",
      domain: "reliancedigital.in",
      isAllowed: true,
    };
  }
  if (clean.includes("myntra")) {
    return { platform: "Myntra", domain: "myntra.com", isAllowed: true };
  }
  if (clean.includes("ajio")) {
    return { platform: "Ajio", domain: "ajio.com", isAllowed: true };
  }
  if (clean.includes("nykaa")) {
    return { platform: "Nykaa", domain: "nykaa.com", isAllowed: true };
  }
  if (clean.includes("tatacliq") || clean.includes("tata cliq")) {
    return { platform: "Tata CLiQ", domain: "tatacliq.com", isAllowed: true };
  }
  if (clean.includes("meesho")) {
    return { platform: "Meesho", domain: "meesho.com", isAllowed: true };
  }
  if (clean.includes("snapdeal")) {
    return { platform: "Snapdeal", domain: "snapdeal.com", isAllowed: true };
  }
  if (clean.includes("blinkit")) {
    return { platform: "Blinkit", domain: "blinkit.com", isAllowed: true };
  }
  if (clean.includes("zepto")) {
    return { platform: "Zepto", domain: "zeptonow.com", isAllowed: true };
  }
  if (clean.includes("bigbasket")) {
    return { platform: "BigBasket", domain: "bigbasket.com", isAllowed: true };
  }
  if (clean.includes("swiggy") || clean.includes("instamart")) {
    return { platform: "Swiggy", domain: "swiggy.com", isAllowed: true };
  }

  // Check if merchant is directly in ALLOWED_DOMAINS
  const matchingDomain = ALLOWED_DOMAINS.find(
    (d) => clean === d || clean.endsWith(`.${d}`)
  );
  if (matchingDomain) {
    return { platform: rawSource, domain: matchingDomain, isAllowed: true };
  }

  // Unknown merchant
  return { platform: rawSource, domain: "", isAllowed: false };
}

/**
 * Creates a deterministic, short stable ID for a product.
 */
function generateStableId(platform: string, title: string, price?: number): string {
  const normalized = `${platform.toLowerCase()}_${title.toLowerCase().replace(/[^a-z0-9]/g, "")}_${price ?? 0}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    hash = (hash << 5) - hash + normalized.charCodeAt(i);
    hash |= 0;
  }
  return `sp-${Math.abs(hash).toString(36)}`;
}

export class ShoppingApiProvider implements SearchProvider {
  name = "ShoppingAPI (Google Shopping)";

  async search(args: SearchArgs, signal: AbortSignal): Promise<Product[]> {
    const apiKey =
      process.env.SERPAPI_KEY?.trim() || process.env.SERPER_KEY?.trim();

    if (!apiKey) {
      throw new Error("SERPAPI_KEY (or SERPER_KEY) is not configured in environment");
    }

    const isSerper = Boolean(process.env.SERPER_KEY && !process.env.SERPAPI_KEY);

    // Prefer precise category searchQuery over raw user text
    const rawInput = (args.searchQuery || args.query || "").trim();

    // Clean price/budget phrases from the query before sending to Google Shopping API
    // so Google Shopping returns the core product category rather than matching numbers as model IDs.
    const cleanQuery = rawInput
      .replace(/\b(under|below|less than|within|around)\s*(?:rs\.?|inr|₹)?\s*\d+(?:\s*(?:k|thousand))?\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    const searchQuery = cleanQuery.length >= 2 ? cleanQuery : rawInput;

    // Infer maxPrice if not provided explicitly in args
    let effectiveMaxPrice = args.maxPrice;
    if (!effectiveMaxPrice) {
      const priceMatch = rawInput.match(/\b(?:under|below|less than|within)\s*(?:rs\.?|inr|₹)?\s*(\d+)(?:\s*(k|thousand))?\b/i);
      if (priceMatch) {
        let val = parseInt(priceMatch[1], 10);
        if (priceMatch[2]?.toLowerCase().startsWith("k") || priceMatch[2]?.toLowerCase().startsWith("thousand")) {
          val *= 1000;
        }
        if (!isNaN(val) && val > 0) {
          effectiveMaxPrice = val;
        }
      }
    }

    let rawResults: SerpApiShoppingItem[] = [];

    if (isSerper) {
      // Serper.dev Shopping API
      const res = await fetch("https://google.serper.dev/shopping", {
        method: "POST",
        headers: {
          "X-API-KEY": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: searchQuery,
          gl: "in",
          hl: "en",
        }),
        signal,
      });

      if (!res.ok) {
        throw new Error(`Serper API returned HTTP ${res.status}`);
      }

      const json = await res.json();
      rawResults = (json.shopping || []) as SerpApiShoppingItem[];
    } else {
      // SerpAPI Google Shopping Engine
      const apiUrl = new URL("https://serpapi.com/search.json");
      apiUrl.searchParams.set("engine", "google_shopping");
      apiUrl.searchParams.set("q", searchQuery);
      apiUrl.searchParams.set("gl", "in");
      apiUrl.searchParams.set("hl", "en");
      apiUrl.searchParams.set("api_key", apiKey);

      const res = await fetch(apiUrl.toString(), { signal });
      if (!res.ok) {
        throw new Error(`SerpAPI returned HTTP ${res.status}`);
      }

      const json = await res.json();
      if (json.error) {
        throw new Error(`SerpAPI error: ${json.error}`);
      }
      rawResults = (json.shopping_results || []) as SerpApiShoppingItem[];
    }

    const mappedProducts: Product[] = [];
    const seenTitles = new Set<string>();

    for (const item of rawResults) {
      if (!item.title) continue;

      const { platform, domain, isAllowed } = normalizeMerchant(item.source);

      // Link rule:
      // 1. If API provides a merchant URL, validate it.
      // 2. If it's a Google redirect or validation fails, set platform search link if allowed, else drop.
      let finalLink = "";
      let finalLinkType: LinkType = "platform_search";
      let finalDomain = domain;

      const candidateUrl = item.link || item.product_link || "";
      const isGoogleRedirect =
        !candidateUrl ||
        candidateUrl.includes("google.com/search") ||
        candidateUrl.includes("google.com/url") ||
        candidateUrl.includes("google.co.in");

      if (!isGoogleRedirect) {
        const validation = validateProductLink(candidateUrl);
        if (validation.ok) {
          finalLink = candidateUrl;
          finalLinkType = "direct";
          finalDomain = validation.domain;
        }
      }

      // If no direct link validated:
      if (!finalLink) {
        if (isAllowed && domain) {
          finalLink = buildPlatformSearchLink(platform, args.query);
          finalLinkType = "platform_search";
          finalDomain = domain;
        } else {
          // Merchant not on our allow-list; drop product
          continue;
        }
      }

      // Apply price and rating filters in code
      const numericPrice =
        typeof item.extracted_price === "number"
          ? item.extracted_price
          : undefined;

      if (
        effectiveMaxPrice &&
        typeof numericPrice === "number" &&
        numericPrice > effectiveMaxPrice
      ) {
        continue;
      }

      const numericRating =
        typeof item.rating === "number" ? item.rating : undefined;

      if (
        args.minRating &&
        typeof numericRating === "number" &&
        numericRating < args.minRating
      ) {
        continue;
      }

      // Deduplication: same platform + near-identical title
      const normalizedTitleKey = `${platform}_${item.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 30)}`;
      if (seenTitles.has(normalizedTitleKey)) {
        continue;
      }
      seenTitles.add(normalizedTitleKey);

      mappedProducts.push({
        id: generateStableId(platform, item.title, numericPrice),
        title: item.title,
        platform,
        domain: finalDomain,
        link: finalLink,
        linkType: finalLinkType,
        productId: item.product_id,
        immersiveToken: item.immersive_product_page_token,
        price: numericPrice,
        deliveryEta: item.delivery || undefined,
        deliveryFee: undefined, // Not provided by API; left undefined
        rating: numericRating,
        reviewCount:
          typeof item.reviews === "number" ? item.reviews : undefined,
        seller: item.source || platform,
        sellerVerified: undefined, // Not provided by API; left undefined
        returnPolicy: undefined, // Not provided by API; left undefined
        image: item.thumbnail || item.serpapi_thumbnail || "/placeholder-product.svg",
        trustScore: numericRating ? Math.round(numericRating * 20) : undefined,
        redFlags:
          numericRating && numericRating < 3.5
            ? [`Low buyer rating (★ ${numericRating})`]
            : undefined,
      });

      if (mappedProducts.length >= 15) {
        break;
      }
    }

    return mappedProducts;
  }
}

interface UpgradedLinkCacheEntry {
  product: Product;
  expiresAt: number;
}

// 30-minute in-memory cache for upgraded direct links (keyed by product.id)
const directLinkCache = new Map<string, UpgradedLinkCacheEntry>();

/**
 * Upgrades a product's link from a platform search fallback to a direct merchant store link
 * by querying SerpAPI's google_immersive_product endpoint.
 *
 * - Finds the offer matching the product's platform, or falls back to the cheapest valid offer.
 * - Runs validateProductLink on the URL.
 * - Times out after 4 seconds; returns the product unchanged on failure or timeout.
 * - Caches results for 30 minutes by product.id to preserve SerpAPI credits.
 */
export async function upgradeToDirectLink(product: Product): Promise<Product> {
  // If already direct, nothing to upgrade
  if (product.linkType === "direct") {
    return product;
  }

  // Check 30-minute cache by product.id
  const now = Date.now();
  const cached = directLinkCache.get(product.id);
  if (cached && cached.expiresAt > now) {
    console.log(
      `[UpgradeToDirectLink] Cache Hit for "${product.title.slice(0, 30)}" -> ${cached.product.linkType} (${cached.product.domain})`
    );
    return cached.product;
  }

  // We need an immersive token or product_id to query SerpAPI
  const token = product.immersiveToken;
  const productId = product.productId;
  const apiKey = process.env.SERPAPI_KEY?.trim();

  if ((!token && !productId) || !apiKey) {
    console.log(
      `[UpgradeToDirectLink] Fallback: Missing token/key for "${product.title.slice(0, 30)}", keeping platform_search`
    );
    return product;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4-second timeout

  try {
    const url = new URL("https://serpapi.com/search.json");
    url.searchParams.set("engine", "google_immersive_product");
    if (token) {
      url.searchParams.set("page_token", token);
    } else if (productId) {
      url.searchParams.set("product_id", productId);
    }
    url.searchParams.set("gl", "in");
    url.searchParams.set("hl", "en");
    url.searchParams.set("api_key", apiKey);

    const res = await fetch(url.toString(), { signal: controller.signal });
    clearTimeout(timeoutId);

    if (!res.ok) {
      throw new Error(`SerpAPI HTTP ${res.status}`);
    }

    const data = await res.json();
    const stores = (data.product_results?.stores || []) as Array<{
      name?: string;
      link?: string;
      extracted_price?: number;
      price?: string;
      total?: string;
      extracted_total?: number;
    }>;

    if (!stores || stores.length === 0) {
      console.log(
        `[UpgradeToDirectLink] Fallback: No stores found for "${product.title.slice(0, 30)}", keeping platform_search`
      );
      return product;
    }

    // 1. Try to find an offer matching the product's platform
    let chosenOffer: (typeof stores)[0] | undefined;
    const targetPlatform = product.platform.toLowerCase();

    for (const s of stores) {
      if (!s.link || !s.name) continue;
      const storeName = s.name.toLowerCase();
      if (
        storeName.includes(targetPlatform) ||
        targetPlatform.includes(storeName)
      ) {
        const val = validateProductLink(s.link);
        if (val.ok) {
          chosenOffer = s;
          break;
        }
      }
    }

    // 2. If no direct platform match, pick the cheapest valid offer
    if (!chosenOffer) {
      const validOffers = stores.filter(
        (s) => s.link && validateProductLink(s.link).ok
      );
      if (validOffers.length > 0) {
        validOffers.sort((a, b) => {
          const priceA = a.extracted_total ?? a.extracted_price ?? 999999;
          const priceB = b.extracted_total ?? b.extracted_price ?? 999999;
          return priceA - priceB;
        });
        chosenOffer = validOffers[0];
      }
    }

    if (!chosenOffer || !chosenOffer.link) {
      console.log(
        `[UpgradeToDirectLink] Fallback: No valid store link for "${product.title.slice(0, 30)}", keeping platform_search`
      );
      return product;
    }

    const validation = validateProductLink(chosenOffer.link);
    if (!validation.ok) {
      console.log(
        `[UpgradeToDirectLink] Fallback: Offer link failed validation for "${product.title.slice(0, 30)}", keeping platform_search`
      );
      return product;
    }

    const upgradedProduct: Product = {
      ...product,
      link: chosenOffer.link,
      linkType: "direct",
      domain: validation.domain,
      seller: chosenOffer.name || product.seller,
      price: chosenOffer.extracted_price ?? product.price,
    };

    console.log(
      `[UpgradeToDirectLink] Success: Upgraded "${product.title.slice(0, 30)}" to direct link on ${chosenOffer.name} (${chosenOffer.link.slice(0, 60)}...)`
    );

    // Cache result for 30 minutes
    directLinkCache.set(product.id, {
      product: upgradedProduct,
      expiresAt: now + 30 * 60 * 1000,
    });

    return upgradedProduct;
  } catch (err: unknown) {
    clearTimeout(timeoutId);
    const reason =
      err instanceof Error && err.name === "AbortError"
        ? "Timeout after 4s"
        : err instanceof Error
          ? err.message
          : String(err);
    console.log(
      `[UpgradeToDirectLink] Fallback: "${product.title.slice(0, 30)}" failed (${reason}), keeping platform_search`
    );
    return product;
  }
}
