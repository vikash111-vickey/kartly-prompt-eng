import { Type, type FunctionDeclaration } from "@google/genai";
import type {
  Product,
  LinkType,
  TrustLabel,
  TrustConfidence,
  ScoreBreakdown,
} from "@/types/product";

/**
 * Function declaration for search_products tool used by Gemini.
 */
export const searchProductsDeclaration: FunctionDeclaration = {
  name: "search_products",
  description:
    "Searches across Indian ecommerce and quick-commerce platforms (Amazon, Flipkart, Blinkit, Zepto, Croma) for products matching the user's requirements. Call this tool whenever the user expresses an intent to find, buy, search, or compare products, and you have at least the product type.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      searchQuery: {
        type: Type.STRING,
        description:
          "A precise shopping query that names the product CATEGORY explicitly (e.g. 'smartphone 5G' instead of 'phones', 'office chair ergonomic' instead of 'chairs', 'cow milk whole wheat bread' instead of 'milk and bread'). Never use ambiguous words alone.",
      },
      excludeTerms: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description:
          "Words that identify wrong product types or accessories to leave out (e.g. for a phone: watch, smartwatch, case, cover, strap, charger, screen guard, tempered glass, toy, mini phone, dummy).",
      },
      category: {
        type: Type.STRING,
        description:
          "One short word identifying the core product category, such as 'smartphone', 'earbuds', 'chair', 'groceries'.",
      },
      query: {
        type: Type.STRING,
        description:
          "Legacy keyword fallback (optional).",
      },
      maxPrice: {
        type: Type.NUMBER,
        description: "Maximum budget limit in Indian Rupees (INR).",
      },
      minRating: {
        type: Type.NUMBER,
        description: "Minimum acceptable rating out of 5 (e.g. 4.0).",
      },
      mustHave: {
        type: Type.ARRAY,
        items: {
          type: Type.STRING,
        },
        description:
          "Must-have features (e.g. ['ANC', 'fast charging', 'type-C']).",
      },
      urgency: {
        type: Type.STRING,
        enum: ["10min", "today", "normal"],
        description:
          "Delivery urgency: '10min' for quick-commerce (Blinkit, Zepto), 'today' for same-day delivery, or 'normal'.",
      },
    },
    required: ["searchQuery"],
  },
};

/**
 * Function declaration for check_safety tool used by Gemini.
 */
export const checkSafetyDeclaration: FunctionDeclaration = {
  name: "check_safety",
  description:
    "Checks a link, domain, seller message, or payment request for scam indicators, typosquatting look-alikes, phishing, advance fee fraud, or deceptive tactics. Call this tool whenever the user pastes a link, shares a seller message, or asks if a deal, link, site, or payment is legit, safe, or a scam.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      input: {
        type: Type.STRING,
        description:
          "The link, domain, or message text to inspect for scams or security risks.",
      },
    },
    required: ["input"],
  },
};

/**
 * Stripped representation of a product passed to the Gemini model.
 * Does NOT contain link, image, or domain. Includes linkType, trust metrics, and dataNote.
 */
export interface ModelProductView {
  id: string;
  title: string;
  platform: string;
  linkType: LinkType;
  price?: number;
  deliveryFee?: number;
  deliveryEta?: string;
  rating?: number;
  reviewCount?: number;
  seller?: string;
  sellerVerified?: boolean;
  returnPolicy?: string;
  trustScore?: number;
  trustLabel?: TrustLabel;
  confidence?: TrustConfidence;
  scoreBreakdown?: ScoreBreakdown;
  redFlags?: string[];
  positives?: string[];
  providerFailed?: boolean;
  lowRelevance?: boolean;
  dataNote: string;
}

/**
 * Returns products WITHOUT link, image, and domain fields.
 * Includes trust metrics, linkType, and dataNote explaining missing fields so the model never invents them.
 */
export function toModelView(
  products: Product[],
  options?: { lowRelevance?: boolean }
): ModelProductView[] {
  if (options?.lowRelevance) {
    return [
      {
        id: "low_relevance_notice",
        title: "Poor matching results",
        platform: "Search Engine",
        linkType: "platform_search",
        lowRelevance: true,
        dataNote:
          "No good matches for this category/price. Ask the user one clarifying question (e.g. confirm the product type or suggest a realistic price range) instead of showing bad deals.",
      },
    ];
  }

  return products.map((p) => {
    if (p.providerFailed) {
      return {
        id: p.id,
        title: p.title,
        platform: p.platform,
        linkType: p.linkType,
        providerFailed: true,
        dataNote:
          "Live shopping search failed: could not reach the stores right now. Tell the user plainly 'I couldn't reach the stores right now. Please try again in a moment.' and do NOT invent any products, prices, or links.",
      };
    }

    const missing: string[] = [];
    if (p.price === undefined) missing.push("price (search page link only)");
    if (!p.seller) missing.push("seller name");
    if (p.sellerVerified === undefined) missing.push("seller verification");
    if (!p.returnPolicy) missing.push("return policy");
    if (p.deliveryFee === undefined) missing.push("delivery fee");

    const dataNote =
      p.linkType === "platform_search"
        ? `Platform search link for ${p.platform}. ${missing.length > 0 ? "Missing fields: " + missing.join(", ") + ". Do not invent these values." : ""}`
        : `Listing on ${p.platform}. ${missing.length > 0 ? "Missing fields: " + missing.join(", ") + ". State clearly that these were not provided." : ""}`;

    return {
      id: p.id,
      title: p.title,
      platform: p.platform,
      linkType: p.linkType,
      price: p.price,
      deliveryFee: p.deliveryFee,
      deliveryEta: p.deliveryEta,
      rating: p.rating,
      reviewCount: p.reviewCount,
      seller: p.seller,
      sellerVerified: p.sellerVerified,
      returnPolicy: p.returnPolicy,
      trustScore: p.trustScore,
      trustLabel: p.trustLabel,
      confidence: p.confidence,
      scoreBreakdown: p.scoreBreakdown,
      redFlags: p.redFlags,
      positives: p.positives,
      dataNote,
    };
  });
}
