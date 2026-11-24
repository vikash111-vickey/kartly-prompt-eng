import { ALLOWED_DOMAINS } from "@/lib/links";

export type SafetyVerdict = "looks_ok" | "be_careful" | "likely_scam";

export interface SafetyCheckItem {
  name: string;
  passed: boolean;
  note: string;
}

export interface SafetyCheckResult {
  verdict: SafetyVerdict;
  reasons: string[];
  checks: SafetyCheckItem[];
  scannedUrl?: string;
}

// Known URL shortener domains
const SHORTENED_DOMAINS = new Set([
  "bit.ly",
  "tinyurl.com",
  "t.co",
  "cutt.ly",
  "is.gd",
  "rb.gy",
  "goo.gl",
  "ow.ly",
  "rebrand.ly",
  "rotf.lol",
  "shorturl.at",
  "buff.ly",
]);

// Suspicious / high-risk top-level domain extensions
const SUSPICIOUS_TLDS = [
  ".xyz",
  ".top",
  ".click",
  ".shop",
  ".site",
  ".online",
  ".club",
  ".work",
  ".vip",
  ".loan",
  ".racing",
  ".win",
];

// Well-known Indian e-commerce brand roots
const KNOWN_BRANDS = [
  "amazon",
  "flipkart",
  "croma",
  "reliancedigital",
  "myntra",
  "ajio",
  "nykaa",
  "tatacliq",
  "alibaba",
  "aliexpress",
  "blinkit",
  "zepto",
  "zeptonow",
  "bigbasket",
  "swiggy",
  "meesho",
  "snapdeal",
];

/**
 * Calculates the Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }
  return dp[m][n];
}

/**
 * Normalizes common leetspeak substitutions (e.g. 0 -> o, 1 -> l/i).
 */
function normalizeLeetspeak(str: string): string {
  return str
    .replace(/0/g, "o")
    .replace(/1/g, "l")
    .replace(/3/g, "e")
    .replace(/5/g, "s")
    .replace(/@/g, "a")
    .replace(/vv/g, "w");
}

/**
 * Checks whether a hostname is a raw IPv4 or IPv6 address.
 */
function isIpAddress(hostname: string): boolean {
  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4Regex.test(hostname)) return true;

  const cleanHost = hostname.replace(/^\[|\]$/g, "");
  const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  return ipv6Regex.test(cleanHost);
}

/**
 * Extracts candidate URLs from the input text.
 */
function extractUrls(input: string): string[] {
  const urlRegex =
    /(?:https?:\/\/|www\.)[^\s<>"'{}|\\^`]+|[a-zA-Z0-9-]+\.(?:com|in|org|net|xyz|top|click|shop|site|online|co|info|biz|club|work|vip)(?:\/[^\s<>"'{}|\\^`]*)?/gi;
  const matches = input.match(urlRegex) || [];
  return matches.map((m) => {
    if (!/^https?:\/\//i.test(m)) {
      return `http://${m}`;
    }
    return m;
  });
}

/**
 * Checks if a hostname matches an allowed domain directly or as an authorized subdomain.
 */
function isAllowedDomain(hostname: string): boolean {
  for (const allowed of ALLOWED_DOMAINS) {
    if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
      return true;
    }
  }
  return false;
}

/**
 * Detects look-alike / typosquatting / brand impersonation domains.
 */
function checkLookAlike(hostname: string): { isLookAlike: boolean; brand?: string; note?: string } {
  // If it's already an authorized official domain or subdomain, it's not a lookalike
  if (isAllowedDomain(hostname)) {
    return { isLookAlike: false };
  }

  // 1. Subdomain impersonation / evil domain trick:
  // e.g. amazon.in.evil.com or flipkart.com.attacker.site
  for (const allowed of ALLOWED_DOMAINS) {
    if (hostname.includes(allowed) && !hostname.endsWith(`.${allowed}`) && hostname !== allowed) {
      return {
        isLookAlike: true,
        brand: allowed,
        note: `Contains "${allowed}" as a deceitful subdomain on an untrusted root domain`,
      };
    }
  }

  // Extract domain parts: e.g. "amaz0n-offers.in" -> labels ["amaz0n-offers", "in"]
  const parts = hostname.split(".");
  // Main domain label is usually parts[parts.length - 2] (or parts[0] if single)
  const mainLabel = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
  const normalizedMain = normalizeLeetspeak(mainLabel);

  // 2. Check if main label contains a known brand combined with hyphens/words/digits
  // e.g. "amaz0n-offers", "flipkart-deals", "amazon-sale"
  for (const brand of KNOWN_BRANDS) {
    const brandRegex = new RegExp(`\\b${brand}\\b|[-_]${brand}|${brand}[-_]`, "i");
    if (brandRegex.test(mainLabel) || brandRegex.test(normalizedMain)) {
      return {
        isLookAlike: true,
        brand,
        note: `Impersonates "${brand}" with deceptive extra words or hyphens`,
      };
    }

    // Check individual hyphenated segments: e.g. "amaz0n" from "amaz0n-offers"
    const subWords = mainLabel.split(/[-_0-9]+/);
    for (const word of subWords) {
      if (!word) continue;
      const normalizedWord = normalizeLeetspeak(word);

      // Exact match after leetspeak normalization
      if (normalizedWord === brand && word !== brand) {
        return {
          isLookAlike: true,
          brand,
          note: `Uses character substitutions mimicking "${brand}"`,
        };
      }

      // Edit distance 1-2 check
      const dist = levenshtein(word, brand);
      const normalizedDist = levenshtein(normalizedWord, brand);
      if ((dist >= 1 && dist <= 2) || (normalizedDist >= 1 && normalizedDist <= 2)) {
        if (word.length >= 4 && Math.abs(word.length - brand.length) <= 2) {
          return {
            isLookAlike: true,
            brand,
            note: `Typosquatting variant of official brand "${brand}" (edit distance: ${Math.min(dist, normalizedDist)})`,
          };
        }
      }
    }

    // Direct edit distance on whole main label (e.g. "amaz0n" vs "amazon")
    const wholeDist = levenshtein(mainLabel, brand);
    const wholeNormDist = levenshtein(normalizedMain, brand);
    if (
      (wholeDist >= 1 && wholeDist <= 2 && mainLabel.length >= 4) ||
      (wholeNormDist === 0 && mainLabel !== brand) ||
      (wholeNormDist >= 1 && wholeNormDist <= 2 && mainLabel.length >= 4)
    ) {
      return {
        isLookAlike: true,
        brand,
        note: `Direct look-alike typosquatting of "${brand}"`,
      };
    }
  }

  return { isLookAlike: false };
}

/**
 * Critical scam phrase patterns (Result in "likely_scam").
 */
const CRITICAL_SCAM_PATTERNS: { name: string; regex: RegExp; reason: string }[] = [
  {
    name: "OTP solicitation",
    regex:
      /\b(?:send\s*otp|share\s*otp|give\s*otp|provide\s*otp|forward\s*otp|enter\s*otp|tell\s*otp|otp\s*bhejo|otp\s*batao|otp\s*send|otp\s*share|otp\s*de\s*do|otp\s*sollunga)\b|ओटीपी\s*(?:भेजो|शेयर|बताओ|दें|दीजिए)?|ओटीपी|ஓடிபி/iu,
    reason: "Requests confidential OTP verification codes, a hallmark of credential and account takeover scams.",
  },
  {
    name: "Advance payment via UPI / direct transfer",
    regex:
      /\b(?:pay\s*(?:advance|\d+)\s*(?:to\s*this\s*|via\s*)?upi|send\s*(?:advance|\d+)\s*to\s*upi|upi\s*id\b|upi\s*number\b|gpay\s*(?:karo|number)|phonepe\s*(?:karo|number)|paytm\s*(?:karo|number)|is\s*upi\s*pe\b|upi\s*pe\s*bhejo|advance\s*(?:paise|amount|500|1000)\s*(?:bhejo|do))\b|एडवांस\s*(?:भेजो|पेमेंट|पैसे)|यूपीआई|पेटीएम|गूगल\s*पे|போன்பே|யுபிஐ/iu,
    reason: "Instructs direct advance payment to a personal UPI ID or mobile number outside platform checkout.",
  },
];

/**
 * Cautionary scam phrase patterns (Result in "be_careful").
 */
const CAUTIONARY_SCAM_PATTERNS: { name: string; regex: RegExp; reason: string }[] = [
  {
    name: "Advance payment request",
    regex:
      /\b(?:advance\s*payment|pay\s*advance|adv\s*payment|advance\s*deposit|pehla\s*advance|munpanam)\b|முன்பணம்|अग्रिम\s*भुगतान|एडवांस/iu,
    reason: "Asks for advance payment before delivery or order fulfillment.",
  },
  {
    name: "Gift card payment",
    regex:
      /\b(?:gift\s*card\s*(?:payment|pay|se)|pay\s*via\s*gift\s*card|amazon\s*gift\s*voucher|flipkart\s*gift\s*voucher)\b|गिफ्ट\s*कार्ड|பரிசு\s*அட்டை/iu,
    reason: "Requests payment using non-refundable gift cards.",
  },
  {
    name: "Off-platform WhatsApp communication",
    regex:
      /\b(?:whatsapp\s*only|contact\s*(?:me\s*)?on\s*whatsapp|dm\s*on\s*whatsapp|whatsapp\s*par\s*baat|whatsapp\s*pe\s*message)\b|व्हाट्सएप\s*(?:पर)?|வாட்ஸ்அப்/iu,
    reason: "Directs buyer off-platform to WhatsApp where buyer protection is nonexistent.",
  },
  {
    name: "Artificial urgency",
    regex:
      /\b(?:only\s*today\s*pay\s*now|pay\s*now\s*or\s*deal\s*expires|hurry\s*pay\s*now|sirf\s*aaj\s*ke\s*liye|aaj\s*hi\s*pay\s*karo|abhi\s*transfer\s*karo)\b|तुरंत\s*पे|इன்றே\s*பணம்\s*செலுத்துங்கள்/iu,
    reason: "Pressures user with false artificial urgency to bypass critical safety precautions.",
  },
  {
    name: "Lottery or prize winning",
    regex:
      /\b(?:lottery\b|you\s*won\b|lucky\s*winner|congratulations\s*you\s*(?:have\s*)?won|cash\s*prize)\b|लॉटरी|जीत\s*गए|इनाम|बधाई\s*हो|பரிசு|லாட்டரி/iu,
    reason: "Claims unexpected lottery wins or free prizes, commonly used as advance-fee bait.",
  },
  {
    name: "Refundable deposit claim",
    regex:
      /\b(?:refundable\s*deposit|security\s*deposit|deposit\s*will\s*be\s*refunded|refund\s*ho\s*jayega)\b|रिफंडेबल\s*डिपॉजिट|रिफंड\s*हो\s*जाएगा|செக்யூரிட்டி\s*டெபாசிட்/iu,
    reason: "Demands a 'refundable deposit' or security fee before releasing goods or prizes.",
  },
  {
    name: "Off-platform payment",
    regex:
      /\b(?:pay\s*outside\b|outside\s*payment|platform\s*ke\s*bahar|bahar\s*pay\s*karo|direct\s*account\s*me|off-platform)\b|प्लेटफॉर्म\s*के\s*बाहर|நேரடி\s*கட்டணம்/iu,
    reason: "Explicitly requests payment outside the verified e-commerce marketplace.",
  },
  {
    name: "Courier charge in advance",
    regex:
      /\b(?:courier\s*charge\s*(?:before\s*delivery|advance)?|delivery\s*charge\s*in\s*advance|parcel\s*charge|delivery\s*se\s*pehle\s*courier)\b|कुरियर\s*चार्ज|पार्सल\s*चार्ज|டெலிவரி\s*கட்டணம்/iu,
    reason: "Demands upfront courier or parcel fees before sending the purchased item.",
  },
];

/**
 * Evaluates a user text or pasted link for fraudulent indicators, look-alikes, and scam tactics.
 * Pure code: performs no network calls and never fetches the URL.
 * Does not log user input.
 */
export function checkLinkOrText(input: string): SafetyCheckResult {
  if (!input || !input.trim()) {
    return {
      verdict: "looks_ok",
      reasons: ["No text or link provided."],
      checks: [
        {
          name: "Content evaluation",
          passed: true,
          note: "No red flags found in these checks. This is not a guarantee.",
        },
      ],
    };
  }

  const checks: SafetyCheckItem[] = [];
  const reasons: string[] = [];
  let isLikelyScam = false;
  let isBeCareful = false;

  const candidateUrls = extractUrls(input);
  const primaryUrl = candidateUrls[0];

  // ==========================================
  // 1. URL-BASED CHECKS
  // ==========================================
  if (primaryUrl) {
    try {
      const parsed = new URL(primaryUrl);
      const hostname = parsed.hostname.toLowerCase();
      const pathname = parsed.pathname.toLowerCase();

      // Check A: HTTPS Encryption
      const hasHttps = parsed.protocol === "https:";
      checks.push({
        name: "HTTPS encryption",
        passed: hasHttps,
        note: hasHttps
          ? "Uses secure HTTPS encryption."
          : "Insecure HTTP connection (HTTPS is required for safe shopping).",
      });
      if (!hasHttps) {
        reasons.push("The website does not use secure HTTPS encryption.");
        isBeCareful = true;
      }

      // Check B: IP Address Hostname
      const isIp = isIpAddress(hostname);
      checks.push({
        name: "IP address hostname",
        passed: !isIp,
        note: !isIp
          ? "Uses standard branded domain name."
          : "Uses a raw numeric IP address instead of a domain name.",
      });
      if (isIp) {
        reasons.push("The link uses a raw IP address instead of a legitimate domain name.");
        isLikelyScam = true;
      }

      // Check C: Punycode Spoofing
      const isPunycode = hostname.startsWith("xn--") || hostname.includes(".xn--");
      checks.push({
        name: "Punycode character spoofing",
        passed: !isPunycode,
        note: !isPunycode
          ? "Standard ASCII domain characters."
          : "Punycode encoding detected (often used for character spoofing/homographs).",
      });
      if (isPunycode) {
        reasons.push("The domain uses Punycode encoding, a common tactic for disguised look-alike sites.");
        isLikelyScam = true;
      }

      // Check D: Look-alike / Brand Impersonation
      const lookAlike = checkLookAlike(hostname);
      checks.push({
        name: "Look-alike brand impersonation",
        passed: !lookAlike.isLookAlike,
        note: !lookAlike.isLookAlike
          ? "No brand impersonation detected."
          : lookAlike.note || "Suspicious look-alike impersonating a known shopping brand.",
      });
      if (lookAlike.isLookAlike) {
        reasons.push(`The domain mimics popular brand "${lookAlike.brand}" using look-alike spelling or deceptive subdomains.`);
        isLikelyScam = true;
      }

      // Check E: Known URL Shortener
      const isShortener = SHORTENED_DOMAINS.has(hostname);
      checks.push({
        name: "URL shortener detection",
        passed: !isShortener,
        note: !isShortener
          ? "Direct store address (not a hidden shortened link)."
          : "URL shortener hides the true destination address.",
      });
      if (isShortener) {
        reasons.push("The link uses a URL shortener which conceals the destination website.");
        isBeCareful = true;
      }

      // Check F: Suspicious High-Risk TLD
      const hasSuspiciousTld =
        SUSPICIOUS_TLDS.some((tld) => hostname.endsWith(tld)) && !isAllowedDomain(hostname);
      checks.push({
        name: "Domain extension reputation",
        passed: !hasSuspiciousTld,
        note: !hasSuspiciousTld
          ? "Domain extension is standard or verified."
          : "Uses high-risk domain extension frequently linked to disposable scam stores.",
      });
      if (hasSuspiciousTld) {
        reasons.push("The website uses an unusual domain extension frequently associated with fraudulent store fronts.");
        isBeCareful = true;
      }

      // Check G: Excessive Hyphens or Digits
      const hyphenCount = (hostname.match(/-/g) || []).length;
      const digitCount = (hostname.match(/\d/g) || []).length;
      const hasExcessiveComplexity = hyphenCount >= 3 || digitCount >= 4;
      checks.push({
        name: "Domain name complexity",
        passed: !hasExcessiveComplexity,
        note: !hasExcessiveComplexity
          ? "Domain format is clean."
          : "Unusually high number of hyphens or digits in domain name.",
      });
      if (hasExcessiveComplexity && !isAllowedDomain(hostname)) {
        reasons.push("Domain name contains an abnormal number of hyphens or digits.");
        isBeCareful = true;
      }

      // Check H: Sensitive Login/Verification/KYC Path on Non-Allowed Domain
      const hasSensitivePath =
        /\/(login|signin|verify|kyc|auth|account|authenticate|wallet|upi)\b/i.test(pathname);
      const isAllowed = isAllowedDomain(hostname);
      checks.push({
        name: "Sensitive path security",
        passed: !hasSensitivePath || isAllowed,
        note: !hasSensitivePath || isAllowed
          ? "No suspicious login or verification path detected on unauthorized domain."
          : "Phishing risk: non-official domain hosting login, KYC, or payment verification.",
      });
      if (hasSensitivePath && !isAllowed) {
        reasons.push("The non-verified link requests sensitive login, account, or KYC verification details.");
        isLikelyScam = true;
      }

      // Check I: Official Store Domain Status
      checks.push({
        name: "Verified store domain",
        passed: isAllowed,
        note: isAllowed
          ? `Matches verified Indian shopping platform (${hostname}).`
          : "Not an officially verified e-commerce marketplace domain.",
      });
      if (!isAllowed && !isLikelyScam) {
        isBeCareful = true;
      }
    } catch {
      // URL parsing failed
      checks.push({
        name: "URL structure validity",
        passed: false,
        note: "Malformed URL structure.",
      });
      reasons.push("The provided link could not be parsed as a valid web address.");
      isBeCareful = true;
    }
  }

  // ==========================================
  // 2. TEXT-BASED SCAM PHRASE CHECKS
  // ==========================================
  // Check Critical Phrases (OTP, UPI advance)
  for (const pattern of CRITICAL_SCAM_PATTERNS) {
    if (pattern.regex.test(input)) {
      checks.push({
        name: pattern.name,
        passed: false,
        note: pattern.reason,
      });
      reasons.push(pattern.reason);
      isLikelyScam = true;
    }
  }

  // Check Cautionary Phrases
  for (const pattern of CAUTIONARY_SCAM_PATTERNS) {
    if (pattern.regex.test(input)) {
      checks.push({
        name: pattern.name,
        passed: false,
        note: pattern.reason,
      });
      reasons.push(pattern.reason);
      isBeCareful = true;
    }
  }

  // ==========================================
  // 3. FINAL VERDICT COMPUTATION
  // ==========================================
  let verdict: SafetyVerdict;
  if (isLikelyScam) {
    verdict = "likely_scam";
  } else if (isBeCareful) {
    verdict = "be_careful";
  } else {
    verdict = "looks_ok";
  }

  if (verdict === "looks_ok") {
    checks.push({
      name: "Safety evaluation summary",
      passed: true,
      note: "No red flags found in these checks. This is not a guarantee.",
    });
  }

  // Deduplicate reasons
  const uniqueReasons = Array.from(new Set(reasons));

  return {
    verdict,
    reasons: uniqueReasons,
    checks,
    scannedUrl: primaryUrl,
  };
}
