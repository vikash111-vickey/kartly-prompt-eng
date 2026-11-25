import { GoogleGenAI } from "@google/genai";

// 30-minute in-memory skip cache for models that returned 429
const modelCooldownMap = new Map<string, number>();
const COOLDOWN_DURATION_MS = 30 * 60 * 1000;

export function markModelRateLimited(model: string, durationMs: number = COOLDOWN_DURATION_MS): void {
  modelCooldownMap.set(model, Date.now() + durationMs);
}

export function isModelRateLimited(model: string): boolean {
  const expiresAt = modelCooldownMap.get(model);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    modelCooldownMap.delete(model);
    return false;
  }
  return true;
}

export function clearModelCooldowns(): void {
  modelCooldownMap.clear();
}

export const DEFAULT_GEMINI_MODEL = "gemini-2.5-flash";
export const DEFAULT_FALLBACK_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-3-flash-preview",
];

/**
 * Retrieves the primary model name from process.env.GEMINI_MODEL.
 * Falls back to DEFAULT_GEMINI_MODEL if undefined.
 */
export function getGeminiModel(): string {
  const model = process.env.GEMINI_MODEL;
  if (model && model.trim().length > 0) {
    return model.trim();
  }
  return DEFAULT_GEMINI_MODEL;
}

/**
 * Reads optional fallback models from process.env.GEMINI_FALLBACK_MODELS (comma-separated).
 * Falls back to DEFAULT_FALLBACK_MODELS if undefined.
 */
export function getFallbackModels(): string[] {
  const raw = process.env.GEMINI_FALLBACK_MODELS;
  if (!raw || raw.trim().length === 0) {
    return DEFAULT_FALLBACK_MODELS;
  }
  return raw
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
}

/**
 * Returns all configured Gemini models in order of priority:
 * [primary, ...fallbacks] (without duplicate entries).
 * If skipRateLimited is true, skips models currently in their 30-minute cooldown.
 */
export function getAllGeminiModels(skipRateLimited = false): string[] {
  const primary = getGeminiModel();
  const fallbacks = getFallbackModels();
  const list = [primary];
  for (const f of fallbacks) {
    if (f && !list.includes(f)) {
      list.push(f);
    }
  }
  if (skipRateLimited) {
    const available = list.filter((m) => !isModelRateLimited(m));
    return available.length > 0 ? available : list;
  }
  return list;
}

export type GeminiErrorKind = "quota" | "overload" | "other";

/**
 * Extracts error status code or status string from an unknown Gemini API error.
 */
export function extractErrorStatusOrCode(err: unknown): string {
  if (!err) return "unknown";
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { status?: number; statusCode?: number })?.statusCode;
  const code = (err as { code?: string | number })?.code;
  if (status) return String(status);
  if (code) return String(code);
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("429")) return "429";
  if (msg.includes("503")) return "503";
  if (msg.includes("500")) return "500";
  if (msg.includes("502")) return "502";
  if (msg.includes("504")) return "504";
  if (msg.includes("RESOURCE_EXHAUSTED")) return "RESOURCE_EXHAUSTED";
  if (msg.includes("UNAVAILABLE")) return "UNAVAILABLE";
  return "error";
}

/**
 * Classifies Gemini error into "quota", "overload", or "other".
 * Retryable: HTTP 429, 500, 502, 503, 504, RESOURCE_EXHAUSTED, UNAVAILABLE.
 */
export function getGeminiErrorKind(err: unknown): GeminiErrorKind | null {
  if (!err) return null;
  const msg = err instanceof Error ? err.message : String(err);
  const status =
    (err as { status?: number; statusCode?: number })?.status ??
    (err as { status?: number; statusCode?: number })?.statusCode;
  const code = String((err as { code?: string | number })?.code || "");

  // Quota errors (429 or RESOURCE_EXHAUSTED)
  if (
    status === 429 ||
    code === "RESOURCE_EXHAUSTED" ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.toLowerCase().includes("quota exceeded")
  ) {
    return "quota";
  }

  // Temporary overload / server errors (500, 502, 503, 504, UNAVAILABLE)
  if (
    status === 503 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    code === "UNAVAILABLE" ||
    msg.includes("503") ||
    msg.includes("500") ||
    msg.includes("502") ||
    msg.includes("504") ||
    msg.includes("UNAVAILABLE") ||
    msg.toLowerCase().includes("overloaded") ||
    msg.toLowerCase().includes("service unavailable")
  ) {
    return "overload";
  }

  return null;
}

/**
 * Checks whether an error from Gemini is retryable.
 */
export function isRetryableGeminiError(err: unknown): boolean {
  return getGeminiErrorKind(err) !== null;
}

/**
 * Determines whether an error is an HTTP 429 rate limit or RESOURCE_EXHAUSTED quota error.
 */
export function is429OrQuotaError(err: unknown): boolean {
  return getGeminiErrorKind(err) === "quota";
}

/**
 * Creates and returns a GoogleGenAI client initialized with process.env.GEMINI_API_KEY
 * and reads the model name from process.env.GEMINI_MODEL.
 */
export function getGeminiClient(): { client: GoogleGenAI; model: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not defined. Please configure it in .env.local"
    );
  }

  const model = getGeminiModel();
  const client = new GoogleGenAI({ apiKey, apiVersion: "v1beta" });

  return { client, model };
}

/**
 * Creates and returns an instance of GoogleGenAI using process.env.GEMINI_API_KEY.
 */
export function createGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY environment variable is not defined. Please configure it in .env.local"
    );
  }
  return new GoogleGenAI({ apiKey, apiVersion: "v1beta" });
}
