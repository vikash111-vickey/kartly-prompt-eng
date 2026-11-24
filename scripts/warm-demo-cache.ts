import fs from "node:fs";
import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route";
import type { Product } from "../types/product";
import type { SafetyCheckResult } from "../lib/safety/check";

// Fix console encoding for Windows PowerShell UTF-8 support
if (process.platform === "win32") {
  try {
    process.stdout.setDefaultEncoding?.("utf-8");
  } catch {
    // Fallback if not supported
  }
}

// Load .env.local if present
if (fs.existsSync(".env.local")) {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(".env.local");
    }
  } catch {
    // Ignore if already loaded or unreadable
  }
}

const DEMO_QUERIES = [
  "hi",
  "best earbuds under 2000",
  "show some phones under 20000",
  "office chairs under 5000",
  "air fryer under 5000",
  "milk and bread in 10 minutes",
  "gift for my mom's birthday around 1500",
  "is this legit? http://amaz0n-offers.in/deal",
];

interface StreamEvent {
  type: "text" | "products" | "safety_check" | "notice" | "error" | "done";
  delta?: string;
  products?: Product[];
  safetyCheck?: SafetyCheckResult;
  message?: string;
}

interface WarmResult {
  query: string;
  passed: boolean;
  reason?: string;
}

async function warmQuery(query: string, index: number): Promise<WarmResult> {
  console.log(`\n======================================================`);
  console.log(`[${index + 1}/${DEMO_QUERIES.length}] Warming: "${query}"`);
  console.log(`======================================================`);

  try {
    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: query }],
      }),
    });

    const response = await POST(req);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const failReason = `HTTP ${response.status}: ${JSON.stringify(errorJson)}`;
      console.error(`FAIL: ${failReason}`);
      return { query, passed: false, reason: failReason };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { query, passed: false, reason: "No response body" };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let productCount = 0;
    let hasSafety = false;
    let hasError = false;
    let errorMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const event: StreamEvent = JSON.parse(trimmed);
          if (event.type === "text" && event.delta) {
            fullText += event.delta;
          } else if (event.type === "products" && event.products) {
            productCount = event.products.length;
          } else if (event.type === "safety_check" && event.safetyCheck) {
            hasSafety = true;
          } else if (event.type === "error") {
            hasError = true;
            errorMessage = event.message || "Unknown error";
          }
        } catch {
          // ignore partial json chunk parsing
        }
      }
    }

    if (hasError) {
      console.error(`FAIL: API returned error event: "${errorMessage}"`);
      return { query, passed: false, reason: errorMessage };
    }

    if (!fullText.trim()) {
      console.error(`FAIL: Empty text received`);
      return { query, passed: false, reason: "Empty response text" };
    }

    const preview = fullText.slice(0, 100).replace(/\n/g, " ");
    console.log(`Response preview: "${preview}..."`);
    if (productCount > 0) {
      console.log(`Products attached: ${productCount}`);
    }
    if (hasSafety) {
      console.log(`Safety card attached: YES`);
    }

    console.log(`RESULT: PASS (Saved to demo cache)`);
    return { query, passed: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`FAIL: Exception: ${msg}`);
    return { query, passed: false, reason: msg };
  }
}

async function main() {
  console.log("=== Kartly Demo Cache Warmer ===");
  console.log(`Target: Warming ${DEMO_QUERIES.length} queries with a 6-second delay between requests...\n`);

  const results: WarmResult[] = [];

  for (let i = 0; i < DEMO_QUERIES.length; i++) {
    const query = DEMO_QUERIES[i];
    const result = await warmQuery(query, i);
    results.push(result);

    if (i < DEMO_QUERIES.length - 1) {
      console.log("\nWaiting 6 seconds before next query...");
      await new Promise((r) => setTimeout(r, 6000));
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log(`\n======================================================`);
  console.log(`SUMMARY: ${passedCount} of ${DEMO_QUERIES.length} queries successfully warmed and cached.`);
  console.log(`======================================================`);

  if (passedCount < DEMO_QUERIES.length) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unhandled error in warmer script:", err);
  process.exit(1);
});
