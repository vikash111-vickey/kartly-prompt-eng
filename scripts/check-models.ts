import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { GoogleGenAI } from "@google/genai";
import { getAllGeminiModels, getGeminiErrorKind, extractErrorStatusOrCode } from "../lib/gemini";

interface ModelCheckResult {
  model: string;
  status: "PASS" | "QUOTA" | "OVERLOADED" | "FAIL";
  durationMs: number;
  message?: string;
}

async function checkModels() {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    console.error("ERROR: GEMINI_API_KEY is not defined in .env.local");
    process.exit(1);
  }

  const models = getAllGeminiModels(false);
  console.log("==========================================");
  console.log("KARTLY GEMINI MODEL CHAIN DIAGNOSTIC");
  console.log("==========================================");
  console.log(`Configured models in chain (${models.length}): ${models.join(", ")}\n`);

  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
  const results: ModelCheckResult[] = [];

  for (const model of models) {
    const start = performance.now();
    try {
      const response = await client.models.generateContent({
        model,
        contents: "Hi",
      });
      const durationMs = Math.round(performance.now() - start);
      const text = response.text?.trim().replace(/[\r\n]+/g, " ").slice(0, 40) || "";
      console.log(`[PASS]       ${model} (${durationMs}ms) - Reply: "${text}"`);
      results.push({ model, status: "PASS", durationMs, message: text });
    } catch (err: unknown) {
      const durationMs = Math.round(performance.now() - start);
      const kind = getGeminiErrorKind(err);
      const errCode = extractErrorStatusOrCode(err);
      const msg = err instanceof Error ? err.message : String(err);

      if (kind === "quota") {
        console.log(`[QUOTA]      ${model} (${durationMs}ms) - Status: ${errCode} (Quota exhausted)`);
        results.push({ model, status: "QUOTA", durationMs, message: `Status: ${errCode}` });
      } else if (kind === "overload") {
        console.log(`[OVERLOADED] ${model} (${durationMs}ms) - Status: ${errCode} (Temporary overload)`);
        results.push({ model, status: "OVERLOADED", durationMs, message: `Status: ${errCode}` });
      } else {
        console.log(`[FAIL]       ${model} (${durationMs}ms) - Status: ${errCode} (${msg.slice(0, 60)})`);
        results.push({ model, status: "FAIL", durationMs, message: msg });
      }
    }
  }

  // Recommended order: PASS models first (fastest first), then OVERLOADED, then QUOTA/FAIL
  const passed = results.filter((r) => r.status === "PASS").sort((a, b) => a.durationMs - b.durationMs);
  const overloaded = results.filter((r) => r.status === "OVERLOADED");
  const failedOrQuota = results.filter((r) => r.status === "QUOTA" || r.status === "FAIL");

  const recommendedOrder = [
    ...passed.map((r) => r.model),
    ...overloaded.map((r) => r.model),
    ...failedOrQuota.map((r) => r.model),
  ];

  console.log("\n==========================================");
  console.log("RECOMMENDED MODEL ORDER");
  console.log("==========================================");
  recommendedOrder.forEach((m, idx) => {
    const res = results.find((r) => r.model === m);
    console.log(`  ${idx + 1}. ${m} [${res?.status}]${res?.status === "PASS" ? ` (${res.durationMs}ms)` : ""}`);
  });
  console.log("==========================================");
}

checkModels().catch((err) => {
  console.error("Diagnostic script failed:", err);
  process.exit(1);
});
