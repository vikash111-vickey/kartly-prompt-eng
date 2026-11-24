import { checkLinkOrText, type SafetyVerdict } from "../lib/safety/check";

let passedCount = 0;
let failedCount = 0;

interface TestCase {
  name: string;
  input: string;
  expectedVerdict: SafetyVerdict | SafetyVerdict[];
  description: string;
}

const TEST_CASES: TestCase[] = [
  {
    name: "Case 1: Official Amazon.in product link",
    input: "https://www.amazon.in/dp/B09G9BL5CP?th=1",
    expectedVerdict: "looks_ok",
    description: "Official Amazon product link over HTTPS",
  },
  {
    name: "Case 2: Official Flipkart.com link",
    input: "https://www.flipkart.com/apple-iphone-15/p/itm12345",
    expectedVerdict: "looks_ok",
    description: "Official Flipkart product link over HTTPS",
  },
  {
    name: "Case 3: Typosquatting look-alike (amaz0n-offers.in)",
    input: "http://amaz0n-offers.in/deal",
    expectedVerdict: "likely_scam",
    description: "Look-alike brand impersonation with zero substitution and extra words",
  },
  {
    name: "Case 4: Subdomain trick (amazon.in.evil.com)",
    input: "https://amazon.in.evil.com/login",
    expectedVerdict: "likely_scam",
    description: "Contains allowed domain as deceitful subdomain on evil.com",
  },
  {
    name: "Case 5: Insecure HTTP Flipkart link (http://flipkart.com)",
    input: "http://flipkart.com/item/123",
    expectedVerdict: "be_careful",
    description: "Legitimate domain but insecure HTTP connection",
  },
  {
    name: "Case 6: URL shortener (bit.ly link)",
    input: "https://bit.ly/deal39281",
    expectedVerdict: "be_careful",
    description: "Known URL shortener hiding real destination",
  },
  {
    name: "Case 7: IP address host link",
    input: "http://192.168.1.1/buy-now",
    expectedVerdict: "likely_scam",
    description: "Raw numeric IP address instead of branded domain",
  },
  {
    name: "Case 8: Unknown shop with high-risk TLD (bestdeals-store.xyz)",
    input: "https://bestdeals-store.xyz/products/shoe",
    expectedVerdict: "be_careful",
    description: "Unverified shop with suspicious .xyz domain extension",
  },
  {
    name: "Case 9: OTP solicitation text",
    input: "Please send OTP to confirm your order and claim discount",
    expectedVerdict: "likely_scam",
    description: "Requests confidential OTP verification code",
  },
  {
    name: "Case 10: Advance payment to UPI ID",
    input: "Pay advance 500 to this UPI id merchant@okhdfc to confirm your deal",
    expectedVerdict: "likely_scam",
    description: "Advance fee solicitation via personal UPI ID",
  },
  {
    name: "Case 11: Normal friendly shopping sentence",
    input: "Hi Kartly, can you suggest a comfortable ergonomic office chair for working from home?",
    expectedVerdict: "looks_ok",
    description: "Natural user query with no link and no scam indicators",
  },
  {
    name: "Case 12: Hindi scam phrase (Devanagari)",
    input: "ऑर्डर कन्फर्म करने के लिए तुरंत ओटीपी भेजो नहीं तो आर्डर कैंसिल हो जाएगा",
    expectedVerdict: "likely_scam",
    description: "Urgent OTP solicitation in Hindi script",
  },
  {
    name: "Case 13: Romanized Hindi scam phrase",
    input: "bhai order book karne ke liye is UPI pe advance 500 bhej do",
    expectedVerdict: "likely_scam",
    description: "Hinglish UPI advance payment demand",
  },
  {
    name: "Case 14: Punycode homograph attack",
    input: "https://xn--amzon-1qa.com/offer",
    expectedVerdict: "likely_scam",
    description: "Punycode domain disguised look-alike",
  },
];

console.log("==========================================");
console.log("KARTLY SCAM CHECKER ENGINE TEST SUITE");
console.log("==========================================\n");

for (let i = 0; i < TEST_CASES.length; i++) {
  const tc = TEST_CASES[i];
  const result = checkLinkOrText(tc.input);

  const isMatch = Array.isArray(tc.expectedVerdict)
    ? tc.expectedVerdict.includes(result.verdict)
    : result.verdict === tc.expectedVerdict;

  if (isMatch) {
    console.log(`[PASS] ${tc.name}`);
    console.log(`       Input: "${tc.input.length > 60 ? tc.input.slice(0, 57) + "..." : tc.input}"`);
    console.log(`       Verdict: ${result.verdict} (Expected: ${tc.expectedVerdict})`);
    if (result.reasons.length > 0) {
      console.log(`       Top reason: ${result.reasons[0]}`);
    }
    passedCount++;
  } else {
    console.error(`[FAIL] ${tc.name}`);
    console.error(`       Input: "${tc.input}"`);
    console.error(`       Verdict: ${result.verdict} (Expected: ${tc.expectedVerdict})`);
    console.error(`       Reasons:`, result.reasons);
    console.error(`       Checks:`, result.checks);
    failedCount++;
  }
  console.log("");
}

console.log("==========================================");
console.log(`SUMMARY: ${passedCount} of ${TEST_CASES.length} test cases passed (${failedCount} failed)`);
console.log("==========================================");

if (failedCount > 0) {
  console.error("SAFETY ENGINE TESTS FAILED.");
  process.exit(1);
} else {
  console.log("ALL SAFETY ENGINE TESTS PASSED SUCCESSFULLY.");
  process.exit(0);
}
