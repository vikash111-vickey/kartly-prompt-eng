import type { Product } from "@/types/product";
import type { SearchArgs, SearchProvider } from "../types";
import { buildPlatformSearchLink } from "@/lib/links";

const GROCERY_KEYWORDS = [
  "milk",
  "bread",
  "atta",
  "rice",
  "vegetables",
  "fruits",
  "snacks",
  "soap",
  "shampoo",
  "curd",
  "dahi",
  "paneer",
  "eggs",
  "oil",
  "sugar",
  "tea",
  "coffee",
  "biscuits",
  "groceries",
  "grocery",
  "chips",
  "cold drink",
  "coke",
  "butter",
  "cheese",
  "toothpaste",
  "detergent",
  "dal",
  "onion",
  "potato",
  "tomato",
  "maggi",
  "noodles",
  "ice cream",
  "water",
];

export class QuickCommerceProvider implements SearchProvider {
  name = "QuickCommerce (Blinkit, Zepto, BigBasket)";

  async search(args: SearchArgs, signal?: AbortSignal): Promise<Product[]> {
    if (signal?.aborted) {
      throw new Error("Search aborted");
    }

    const queryLower = args.query.toLowerCase().trim();
    const isUrgent = args.urgency === "10min";
    const isGrocery = GROCERY_KEYWORDS.some((kw) => queryLower.includes(kw));

    // Only return quick-commerce cards if urgency is 10min OR query looks like daily essentials
    if (!isUrgent && !isGrocery) {
      return [];
    }

    const platforms = [
      {
        name: "Blinkit",
        domain: "blinkit.com",
        deliveryEta: "10-15 mins",
      },
      {
        name: "Zepto",
        domain: "zeptonow.com",
        deliveryEta: "10-15 mins",
      },
      {
        name: "BigBasket",
        domain: "bigbasket.com",
        deliveryEta: "15-30 mins",
      },
    ];

    const cards: Product[] = platforms.map((p) => {
      const link = buildPlatformSearchLink(p.name, args.query);
      const stableId = `qc-${p.name.toLowerCase()}-${encodeURIComponent(args.query.slice(0, 15))}`;

      return {
        id: stableId,
        title: `Search '${args.query}' on ${p.name}`,
        platform: p.name,
        domain: p.domain,
        link,
        linkType: "platform_search",
        price: undefined, // No fake prices
        rating: undefined, // No fake ratings
        reviewCount: undefined, // No fake reviews
        deliveryEta: p.deliveryEta,
        deliveryFee: undefined,
        seller: undefined,
        sellerVerified: undefined,
        returnPolicy: undefined,
        image: "/placeholder-product.svg",
        trustScore: undefined,
        redFlags: [],
        whyPicked: `Direct search link for instant quick-commerce delivery on ${p.name}.`,
      };
    });

    return cards;
  }
}
