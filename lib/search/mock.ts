import type { Product } from "@/types/product";
import { buildPlatformSearchLink, validateProductLink } from "@/lib/links";

export interface SearchProductsArgs {
  query: string;
  maxPrice?: number;
  minRating?: number;
  mustHave?: string[];
  urgency?: "10min" | "today" | "normal";
}

/**
 * Returns a validated link or safe platform search URL.
 */
function resolveProductLink(
  platform: string,
  searchQuery: string
): { link: string; domain: string } {
  const searchUrl = buildPlatformSearchLink(platform, searchQuery);
  const validated = validateProductLink(searchUrl);
  return {
    link: searchUrl,
    domain: validated.ok ? validated.domain : `${platform.toLowerCase()}.com`,
  };
}

/**
 * Realistic Mock Products Dataset for Indian E-Commerce platforms.
 * Covers Amazon, Flipkart, Blinkit, Zepto, and Croma.
 * Includes realistic pricing, delivery times, review distributions,
 * and 1 deliberately suspicious listing for fraud detection testing.
 */
function getEarbudProducts(): Product[] {
  return [
    {
      id: "mock-earbuds-boat-141",
      title: "boAt Airdopes 141 Bluetooth TWS Earbuds (42H Playtime, Low Latency)",
      platform: "Amazon",
      ...resolveProductLink("amazon", "boAt Airdopes 141"),
      linkType: "platform_search",
      price: 1299,
      deliveryFee: 0,
      deliveryEta: "Tomorrow by 2 PM",
      rating: 4.2,
      reviewCount: 128450,
      seller: "Appario Retail India",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 92,
      redFlags: [],
      whyPicked:
        "Top-selling budget earbuds with over 1.2 lakh verified reviews and dependable next-day delivery.",
    },
    {
      id: "mock-earbuds-oneplus-nord-2r",
      title: "OnePlus Nord Buds 2r True Wireless with Dual Mic & BassWave",
      platform: "Flipkart",
      ...resolveProductLink("flipkart", "OnePlus Nord Buds 2r"),
      linkType: "platform_search",
      price: 1799,
      deliveryFee: 40,
      deliveryEta: "2 days",
      rating: 4.4,
      reviewCount: 48210,
      seller: "Flashstar Commerce (F-Assured)",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 94,
      redFlags: [],
      whyPicked:
        "Best overall sound quality, punchy bass, and brand reliability under ₹2,000.",
    },
    {
      id: "mock-earbuds-noise-vs102-blinkit",
      title: "Noise Buds VS102 with 50H Playtime & Instacharge",
      platform: "Blinkit",
      ...resolveProductLink("blinkit", "Noise Buds VS102"),
      linkType: "platform_search",
      price: 1099,
      deliveryFee: 15,
      deliveryEta: "12 minutes",
      rating: 4.1,
      reviewCount: 3420,
      seller: "Supercom Retail Darkstore",
      sellerVerified: true,
      returnPolicy: "Instant replacement on delivery if damaged",
      image: "/placeholder-product.svg",
      trustScore: 88,
      redFlags: [],
      whyPicked:
        "Fastest delivery option available in just 12 minutes when urgency is paramount.",
    },
    {
      id: "mock-earbuds-boat-170-zepto",
      title: "boAt Airdopes 170 TWS with Quad Mics ENx Tech",
      platform: "Zepto",
      ...resolveProductLink("zepto", "boAt Airdopes 170"),
      linkType: "platform_search",
      price: 1499,
      deliveryFee: 25,
      deliveryEta: "10 minutes",
      rating: 4.3,
      reviewCount: 1980,
      seller: "Zepto Express Hub",
      sellerVerified: true,
      returnPolicy: "Doorstep verification and return",
      image: "/placeholder-product.svg",
      trustScore: 90,
      redFlags: [],
      whyPicked:
        "Ultra-fast 10-minute delivery with dedicated quad microphones for clean call audio.",
    },
    {
      id: "mock-earbuds-realme-t110-croma",
      title: "realme Buds T110 In-Ear Truly Wireless Earbuds with AI ENC",
      platform: "Croma",
      ...resolveProductLink("croma", "realme Buds T110"),
      linkType: "platform_search",
      price: 1499,
      deliveryFee: 0,
      deliveryEta: "Same day store pickup or 24h delivery",
      rating: 4.3,
      reviewCount: 1290,
      seller: "Tata Croma Official",
      sellerVerified: true,
      returnPolicy: "14-day store return or replacement",
      image: "/placeholder-product.svg",
      trustScore: 95,
      redFlags: [],
      whyPicked:
        "Backed by official Tata Croma retail guarantee with convenient in-store support.",
    },
    {
      id: "mock-earbuds-boult-z40",
      title: "Boult Audio Z40 Ultra 32dB ANC Earbuds with 100H Battery",
      platform: "Amazon",
      ...resolveProductLink("amazon", "Boult Audio Z40 Ultra"),
      linkType: "platform_search",
      price: 1699,
      deliveryFee: 0,
      deliveryEta: "Tomorrow by 6 PM",
      rating: 4.2,
      reviewCount: 31500,
      seller: "RetailNet Electronics",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 91,
      redFlags: [],
      whyPicked:
        "Exceptional 100-hour battery stamina with entry-level Active Noise Cancellation.",
    },
    {
      id: "mock-earbuds-ptron-duo",
      title: "pTron Bassbuds Duo with HD Mic & Touch Controls",
      platform: "Flipkart",
      ...resolveProductLink("flipkart", "pTron Bassbuds Duo"),
      linkType: "platform_search",
      price: 799,
      deliveryFee: 40,
      deliveryEta: "3 days",
      rating: 3.9,
      reviewCount: 21400,
      seller: "TruStore Online",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 82,
      redFlags: ["Long-term plastic durability scored lower in recent reviews"],
      whyPicked: "Most affordable sub-₹1,000 backup option.",
    },
    {
      // Deliberately suspicious product to test fraud detection
      id: "mock-earbuds-suspicious-fake",
      title: "Apple AirPods Pro (2nd Gen) Wireless ANC [Sealed Export Box]",
      platform: "Amazon",
      ...resolveProductLink("amazon", "Apple AirPods Pro 2nd Gen"),
      linkType: "platform_search",
      price: 499,
      deliveryFee: 99,
      deliveryEta: "6 to 10 days",
      rating: 5.0,
      reviewCount: 4,
      seller: "QuickDeal SuperTrader 88",
      sellerVerified: false,
      returnPolicy: "No return, no replacement",
      image: "/placeholder-product.svg",
      trustScore: 22,
      redFlags: [
        "Price of ₹499 is dangerously below authentic market price (₹19,000+)",
        "Only 4 total reviews, all suspiciously perfect 5.0 stars within 48 hours",
        "Unverified third-party seller with recent account creation",
        "Strict 'No return, no refund' policy",
      ],
      whyPicked:
        "CRITICAL ALERT: Extreme counterfeit risk and probable scam listing.",
    },
  ];
}

function getPhoneProducts(): Product[] {
  return [
    {
      id: "mock-phone-moto-g64",
      title: "Motorola G64 5G (Mint Green, 128 GB, 8 GB RAM)",
      platform: "Flipkart",
      ...resolveProductLink("flipkart", "Moto G64 5G"),
      linkType: "platform_search",
      price: 13999,
      deliveryFee: 0,
      deliveryEta: "Tomorrow by 5 PM",
      rating: 4.3,
      reviewCount: 38900,
      seller: "OmniTech Retail F-Assured",
      sellerVerified: true,
      returnPolicy: "7-day service center replacement",
      image: "/placeholder-product.svg",
      trustScore: 93,
      redFlags: [],
      whyPicked:
        "Best overall phone under ₹15,000 with clean stock Android, 6000mAh battery, and OIS camera.",
    },
    {
      id: "mock-phone-samsung-m15",
      title: "Samsung Galaxy M15 5G (Blue Topaz, 6GB RAM, 128GB Storage)",
      platform: "Amazon",
      ...resolveProductLink("amazon", "Samsung Galaxy M15 5G"),
      linkType: "platform_search",
      price: 12499,
      deliveryFee: 0,
      deliveryEta: "Tomorrow by 1 PM",
      rating: 4.2,
      reviewCount: 22100,
      seller: "STPL Exclusive Online",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 94,
      redFlags: [],
      whyPicked:
        "Super AMOLED 90Hz display, 4 OS upgrades promised, and massive 6000mAh battery.",
    },
    {
      id: "mock-phone-narzo-70x",
      title: "realme Narzo 70x 5G (Forest Green, 6GB RAM, 128GB Storage)",
      platform: "Amazon",
      ...resolveProductLink("amazon", "realme Narzo 70x 5G"),
      linkType: "platform_search",
      price: 11999,
      deliveryFee: 0,
      deliveryEta: "Tomorrow by 8 PM",
      rating: 4.2,
      reviewCount: 15400,
      seller: "Darshita Electronics",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 90,
      redFlags: [],
      whyPicked: "Fastest 45W charging in this segment with smooth 120Hz display.",
    },
    {
      id: "mock-phone-vivo-t3x-croma",
      title: "Vivo T3x 5G (Crimson Bliss, 128 GB, 6 GB RAM)",
      platform: "Croma",
      ...resolveProductLink("croma", "Vivo T3x 5G"),
      linkType: "platform_search",
      price: 13499,
      deliveryFee: 0,
      deliveryEta: "Same day store pickup or 24h delivery",
      rating: 4.4,
      reviewCount: 8200,
      seller: "Tata Croma Direct",
      sellerVerified: true,
      returnPolicy: "14-day store support",
      image: "/placeholder-product.svg",
      trustScore: 95,
      redFlags: [],
      whyPicked:
        "Fast Snapdragon 6 Gen 1 chipset with Tata Croma official warranty network.",
    },
    {
      id: "mock-phone-poco-m6-pro",
      title: "POCO M6 Pro 5G (Power Black, 128 GB, 6 GB RAM)",
      platform: "Flipkart",
      ...resolveProductLink("flipkart", "POCO M6 Pro 5G"),
      linkType: "platform_search",
      price: 9999,
      deliveryFee: 49,
      deliveryEta: "2 days",
      rating: 4.1,
      reviewCount: 52000,
      seller: "Flashstar Commerce",
      sellerVerified: true,
      returnPolicy: "7-day replacement",
      image: "/placeholder-product.svg",
      trustScore: 89,
      redFlags: [],
      whyPicked:
        "Most affordable glass back 5G phone well under ₹10,000 for budget shoppers.",
    },
    {
      id: "mock-phone-redmi-13c-blinkit",
      title: "Redmi 13C 5G (Starfrost Green, 4GB RAM, 128GB Storage)",
      platform: "Blinkit",
      ...resolveProductLink("blinkit", "Redmi 13C 5G"),
      linkType: "platform_search",
      price: 10499,
      deliveryFee: 20,
      deliveryEta: "15 minutes",
      rating: 4.0,
      reviewCount: 420,
      seller: "Blinkit Electronics Darkstore",
      sellerVerified: true,
      returnPolicy: "Doorstep inspection on delivery",
      image: "/placeholder-product.svg",
      trustScore: 88,
      redFlags: [],
      whyPicked: "Emergency instant 15-minute phone delivery when yours is broken.",
    },
    {
      id: "mock-phone-iqoo-z9x-zepto",
      title: "iQOO Z9x 5G (Storm Grey, 6GB RAM, 128GB Storage)",
      platform: "Zepto",
      ...resolveProductLink("zepto", "iQOO Z9x 5G"),
      linkType: "platform_search",
      price: 12999,
      deliveryFee: 30,
      deliveryEta: "12 minutes",
      rating: 4.3,
      reviewCount: 890,
      seller: "Zepto Hub Mumbai",
      sellerVerified: true,
      returnPolicy: "Doorstep verification",
      image: "/placeholder-product.svg",
      trustScore: 91,
      redFlags: [],
      whyPicked: "Ultra-fast 12-minute delivery for a power-packed Snapdragon 6 Gen 1 phone.",
    },
    {
      // Deliberately suspicious phone product
      id: "mock-phone-suspicious-iphone",
      title: "Apple iPhone 15 Pro Max (256 GB) - Natural Titanium [Factory Surplus]",
      platform: "Amazon",
      ...resolveProductLink("amazon", "iPhone 15 Pro Max Natural Titanium"),
      linkType: "platform_search",
      price: 3499,
      deliveryFee: 150,
      deliveryEta: "7 to 14 days",
      rating: 5.0,
      reviewCount: 4,
      seller: "GlobalImports_LuxuryStore",
      sellerVerified: false,
      returnPolicy: "No return, no replacement",
      image: "/placeholder-product.svg",
      trustScore: 18,
      redFlags: [
        "Price of ₹3,499 is 97% lower than actual market price (₹1,40,000+)",
        "Only 4 reviews total, all 5.0 stars with copied generic comments",
        "Unverified overseas seller with hidden business credentials",
        "Requests WhatsApp confirmation for shipping payment",
      ],
      whyPicked:
        "CRITICAL FRAUD WARNING: Severe counterfeit and advance-fee scam listing.",
    },
  ];
}

/**
 * Searches across the mock product catalog.
 * Supports filters for maxPrice, minRating, and urgency.
 */
export async function searchProducts(
  args: SearchProductsArgs
): Promise<Product[]> {
  const queryLower = args.query.toLowerCase();

  // Route to phone dataset if query mentions phone/mobile, otherwise default to earbuds/tech
  const isPhoneQuery =
    queryLower.includes("phone") ||
    queryLower.includes("mobile") ||
    queryLower.includes("फोन") ||
    queryLower.includes("मोबाइल") ||
    queryLower.includes("smartphone");

  let products = isPhoneQuery ? getPhoneProducts() : getEarbudProducts();

  // Filter by maxPrice
  if (typeof args.maxPrice === "number" && args.maxPrice > 0) {
    products = products.filter(
      (p) => typeof p.price === "number" && p.price <= args.maxPrice!
    );
  }

  // Filter by minRating
  if (typeof args.minRating === "number" && args.minRating > 0) {
    products = products.filter(
      (p) => typeof p.rating === "number" && p.rating >= args.minRating!
    );
  }

  // Handle urgency: prioritize 10min quick-commerce if requested
  if (args.urgency === "10min") {
    products = [...products].sort((a, b) => {
      const aQuick = a.deliveryEta?.includes("min") ? 1 : 0;
      const bQuick = b.deliveryEta?.includes("min") ? 1 : 0;
      return bQuick - aQuick;
    });
  }

  return products;
}
