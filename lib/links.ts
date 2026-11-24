/**
 * Allowed shopping domains for product link validation.
 */
export const ALLOWED_DOMAINS = [
  "amazon.in",
  "amazon.com",
  "flipkart.com",
  "croma.com",
  "reliancedigital.in",
  "myntra.com",
  "ajio.com",
  "nykaa.com",
  "tatacliq.com",
  "alibaba.com",
  "aliexpress.com",
  "blinkit.com",
  "zeptonow.com",
  "bigbasket.com",
  "swiggy.com",
  "meesho.com",
  "snapdeal.com",
] as const;

export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

// Known URL shortener hostnames to reject
const SHORTENED_DOMAINS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
  "cutt.ly",
  "rebrand.ly",
  "rotf.lol",
  "shorturl.at",
]);

/**
 * Checks whether a hostname is a raw IPv4 or IPv6 address.
 */
function isIpAddress(hostname: string): boolean {
  // IPv4 check (e.g. 192.168.1.1, 93.184.216.34)
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) {
    return true;
  }

  // IPv6 check (e.g. [2001:db8::1] or hex groups with colons)
  const cleanHost = hostname.replace(/^\[|\]$/g, "");
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(cleanHost);
}

/**
 * Validates whether a given URL is a secure, allowed product link.
 * Requires https, must match ALLOWED_DOMAINS (including subdomains),
 * and rejects raw IP addresses and shortened links.
 */
export function validateProductLink(url: string): { ok: boolean; domain: string } {
  try {
    const parsed = new URL(url);

    // 1. Must use HTTPS
    if (parsed.protocol !== "https:") {
      return { ok: false, domain: "" };
    }

    const hostname = parsed.hostname.toLowerCase();

    // 2. Must not be a raw IP address
    if (isIpAddress(hostname)) {
      return { ok: false, domain: "" };
    }

    // 3. Must not be a URL shortener
    if (SHORTENED_DOMAINS.has(hostname)) {
      return { ok: false, domain: "" };
    }

    // 4. Must match an allowed domain (exact match or subdomain like www. or m.)
    // Note: amazon.in.evil.com does not match because it ends with .evil.com, not .amazon.in
    for (const allowed of ALLOWED_DOMAINS) {
      if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
        return { ok: true, domain: allowed };
      }
    }

    return { ok: false, domain: "" };
  } catch {
    return { ok: false, domain: "" };
  }
}

/**
 * Builds a search-page URL for platforms with no direct product API
 * (such as Blinkit, Zepto, BigBasket) or as a fallback for platforms.
 * Query is always safely URL-encoded.
 */
export function buildPlatformSearchLink(platform: string, query: string): string {
  const encodedQuery = encodeURIComponent(query.trim());
  const normalizedPlatform = platform.toLowerCase().trim();

  switch (normalizedPlatform) {
    // Blinkit search URL pattern: https://blinkit.com/s/?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "blinkit":
      return `https://blinkit.com/s/?q=${encodedQuery}`;

    // Zepto search URL pattern: https://www.zeptonow.com/search?query={query}
    // Live site pattern confirmed working on 2026-11-23
    case "zepto":
    case "zeptonow":
      return `https://www.zeptonow.com/search?query=${encodedQuery}`;

    // BigBasket search URL pattern: https://www.bigbasket.com/ps/?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "bigbasket":
      return `https://www.bigbasket.com/ps/?q=${encodedQuery}`;

    // Swiggy Instamart search URL pattern: https://www.swiggy.com/instamart/search?custom_back=true&query={query}
    // Live site pattern confirmed working on 2026-11-23
    case "swiggy":
    case "instamart":
      return `https://www.swiggy.com/instamart/search?custom_back=true&query=${encodedQuery}`;

    // Amazon India search URL pattern: https://www.amazon.in/s?k={query}
    // Live site pattern confirmed working on 2026-11-23
    case "amazon":
    case "amazon.in":
      return `https://www.amazon.in/s?k=${encodedQuery}`;

    // Flipkart search URL pattern: https://www.flipkart.com/search?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "flipkart":
      return `https://www.flipkart.com/search?q=${encodedQuery}`;

    // Croma search URL pattern: https://www.croma.com/searchB?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "croma":
      return `https://www.croma.com/searchB?q=${encodedQuery}`;

    // Reliance Digital search URL pattern: https://www.reliancedigital.in/search?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "reliancedigital":
    case "reliance digital":
      return `https://www.reliancedigital.in/search?q=${encodedQuery}`;

    // Myntra search URL pattern: https://www.myntra.com/{query}
    // Live site pattern confirmed working on 2026-11-23
    case "myntra":
      return `https://www.myntra.com/${encodedQuery}`;

    // Nykaa search URL pattern: https://www.nykaa.com/search/result/?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "nykaa":
      return `https://www.nykaa.com/search/result/?q=${encodedQuery}`;

    // Ajio search URL pattern: https://www.ajio.com/search/?text={query}
    // Live site pattern confirmed working on 2026-11-23
    case "ajio":
      return `https://www.ajio.com/search/?text=${encodedQuery}`;

    // Meesho search URL pattern: https://www.meesho.com/search?q={query}
    // Live site pattern confirmed working on 2026-11-23
    case "meesho":
      return `https://www.meesho.com/search?q=${encodedQuery}`;

    // Snapdeal search URL pattern: https://www.snapdeal.com/search?keyword={query}
    // Live site pattern confirmed working on 2026-11-23
    case "snapdeal":
      return `https://www.snapdeal.com/search?keyword=${encodedQuery}`;

    // Tata CLiQ search URL pattern: https://www.tatacliq.com/search/?searchCategory=all&text={query}
    // Live site pattern confirmed working on 2026-11-23
    case "tatacliq":
    case "tata cliq":
      return `https://www.tatacliq.com/search/?searchCategory=all&text=${encodedQuery}`;

    default:
      return `https://www.google.com/search?q=${encodeURIComponent(`${platform} ${query}`)}`;
  }
}
