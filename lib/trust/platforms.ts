// Editorial estimates for the Kartly project, not official ratings or endorsements.
// Used as one factor in calculating overall merchant trust scores.

export interface PlatformScore {
  score: number;
  reason: string;
}

export const PLATFORM_RELIABILITY: Record<string, PlatformScore> = {
  Amazon: {
    score: 92,
    reason: "Established marketplace with strong A-to-z guarantee and reliable customer support.",
  },
  Flipkart: {
    score: 88,
    reason: "Major Indian marketplace with widespread logistics and structured return policies.",
  },
  Croma: {
    score: 90,
    reason: "Tata-backed electronics specialist with direct manufacturer warranties and physical stores.",
  },
  "Reliance Digital": {
    score: 88,
    reason: "Large authorized retail chain with genuine electronic warranties and in-store service.",
  },
  "Tata CLiQ": {
    score: 85,
    reason: "Tata group luxury and fashion portal selling verified genuine brands.",
  },
  Myntra: {
    score: 87,
    reason: "Flipkart-owned fashion retailer with verified sellers and hassle-free returns.",
  },
  Nykaa: {
    score: 88,
    reason: "Dedicated beauty and wellness platform sourcing directly from authorized brands.",
  },
  BigBasket: {
    score: 89,
    reason: "Tata-owned grocery leader with direct sourcing and reliable delivery windows.",
  },
  Blinkit: {
    score: 85,
    reason: "Zomato-owned quick commerce with local dark stores and immediate resolution.",
  },
  Zepto: {
    score: 84,
    reason: "Rapid quick-commerce network with dedicated local fulfillment centers.",
  },
  Swiggy: {
    score: 85,
    reason: "Established on-demand delivery network with responsive customer resolution.",
  },
  Meesho: {
    score: 65,
    reason: "Reseller marketplace with wide price variance; seller vetting varies.",
  },
  Snapdeal: {
    score: 60,
    reason: "Value marketplace with third-party sellers; quality and return experience vary.",
  },
  Alibaba: {
    score: 55,
    reason: "Wholesale B2B platform with cross-border shipping and varying seller protection.",
  },
  AliExpress: {
    score: 55,
    reason: "Global marketplace with cross-border delivery times and varied dispute outcomes.",
  },
};

export const DEFAULT_PLATFORM_RELIABILITY: PlatformScore = {
  score: 50,
  reason: "Unrated or independent merchant platform; exercise standard caution.",
};

export function getPlatformReliability(platform: string): PlatformScore {
  if (!platform) return DEFAULT_PLATFORM_RELIABILITY;
  
  const clean = platform.trim().toLowerCase();
  
  for (const [key, val] of Object.entries(PLATFORM_RELIABILITY)) {
    if (key.toLowerCase() === clean) {
      return val;
    }
  }

  // Check common aliases
  if (clean.includes("amazon")) return PLATFORM_RELIABILITY["Amazon"];
  if (clean.includes("flipkart")) return PLATFORM_RELIABILITY["Flipkart"];
  if (clean.includes("croma")) return PLATFORM_RELIABILITY["Croma"];
  if (clean.includes("reliance")) return PLATFORM_RELIABILITY["Reliance Digital"];
  if (clean.includes("tatacliq") || clean.includes("tata cliq")) return PLATFORM_RELIABILITY["Tata CLiQ"];
  if (clean.includes("myntra")) return PLATFORM_RELIABILITY["Myntra"];
  if (clean.includes("nykaa")) return PLATFORM_RELIABILITY["Nykaa"];
  if (clean.includes("bigbasket")) return PLATFORM_RELIABILITY["BigBasket"];
  if (clean.includes("blinkit")) return PLATFORM_RELIABILITY["Blinkit"];
  if (clean.includes("zepto")) return PLATFORM_RELIABILITY["Zepto"];
  if (clean.includes("swiggy")) return PLATFORM_RELIABILITY["Swiggy"];
  if (clean.includes("meesho")) return PLATFORM_RELIABILITY["Meesho"];
  if (clean.includes("snapdeal")) return PLATFORM_RELIABILITY["Snapdeal"];
  if (clean.includes("alibaba")) return PLATFORM_RELIABILITY["Alibaba"];
  if (clean.includes("aliexpress")) return PLATFORM_RELIABILITY["AliExpress"];

  return DEFAULT_PLATFORM_RELIABILITY;
}
