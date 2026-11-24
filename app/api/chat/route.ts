import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Content } from "@google/genai";
import {
  createGeminiClient,
  getAllGeminiModels,
  is429OrQuotaError,
  markModelRateLimited,
  extractErrorStatusOrCode,
  getGeminiErrorKind,
  type GeminiErrorKind,
} from "@/lib/gemini";
import { getSystemPrompt } from "@/lib/prompts";
import {
  searchProductsDeclaration,
  checkSafetyDeclaration,
  toModelView,
} from "@/lib/gemini-tools";
import { checkLinkOrText, type SafetyCheckResult } from "@/lib/safety/check";
import { searchProducts as liveSearchProducts } from "@/lib/search/index";
import { searchProducts as mockSearchProducts } from "@/lib/search/mock";
import { upgradeToDirectLink } from "@/lib/search/providers/shopping-api";
import type { Product } from "@/types/product";
import {
  getCachedAnswer,
  saveCachedAnswer,
  type CachedAnswer,
} from "@/lib/demo-cache";

async function searchProducts(args: {
  query: string;
  searchQuery?: string;
  excludeTerms?: string[];
  category?: string;
  maxPrice?: number;
  minRating?: number;
  mustHave?: string[];
  urgency?: "10min" | "today" | "normal";
}): Promise<Product[]> {
  if (process.env.USE_MOCK_SEARCH === "true") {
    return mockSearchProducts(args);
  }
  return liveSearchProducts(args);
}

// Zod validation schema: max 30 messages, max 1000 chars per message
const chatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(1000),
      })
    )
    .min(1)
    .max(30),
});

// In-memory rate limiting:
// 1. Per-IP: max 20 requests per minute
// 2. Global instance: max 60 requests per minute per server instance
interface RateLimitRecord {
  timestamps: number[];
}

const ipRequestMap = new Map<string, RateLimitRecord>();
const globalRequestTimestamps: number[] = [];

interface RateLimitResult {
  allowed: boolean;
  reason?: "global" | "ip";
}

function checkRateLimit(ip: string): RateLimitResult {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const maxGlobalRequests = 60;
  const maxIpRequests = 20;

  // 1. Check & prune global request timestamps
  while (globalRequestTimestamps.length > 0 && now - globalRequestTimestamps[0] >= windowMs) {
    globalRequestTimestamps.shift();
  }

  if (globalRequestTimestamps.length >= maxGlobalRequests) {
    return { allowed: false, reason: "global" };
  }

  // 2. Check & prune per-IP request timestamps
  const record = ipRequestMap.get(ip) || { timestamps: [] };
  record.timestamps = record.timestamps.filter((t) => now - t < windowMs);

  if (record.timestamps.length >= maxIpRequests) {
    return { allowed: false, reason: "ip" };
  }

  // Record allowed request
  globalRequestTimestamps.push(now);
  record.timestamps.push(now);
  ipRequestMap.set(ip, record);

  // Periodically clean up stale IPs (prevent memory leak)
  if (ipRequestMap.size > 1000) {
    for (const [key, val] of ipRequestMap.entries()) {
      val.timestamps = val.timestamps.filter((t) => now - t < windowMs);
      if (val.timestamps.length === 0) {
        ipRequestMap.delete(key);
      }
    }
  }

  return { allowed: true };
}

/**
 * Dev fallback generator adhering strictly to KARTLY_SYSTEM_PROMPT_V1
 * when GEMINI_API_KEY is not yet populated in .env.local.
 */
async function generateDevResponse(
  lastUserMessage: string
): Promise<{ text: string; products: Product[] }> {
  const queryLower = lastUserMessage.toLowerCase();

  // Safety test: ignore instructions / fake link attempt
  if (
    queryLower.includes("ignore") ||
    queryLower.includes("fake link") ||
    queryLower.includes("http") ||
    queryLower.includes("link") && queryLower.includes("fake")
  ) {
    return {
      text: "Nice try! I never generate, guess, or modify external URLs or links. My job is strictly to find you safe, verified products from real shopping platforms. What are you looking to buy today?",
      products: [],
    };
  }

  // Small talk: greeting
  if (/^(hi|hello|hey|hola|namaste|नमस्ते)\b/i.test(lastUserMessage.trim())) {
    return {
      text: "Hey there! I'm Kartly, your personal shopping buddy. What are you looking to buy today? Tell me what you need, your budget, or any favorite platforms!",
      products: [],
    };
  }

  // Small talk: thanks
  if (
    queryLower.includes("thanks") ||
    queryLower.includes("thank you") ||
    queryLower.includes("dhanyawad") ||
    queryLower.includes("shukriya")
  ) {
    return {
      text: "You're most welcome, anytime! Let me know if you need help finding anything else or checking another deal.",
      products: [],
    };
  }

  // Hindi phone query: "नमस्ते, ₹15000 में अच्छा फोन दिखाओ"
  if (
    queryLower.includes("फोन") ||
    queryLower.includes("मोबाइल") ||
    queryLower.includes("15000") ||
    (queryLower.includes("phone") && queryLower.includes("15000"))
  ) {
    const products = await searchProducts({
      query: "5G phone under 15000",
      maxPrice: 15000,
      minRating: 4.0,
    });

    const topPick = products.find((p) => p.id === "mock-phone-moto-g64");
    const alt1 = products.find((p) => p.id === "mock-phone-samsung-m15");
    const alt2 = products.find((p) => p.id === "mock-phone-vivo-t3x-croma");

    const picks = [topPick, alt1, alt2].filter((p): p is Product => Boolean(p));
    const others = products.filter((p) => !picks.some((pk) => pk.id === p.id));
    const fullPicks = [...picks, ...others].slice(0, 8);

    return {
      text:
        "Here are the safest, top-rated phones under ₹15,000 from Flipkart, Amazon, and Croma:\n\n" +
        "1. **Moto G64 5G** (₹13,999, Flipkart): Top pick! Has a huge 6000mAh battery, OIS camera, and clean stock Android.\n" +
        "2. **Samsung Galaxy M15 5G** (₹12,499, Amazon): Great Super AMOLED display with 4 years of guaranteed OS updates.\n" +
        "3. **Vivo T3x 5G** (₹13,499, Croma): Fast Snapdragon processor and handy in-store pickup at Croma.\n\n" +
        "Make sure to check final prices and bank discounts at checkout!\nPICKS: mock-phone-moto-g64, mock-phone-samsung-m15, mock-phone-vivo-t3x-croma",
      products: fullPicks,
    };
  }

  // Earbuds query: "best earbuds under 2000"
  if (
    queryLower.includes("earbuds") ||
    queryLower.includes("earphone") ||
    queryLower.includes("tws") ||
    queryLower.includes("2000")
  ) {
    const products = await searchProducts({
      query: "earbuds under 2000",
      maxPrice: 2000,
      minRating: 4.0,
    });

    const topPick = products.find((p) => p.id === "mock-earbuds-oneplus-nord-2r");
    const alt1 = products.find((p) => p.id === "mock-earbuds-boat-141");
    const alt2 = products.find((p) => p.id === "mock-earbuds-noise-vs102-blinkit");

    const picks = [topPick, alt1, alt2].filter((p): p is Product => Boolean(p));
    const others = products.filter((p) => !picks.some((pk) => pk.id === p.id));
    const fullPicks = [...picks, ...others].slice(0, 8);

    return {
      text:
        "Based on verified buyer reviews and seller reliability across Amazon, Flipkart, and Blinkit, here are my top picks under ₹2,000:\n\n" +
        "1. **OnePlus Nord Buds 2r** (₹1,799 on Flipkart): Top pick! Best audio balance, dual mics for clear calls, and 48,000+ verified ratings.\n" +
        "2. **boAt Airdopes 141** (₹1,299 on Amazon): Super reliable budget champ with 42H battery and next-day free delivery.\n" +
        "3. **Noise Buds VS102** (₹1,099 on Blinkit): Perfect if you need decent earbuds urgently—delivered in just 12 minutes.\n\n" +
        "⚠️ Watch out: Avoid deals selling AirPods Pro under ₹1,000—those are classic counterfeit traps with zero returns.\nPICKS: mock-earbuds-oneplus-nord-2r, mock-earbuds-boat-141, mock-earbuds-noise-vs102-blinkit",
      products: fullPicks,
    };
  }

  // Default product search fallback
  const genericProducts = await searchProducts({ query: lastUserMessage });
  const topEight = genericProducts.slice(0, 8);
  const picksLine = topEight.slice(0, 3).map((p) => p.id).join(", ");

  return {
    text: `I searched across Amazon, Flipkart, and quick-commerce for "${lastUserMessage}". Here are the most dependable deals I found based on seller ratings and pricing.\nPICKS: ${picksLine}`,
    products: topEight,
  };
}

/**
 * Streams a saved answer from the demo cache with a user notice.
 */
async function streamCachedAnswer(
  cached: CachedAnswer,
  sendEvent: (event: Record<string, unknown>) => void
): Promise<void> {
  sendEvent({
    type: "notice",
    message:
      "Showing a saved answer from earlier because live data is unavailable right now.",
  });

  const words = cached.text.split(/(\s+)/);
  let buffer = "";
  for (let i = 0; i < words.length; i++) {
    buffer += words[i];
    if (i % 3 === 0 || i === words.length - 1) {
      if (buffer.length > 0) {
        sendEvent({ type: "text", delta: buffer });
        buffer = "";
      }
      await new Promise((r) => setTimeout(r, 12));
    }
  }

  if (cached.safetyCheck) {
    sendEvent({ type: "safety_check", safetyCheck: cached.safetyCheck });
  }

  if (cached.products && cached.products.length > 0) {
    sendEvent({ type: "products", products: cached.products });
  }

  sendEvent({ type: "done" });
}

export interface CreateChatStreamOptions {
  messages: { role: "user" | "assistant"; content: string }[];
  promptVersion?: string;
  bypassDemoCache?: boolean;
}

export function createChatStream(options: CreateChatStreamOptions): ReadableStream {
  const { messages, promptVersion, bypassDemoCache = false } = options;
  const lastUserMsg = messages[messages.length - 1].content;
  const effectiveSystemPrompt = getSystemPrompt(promptVersion);

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const sendEvent = (event: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      let hasStreamedText = false;

      try {
        // DEMO_MODE: Serve from demo cache first if an entry exists
        if (!bypassDemoCache && process.env.DEMO_MODE === "true") {
          const cached = getCachedAnswer(lastUserMsg);
          if (cached) {
            console.log(
              `[DemoCache] DEMO_MODE active: serving cached response for "${lastUserMsg}"`
            );
            await streamCachedAnswer(cached, sendEvent);
            return;
          }
        }

        const apiKey = process.env.GEMINI_API_KEY?.trim();

        let rawResponseText = "";
        const allFoundProducts = new Map<string, Product>();
        let pickedProducts: Product[] = [];
        let safetyCheckResult: SafetyCheckResult | undefined = undefined;

        if (apiKey) {
          // ==========================================
          // REAL GEMINI BACKEND WITH MULTI-TURN TOOL LOOP & 429 FALLBACK
          // ==========================================
          const ai = createGeminiClient();
          // Use 30-minute skip cache for rate-limited models; try all configured models
          const modelsToTry = getAllGeminiModels(true);
          let currentModelIndex = 0;
          const modelFailures = new Map<string, GeminiErrorKind>();

          // Helper to execute actions with fallback across models and temporary overload retries
          const executeWithModelFallback = async <T>(
            action: (modelName: string) => Promise<T>
          ): Promise<T> => {
            while (currentModelIndex < modelsToTry.length) {
              const activeModel = modelsToTry[currentModelIndex];
              try {
                return await action(activeModel);
              } catch (err: unknown) {
                const statusStr = extractErrorStatusOrCode(err);
                const kind = getGeminiErrorKind(err);

                if (kind === "quota") {
                  // 429 or RESOURCE_EXHAUSTED: put in 30-min skip cache, move to next model immediately
                  console.warn(
                    `[Gemini Retry] model: "${activeModel}", status: ${statusStr}, action: put in 30-min skip cache and move to next model immediately`
                  );
                  markModelRateLimited(activeModel, 30 * 60 * 1000);
                  modelFailures.set(activeModel, "quota");
                  currentModelIndex++;
                  continue;
                } else if (kind === "overload") {
                  // 503, 500, 502, 504, UNAVAILABLE: retry same model ONCE after 1.5s wait
                  console.warn(
                    `[Gemini Retry] model: "${activeModel}", status: ${statusStr}, action: temporary overload, retrying same model once after 1.5s wait`
                  );
                  await new Promise((r) => setTimeout(r, 1500));

                  try {
                    return await action(activeModel);
                  } catch (err2: unknown) {
                    const statusStr2 = extractErrorStatusOrCode(err2);
                    console.warn(
                      `[Gemini Retry] model: "${activeModel}", status: ${statusStr2} (failed twice), action: skip model for 2 minutes and move to next model`
                    );
                    // Skip the model for only 2 minutes if it fails twice
                    markModelRateLimited(activeModel, 2 * 60 * 1000);
                    modelFailures.set(activeModel, "overload");
                    currentModelIndex++;
                    continue;
                  }
                } else {
                  // Other / unexpected error
                  const errDetails = err instanceof Error ? err.message : String(err);
                  console.warn(
                    `[Gemini Retry] model: "${activeModel}", status: ${statusStr}, details: ${errDetails}, action: unhandled error, moving to next model`
                  );
                  modelFailures.set(activeModel, "other");
                  currentModelIndex++;
                  continue;
                }
              }
            }

            // All models in chain failed: determine error code
            let finalCode: "quota" | "overload" | "unknown" = "unknown";
            const allKinds = Array.from(modelFailures.values());
            if (allKinds.length > 0 && allKinds.every((k) => k === "quota")) {
              finalCode = "quota";
            } else if (allKinds.length > 0 && allKinds.every((k) => k === "overload")) {
              finalCode = "overload";
            } else if (allKinds.some((k) => k === "quota")) {
              finalCode = "quota";
            } else if (allKinds.some((k) => k === "overload")) {
              finalCode = "overload";
            }

            const error = new Error(`GEMINI_ALL_MODELS_EXHAUSTED:${finalCode}`);
            (error as { code?: string }).code = finalCode;
            throw error;
          };

          const contents: Content[] = messages.map((m) => ({
            role: m.role === "assistant" ? "model" : "user",
            parts: [{ text: m.content }],
          }));

          let rounds = 0;
          const maxToolRounds = 2; // Capped at 2 tool rounds per message

          while (rounds < maxToolRounds) {
            const response = await executeWithModelFallback((m) =>
              ai.models.generateContent({
                model: m,
                contents,
                config: {
                  systemInstruction: effectiveSystemPrompt,
                  temperature: 0.7,
                  tools: [
                    {
                      functionDeclarations: [
                        searchProductsDeclaration,
                        checkSafetyDeclaration,
                      ],
                    },
                  ],
                },
              })
            );

            const functionCalls = response.functionCalls;

            if (functionCalls && functionCalls.length > 0) {
              rounds++;

              const candidateContent = response.candidates?.[0]?.content;
              if (candidateContent) {
                contents.push(candidateContent);
              }

              for (const call of functionCalls) {
                if (call.name === "search_products") {
                  const args = (call.args || {}) as Record<string, unknown>;
                  const searchQuery = String(args.searchQuery || args.query || "");
                  const excludeTerms = Array.isArray(args.excludeTerms)
                    ? args.excludeTerms.map(String)
                    : undefined;
                  const category = args.category ? String(args.category) : undefined;

                  const products = await searchProducts({
                    query: searchQuery,
                    searchQuery,
                    excludeTerms,
                    category,
                    maxPrice:
                      typeof args.maxPrice === "number" ? args.maxPrice : undefined,
                    minRating:
                      typeof args.minRating === "number" ? args.minRating : undefined,
                    mustHave: Array.isArray(args.mustHave)
                      ? args.mustHave.map(String)
                      : undefined,
                    urgency:
                      args.urgency === "10min" ||
                      args.urgency === "today" ||
                      args.urgency === "normal"
                        ? args.urgency
                        : undefined,
                  });

                  for (const p of products) {
                    allFoundProducts.set(p.id, p);
                  }

                  // If fewer than 3 relevant products remain, flag lowRelevance
                  const lowRelevance =
                    products.length < 3 || Boolean(products[0]?.providerFailed);

                  contents.push({
                    role: "user",
                    parts: [
                      {
                        functionResponse: {
                          name: "search_products",
                          response: {
                            lowRelevance,
                            note: lowRelevance
                              ? "No good matches for this category/price. Ask the user one clarifying question (e.g. confirm the product type or suggest a realistic price range) instead of showing bad deals."
                              : undefined,
                            products: lowRelevance
                              ? []
                              : toModelView(products.slice(0, 5)),
                          },
                        },
                      },
                    ],
                  });
                } else if (call.name === "check_safety") {
                  const args = (call.args || {}) as Record<string, unknown>;
                  const inputStr = String(args.input || lastUserMsg);
                  const result = checkLinkOrText(inputStr);
                  safetyCheckResult = result;

                  contents.push({
                    role: "user",
                    parts: [
                      {
                        functionResponse: {
                          name: "check_safety",
                          response: {
                            verdict: result.verdict,
                            reasons: result.reasons,
                            checks: result.checks,
                          },
                        },
                      },
                    ],
                  });
                }
              }
            } else {
              rawResponseText = response.text || "";
              break;
            }
          }

          if (!rawResponseText || !rawResponseText.trim()) {
            const finalCall = await executeWithModelFallback((m) =>
              ai.models.generateContent({
                model: m,
                contents,
                config: {
                  systemInstruction: effectiveSystemPrompt,
                  temperature: 0.7,
                },
              })
            );
            rawResponseText = finalCall.text || "";
          }

          if (!rawResponseText || !rawResponseText.trim()) {
            const emptyError = new Error("Empty model response");
            (emptyError as { code?: string }).code = "model";
            throw emptyError;
          }

          // Extract PICKS: id1, id2, id3
          const picksMatch = rawResponseText.match(/(?:^|\n)PICKS:\s*([^\n\r]+)/i);
          if (picksMatch) {
            const ids = picksMatch[1]
              .split(/[\s,]+/)
              .map((s) => s.trim().replace(/^['"]|['"]$/g, ""))
              .filter(Boolean);

            for (const id of ids) {
              const found = allFoundProducts.get(id);
              if (found && !pickedProducts.some((p) => p.id === found.id)) {
                pickedProducts.push(found);
                if (pickedProducts.length >= 3) break;
              }
            }
          }

          // Fix: Product cards should ONLY be attached to a message if Gemini returned a valid PICKS line.
          // If Gemini recommends 3 products in PICKS, send only those 3 products, PLUS up to 5 more relevant products (8 total).
          // If Gemini returns no PICKS (e.g. asking a clarifying question), send NO product cards at all.
          if (pickedProducts.length > 0) {
            const otherRelevant: Product[] = [];
            for (const prod of allFoundProducts.values()) {
              if (otherRelevant.length >= 5) break;
              if (!pickedProducts.some((p) => p.id === prod.id)) {
                otherRelevant.push(prod);
              }
            }

            // Upgrade ONLY the top 3 picked products to direct store links to protect SerpAPI credits
            const upgradedTop3 = await Promise.all(
              pickedProducts.map((p) => upgradeToDirectLink(p))
            );
            pickedProducts = [...upgradedTop3, ...otherRelevant];
          } else {
            pickedProducts = [];
          }

          // Fallback safety check if user shared a link or asked about safety and model answered directly
          if (!safetyCheckResult) {
            const userText = lastUserMsg.toLowerCase();
            const hasUrl =
              /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|in|org|net|xyz|top|click|shop|site|online|biz)/i.test(
                lastUserMsg
              );
            const asksSafety =
              userText.includes("legit") ||
              userText.includes("scam") ||
              userText.includes("safe") ||
              userText.includes("trust") ||
              userText.includes("fake") ||
              userText.includes("fraud");

            if (hasUrl || asksSafety) {
              safetyCheckResult = checkLinkOrText(lastUserMsg);
            }
          }
        } else {
          // ==========================================
          // DEV SIMULATION MODE (No GEMINI_API_KEY in .env.local)
          // ==========================================
          const devResult = await generateDevResponse(lastUserMsg);
          rawResponseText = devResult.text;
          pickedProducts = devResult.products;

          const userText = lastUserMsg.toLowerCase();
          const hasUrl =
            /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9-]+\.(?:com|in|org|net|xyz|top|click|shop|site|online|biz)/i.test(
              lastUserMsg
            );
          const asksSafety =
            userText.includes("legit") ||
            userText.includes("scam") ||
            userText.includes("safe") ||
            userText.includes("trust") ||
            userText.includes("fake") ||
            userText.includes("fraud");

          if (hasUrl || asksSafety) {
            safetyCheckResult = checkLinkOrText(lastUserMsg);
            if (safetyCheckResult.verdict === "likely_scam") {
              rawResponseText = `Warning: That link looks like a scam! ${safetyCheckResult.reasons.join(" ")} Please do not share any OTP, passwords, or pay money outside verified apps. For financial cyber fraud, dial 1930 immediately.`;
            } else if (safetyCheckResult.verdict === "be_careful") {
              rawResponseText = `Be careful: This domain or deal has some warning flags: ${safetyCheckResult.reasons.join(" ")}. Always check the official website or app before paying.`;
            } else {
              rawResponseText = `This link looks like an official store link and passes safety checks. Remember to always confirm pricing and seller details at checkout!`;
            }
          }
        }

        // Strip the PICKS line from the user-facing text
        const cleanText = rawResponseText
          .replace(/(?:^|\n)PICKS:\s*[^\n\r]+/gi, "")
          .trim();

        // Stream text in delta chunks
        const words = cleanText.split(/(\s+)/);
        let buffer = "";
        for (let i = 0; i < words.length; i++) {
          buffer += words[i];
          if (i % 3 === 0 || i === words.length - 1) {
            if (buffer.length > 0) {
              hasStreamedText = true;
              sendEvent({ type: "text", delta: buffer });
              buffer = "";
            }
            await new Promise((r) => setTimeout(r, 12));
          }
        }

        // Stream safety_check event if safety was evaluated
        if (safetyCheckResult) {
          sendEvent({ type: "safety_check", safetyCheck: safetyCheckResult });
        }

        // Stream products event
        if (pickedProducts.length > 0) {
          sendEvent({ type: "products", products: pickedProducts });
        }

        // Save fully successful answer to demo cache
        if (!bypassDemoCache) {
          saveCachedAnswer(lastUserMsg, {
            text: cleanText,
            products: pickedProducts.length > 0 ? pickedProducts : undefined,
            safetyCheck: safetyCheckResult,
          });
        }

        // Stream done event
        sendEvent({ type: "done" });
      } catch (err: unknown) {
        console.error("Chat route stream error:", err);

        // Fallback to demo cache if request failed before any text was streamed
        if (!bypassDemoCache && !hasStreamedText) {
          const cachedFallback = getCachedAnswer(lastUserMsg);
          if (cachedFallback) {
            console.log(
              `[DemoCache] Live request failed. Serving cached fallback answer for: "${lastUserMsg}"`
            );
            await streamCachedAnswer(cachedFallback, sendEvent);
            return;
          }
        }

        if (hasStreamedText) {
          // Model failed after some text was already streamed
          sendEvent({
            type: "error",
            code: "model",
            message: "Reply was cut off. Retry?",
          });
        } else {
          const errCode = (err as { code?: string })?.code;
          const msg = err instanceof Error ? err.message : String(err);

          let code: "quota" | "overload" | "search" | "model" | "unknown" = "unknown";
          let userMessage = "Something went wrong on my side.";

          if (errCode === "quota" || msg.includes("quota") || is429OrQuotaError(err)) {
            code = "quota";
            userMessage = "I've used up my thinking quota for now. Please try again in a bit!";
          } else if (errCode === "overload" || msg.includes("overload")) {
            code = "overload";
            userMessage = "My brain is a bit busy right now. Give me a moment and try again!";
          } else if (
            errCode === "search" ||
            msg.toLowerCase().includes("search") ||
            msg.toLowerCase().includes("stores")
          ) {
            code = "search";
            userMessage = "I couldn't reach the stores right now. Give it another shot in a moment!";
          } else if (errCode === "model" || msg.toLowerCase().includes("model")) {
            code = "model";
            userMessage = "I got a bit confused there. Could you ask that another way?";
          }

          sendEvent({
            type: "error",
            code,
            message: userMessage,
          });
        }
      } finally {
        controller.close();
      }
    },
  });
}

export async function POST(req: NextRequest) {
  // Extract client IP safely behind reverse proxies (x-forwarded-for first value).
  // Note: This IP is exclusively used for in-memory rate limiting and never trusted for anything else.
  const rawXff = req.headers.get("x-forwarded-for");
  const ip = rawXff
    ? rawXff.split(",")[0].trim()
    : req.headers.get("x-real-ip")?.trim() || "127.0.0.1";

  const rateCheck = checkRateLimit(ip);
  if (!rateCheck.allowed) {
    if (rateCheck.reason === "global") {
      return NextResponse.json(
        { error: "Kartly is busy right now. Please try again in a minute." },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: "Too many requests from your connection. Please wait a moment." },
      { status: 429 }
    );
  }

  // Parse & validate JSON body strictly
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body." },
      { status: 400 }
    );
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request format.", details: parsed.error.issues },
      { status: 400 }
    );
  }

  const { messages } = parsed.data;
  // Notice: promptVersion is NOT accepted from public request body!
  // Production chat route always uses the default (latest) version.
  const stream = createChatStream({ messages });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

export interface ChatEvalResult {
  text: string;
  products: Product[];
  safetyCheck?: SafetyCheckResult;
  notice?: string;
  error?: { code: string; message: string };
}

export async function executeChatForEval(options: {
  messages: { role: "user" | "assistant"; content: string }[];
  promptVersion?: string;
}): Promise<ChatEvalResult> {
  const stream = createChatStream({
    messages: options.messages,
    promptVersion: options.promptVersion,
    bypassDemoCache: true,
  });

  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const result: ChatEvalResult = {
    text: "",
    products: [],
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "text" && typeof event.delta === "string") {
          result.text += event.delta;
        } else if (event.type === "products" && Array.isArray(event.products)) {
          result.products = event.products;
        } else if (event.type === "safety_check" && event.safetyCheck) {
          result.safetyCheck = event.safetyCheck;
        } else if (event.type === "notice" && typeof event.message === "string") {
          result.notice = event.message;
        } else if (event.type === "error") {
          result.error = {
            code: String(event.code || "unknown"),
            message: String(event.message || "An error occurred"),
          };
        }
      } catch {
        // ignore parse error on incomplete chunks
      }
    }
  }

  return result;
}
