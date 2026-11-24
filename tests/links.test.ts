import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateProductLink, buildPlatformSearchLink, ALLOWED_DOMAINS } from "../lib/links";

describe("validateProductLink", () => {
  it("case 1: allows valid Amazon link", () => {
    const res = validateProductLink("https://www.amazon.in/Apple-iPhone-13-128GB/dp/B09G9HD6PD");
    assert.deepEqual(res, { ok: true, domain: "amazon.in" });
  });

  it("case 2: allows valid Flipkart link", () => {
    const res = validateProductLink("https://www.flipkart.com/apple-iphone-13/p/itmca5553adb6431");
    assert.deepEqual(res, { ok: true, domain: "flipkart.com" });
  });

  it("case 3: rejects http (non-https) links", () => {
    const res = validateProductLink("http://www.amazon.in/dp/B09G9HD6PD");
    assert.deepEqual(res, { ok: false, domain: "" });
  });

  it("case 4: rejects unknown / untrusted domains", () => {
    const res = validateProductLink("https://unknown-shop-fake.com/product/123");
    assert.deepEqual(res, { ok: false, domain: "" });
  });

  it("case 5: rejects look-alike domains like amazon.in.evil.com", () => {
    const res = validateProductLink("https://amazon.in.evil.com/phishing-deal");
    assert.deepEqual(res, { ok: false, domain: "" });
  });

  it("case 6: rejects shortened links", () => {
    const bitly = validateProductLink("https://bit.ly/3discountDeal");
    assert.deepEqual(bitly, { ok: false, domain: "" });

    const tinyurl = validateProductLink("https://tinyurl.com/fake-deal");
    assert.deepEqual(tinyurl, { ok: false, domain: "" });
  });

  it("case 7: rejects raw IP addresses", () => {
    const ipv4 = validateProductLink("https://192.168.1.1/product/deal");
    assert.deepEqual(ipv4, { ok: false, domain: "" });

    const publicIp = validateProductLink("https://93.184.216.34/product");
    assert.deepEqual(publicIp, { ok: false, domain: "" });
  });

  it("case 8: allows valid subdomains of allowed platforms", () => {
    const flipkartMobile = validateProductLink("https://m.flipkart.com/product/123");
    assert.deepEqual(flipkartMobile, { ok: true, domain: "flipkart.com" });

    const amazonSmile = validateProductLink("https://smile.amazon.com/dp/B08N5WRWNW");
    assert.deepEqual(amazonSmile, { ok: true, domain: "amazon.com" });

    const cromaSub = validateProductLink("https://stores.croma.com/locator");
    assert.deepEqual(cromaSub, { ok: true, domain: "croma.com" });
  });

  it("case 9: handles malformed URLs gracefully without crashing", () => {
    const malformed = validateProductLink("not a valid url");
    assert.deepEqual(malformed, { ok: false, domain: "" });
  });

  it("case 10: validates allow-list domains across Indian ecommerce", () => {
    const domainsToTest = [
      "https://www.croma.com/p/123",
      "https://www.reliancedigital.in/p/456",
      "https://www.myntra.com/shoes",
      "https://www.ajio.com/tshirts",
      "https://www.nykaa.com/makeup",
      "https://www.tatacliq.com/electronics",
      "https://blinkit.com/s/?q=milk",
      "https://www.zeptonow.com/search?query=bread",
      "https://www.bigbasket.com/ps/?q=fruit",
      "https://www.swiggy.com/instamart/search?query=snacks",
      "https://www.meesho.com/s/curtains",
      "https://www.snapdeal.com/product/watch",
    ];

    for (const url of domainsToTest) {
      const res = validateProductLink(url);
      assert.equal(res.ok, true, `Expected ${url} to be valid`);
      assert.ok(ALLOWED_DOMAINS.includes(res.domain as (typeof ALLOWED_DOMAINS)[number]));
    }
  });
});

describe("buildPlatformSearchLink", () => {
  it("builds properly encoded search links for quick-commerce platforms", () => {
    assert.equal(
      buildPlatformSearchLink("blinkit", "amul milk 500ml"),
      "https://blinkit.com/s/?q=amul%20milk%20500ml"
    );

    assert.equal(
      buildPlatformSearchLink("zepto", "organic bread & butter"),
      "https://www.zeptonow.com/search?query=organic%20bread%20%26%20butter"
    );

    assert.equal(
      buildPlatformSearchLink("bigbasket", "fresh apples 1kg"),
      "https://www.bigbasket.com/ps/?q=fresh%20apples%201kg"
    );
  });
});
