import { NextResponse } from "next/server";
import { PROMPT_VERSION } from "@/lib/prompts/kartly-system";
import { getGeminiModel, getFallbackModels } from "@/lib/gemini";

export async function GET() {
  const primaryModel = getGeminiModel();
  const fallbackModels = getFallbackModels();

  const models: string[] = [];
  if (primaryModel) {
    models.push(primaryModel);
  }
  for (const m of fallbackModels) {
    if (!models.includes(m)) {
      models.push(m);
    }
  }

  const hasSearchKey = Boolean(
    process.env.SERPAPI_KEY?.trim() || process.env.SERPER_KEY?.trim()
  );

  const searchProvider: "configured" | "missing" = hasSearchKey
    ? "configured"
    : "missing";

  return NextResponse.json({
    ok: true,
    promptVersion: PROMPT_VERSION,
    models,
    searchProvider,
  });
}
