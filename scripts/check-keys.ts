import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

// ---------------------------------------------------------------------------
// 0. Load .env.local safely
// ---------------------------------------------------------------------------
function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) {
    return;
  }

  // Try Node's built-in env loader if supported
  if (typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
    } catch {
      // Ignore and fall back to manual parser
    }
  }

  // Always run manual parser to guarantee UTF-8 BOM handling and full parsing
  try {
    const raw = fs.readFileSync(envPath, "utf8");
    const clean = raw.charCodeAt(0) === 0xfeff ? raw.slice(1) : raw;
    for (const line of clean.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx !== -1) {
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!process.env[key] || process.env[key] === "") {
          process.env[key] = val;
        }
      }
    }
  } catch (err) {
    console.error("Warning: Failed to parse .env.local manually:", err);
  }
}

loadEnvLocal();

// ---------------------------------------------------------------------------
// Helpers: Redaction to ensure NO keys are ever printed
// ---------------------------------------------------------------------------
function redactSecret(text: string, secrets: (string | undefined)[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.trim().length > 0) {
      result = result.split(secret.trim()).join("[REDACTED]");
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Main test routine
// ---------------------------------------------------------------------------
async function main() {
  console.log("======================================================");
  console.log("KARTLY API KEYS VERIFICATION");
  console.log("======================================================\n");

  const geminiApiKey = process.env.GEMINI_API_KEY?.trim();
  const geminiModel = process.env.GEMINI_MODEL?.trim();
  const serpApiKey = process.env.SERPAPI_KEY?.trim();
  const serperKey = process.env.SERPER_KEY?.trim();

  const allSecrets = [geminiApiKey, serpApiKey, serperKey].filter(Boolean);

  // -------------------------------------------------------------------------
  // 1. Gemini API Test
  // -------------------------------------------------------------------------
  console.log("1. Gemini:");
  if (!geminiApiKey) {
    console.log("   MISSING: GEMINI_API_KEY");
  } else if (!geminiModel) {
    console.log("   MISSING: GEMINI_MODEL");
  } else {
    try {
      const ai = new GoogleGenAI({ apiKey: geminiApiKey });
      const response = await ai.models.generateContent({
        model: geminiModel,
        contents: "Reply with the single word: ready",
      });

      const reply = response.text ? response.text.trim() : "";
      console.log(`   PASS: "${reply}"`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : String(err || "Unknown error");
      console.log(`   FAIL: ${redactSecret(errorMsg, allSecrets)}`);
    }
  }

  // -------------------------------------------------------------------------
  // 2. Search API Test
  // -------------------------------------------------------------------------
  console.log("\n2. Search API:");
  const searchProvider = serpApiKey
    ? "SerpAPI"
    : serperKey
      ? "Serper"
      : null;

  if (!searchProvider) {
    console.log("   MISSING: SERPAPI_KEY (or SERPER_KEY)");
  } else {
    const activeSearchKey = (serpApiKey || serperKey)!;
    try {
      let resultCount = 0;

      if (searchProvider === "Serper") {
        const res = await fetch("https://google.serper.dev/shopping", {
          method: "POST",
          headers: {
            "X-API-KEY": activeSearchKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            q: "boat earbuds",
            gl: "in",
            hl: "en",
          }),
        });

        if (!res.ok) {
          throw new Error(`Serper API returned HTTP status ${res.status}`);
        }

        const data = await res.json();
        resultCount = Array.isArray(data.shopping) ? data.shopping.length : 0;
      } else {
        // SerpAPI
        const url = new URL("https://serpapi.com/search.json");
        url.searchParams.set("engine", "google_shopping");
        url.searchParams.set("q", "boat earbuds");
        url.searchParams.set("gl", "in");
        url.searchParams.set("hl", "en");
        url.searchParams.set("api_key", activeSearchKey);

        const res = await fetch(url.toString());
        if (!res.ok) {
          throw new Error(`SerpAPI returned HTTP status ${res.status}`);
        }

        const data = await res.json();
        if (data.error) {
          throw new Error(`SerpAPI error: ${data.error}`);
        }

        resultCount = Array.isArray(data.shopping_results)
          ? data.shopping_results.length
          : 0;
      }

      console.log(`   PASS: ${resultCount} results returned (${searchProvider})`);
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : String(err || "Unknown error");
      console.log(`   FAIL: ${redactSecret(errorMsg, allSecrets)}`);
    }
  }

  console.log("\n======================================================");
}

main().catch((err) => {
  console.error("Unexpected script error:", err);
  process.exit(1);
});
