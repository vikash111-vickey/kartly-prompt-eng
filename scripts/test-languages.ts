import fs from "node:fs";
import { NextRequest } from "next/server";
import { POST } from "../app/api/chat/route";
import type { Product } from "../types/product";

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

interface LanguageTestCase {
  name: string;
  language: string;
  prompt: string;
  scriptRegex: RegExp;
  unicodeRange: string;
}

const LANGUAGE_TEST_CASES: LanguageTestCase[] = [
  {
    name: "Hindi (Devanagari)",
    language: "Hindi",
    prompt: "2000 रुपये के अंदर अच्छे ईयरबड्स बताओ",
    scriptRegex: /[\u0900-\u097F]/,
    unicodeRange: "\\u0900-\\u097F",
  },
  {
    name: "Tamil (Tamil Script)",
    language: "Tamil",
    prompt: "2000 ரூபாய்க்குள் நல்ல இயர்பட்ஸ் சொல்லுங்கள்",
    scriptRegex: /[\u0B80-\u0BFF]/,
    unicodeRange: "\\u0B80-\\u0BFF",
  },
  {
    name: "Telugu (Telugu Script)",
    language: "Telugu",
    prompt: "2000 రూపాయల లోపు మంచి ఇయర్‌బడ్స్ చెప్పండి",
    scriptRegex: /[\u0C00-\u0C7F]/,
    unicodeRange: "\\u0C00-\\u0C7F",
  },
];

interface StreamEvent {
  type: "text" | "products" | "error" | "done";
  delta?: string;
  products?: Product[];
  message?: string;
}

interface TestResult {
  passed: boolean;
  reason?: string;
  sampleText?: string;
}

async function runLanguageTest(
  testCase: LanguageTestCase,
  index: number
): Promise<TestResult> {
  console.log(`\n======================================================`);
  console.log(`TEST [${index + 1}/3]: ${testCase.name}`);
  console.log(`PROMPT: "${testCase.prompt}"`);
  console.log(`EXPECTED SCRIPT RANGE: ${testCase.unicodeRange}`);
  console.log(`======================================================`);

  try {
    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": "127.0.0.1",
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: testCase.prompt }],
      }),
    });

    const response = await POST(req);

    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      const failReason = `HTTP ${response.status} Error: ${JSON.stringify(errorJson)}`;
      console.error(failReason);
      return { passed: false, reason: failReason };
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return { passed: false, reason: "No response stream body available" };
    }

    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let hasError = false;
    let errorMessage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (!jsonStr) continue;

        try {
          const event: StreamEvent = JSON.parse(jsonStr);
          if (event.type === "text" && event.delta) {
            fullText += event.delta;
          } else if (event.type === "error") {
            hasError = true;
            errorMessage = event.message || "Unknown error";
          }
        } catch {
          // ignore parse errors for partial chunks
        }
      }
    }

    if (hasError) {
      console.error(`Received error event from API: "${errorMessage}"`);
      return { passed: false, reason: `Stream error event: ${errorMessage}` };
    }

    if (!fullText.trim()) {
      console.error("FAIL: Empty text received from assistant");
      return { passed: false, reason: "Assistant returned empty response text" };
    }

    // Assert that the text contains characters in the expected Unicode script range
    const matchesScript = testCase.scriptRegex.test(fullText);

    console.log(`RESPONSE SNIPPET: "${fullText.slice(0, 150).replace(/\n/g, " ")}..."`);
    console.log(`CONTAINS EXPECTED SCRIPT CHARS: ${matchesScript ? "YES" : "NO"}`);

    if (!matchesScript) {
      return {
        passed: false,
        reason: `Reply did not contain expected ${testCase.language} script characters (${testCase.unicodeRange})`,
        sampleText: fullText.slice(0, 100),
      };
    }

    return {
      passed: true,
      sampleText: fullText.slice(0, 100),
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error(`Exception during test: ${errorMsg}`);
    return { passed: false, reason: `Exception: ${errorMsg}` };
  }
}

async function main() {
  console.log("=== Kartly Multilingual Script Verification ===");
  console.log("Testing Hindi, Tamil, and Telugu responses with a 4-second delay between requests...\n");

  const results: TestResult[] = [];

  for (let i = 0; i < LANGUAGE_TEST_CASES.length; i++) {
    const testCase = LANGUAGE_TEST_CASES[i];
    const result = await runLanguageTest(testCase, i);
    results.push(result);

    if (result.passed) {
      console.log(`>>> RESULT [${testCase.name}]: PASS\n`);
    } else {
      console.error(`>>> RESULT [${testCase.name}]: FAIL (${result.reason})\n`);
    }

    // Pause 4 seconds between requests to avoid rate limits
    if (i < LANGUAGE_TEST_CASES.length - 1) {
      console.log("Waiting 4 seconds before next request...");
      await new Promise((resolve) => setTimeout(resolve, 4000));
    }
  }

  const passedCount = results.filter((r) => r.passed).length;
  console.log(`\n======================================================`);
  console.log(`SUMMARY: ${passedCount} of ${LANGUAGE_TEST_CASES.length} passed`);
  console.log(`======================================================`);

  if (passedCount < LANGUAGE_TEST_CASES.length) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error("Unhandled error in test runner:", err);
  process.exit(1);
});
