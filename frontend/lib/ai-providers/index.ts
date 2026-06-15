import { queryGemini, type AITool, type AIResponse } from "./gemini";

export type { AITool, AIResponse };

function hasUsableApiKey(): boolean {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return false;
  return !key.startsWith("your-") && key !== "dummy-key";
}

function isRateLimit(err: unknown): boolean {
  const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("resource_exhausted") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("too many requests")
  );
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Attempt to call Gemini with exponential backoff on rate-limit.
 * Retries up to maxRetries times (1s → 2s → 4s) before giving up.
 */
async function callProviderWithRetry(
  systemPrompt: string,
  userQuery: string,
  tools: AITool[],
  callTool: (server: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>,
  conversationHistory: Array<{ role: string; content: string }>,
  maxRetries: number = 2
): Promise<AIResponse> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await queryGemini(systemPrompt, userQuery, tools, callTool, conversationHistory);
    } catch (error: unknown) {
      const rateLimited = isRateLimit(error);
      const isLastAttempt = attempt === maxRetries;

      if (rateLimited && !isLastAttempt) {
        const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`[AI] Rate limited on Gemini. Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})...`);
        await sleep(delay);
        continue;
      }

      // Re-throw so the caller can handle it
      throw error;
    }
  }

  // Shouldn't reach here, but just in case
  throw new Error("Retry loop exhausted");
}

/**
 * Query Gemini with tools.
 * Automatically retries on rate-limit with exponential backoff.
 * Accepts conversation history for multi-turn context.
 */
export async function queryAI(
  systemPrompt: string,
  userQuery: string,
  tools: AITool[],
  callTool: (server: string, toolName: string, args: Record<string, unknown>) => Promise<unknown>,
  conversationHistory: Array<{ role: string; content: string }> = []
): Promise<AIResponse> {
  if (!hasUsableApiKey()) {
    return {
      answer: "Gemini AI provider is unavailable. Please check your API keys.",
      toolCalls: [],
    };
  }

  try {
    return await callProviderWithRetry(systemPrompt, userQuery, tools, callTool, conversationHistory);
  } catch (error) {
    if (isRateLimit(error)) {
      console.warn(`[AI] Rate limit exhausted on Gemini after retries.`);
    } else {
      console.error(`Gemini AI provider failed:`, error);
    }

    return {
      answer: "Both AI providers are unavailable", // Kept this text so route.ts fallback still works (route.ts checks for this string)
      toolCalls: [],
    };
  }
}
