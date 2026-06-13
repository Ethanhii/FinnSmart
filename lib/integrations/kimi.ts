import OpenAI from "openai";
import {
  KIMI_API_KEY,
  KIMI_BASE_URL,
  KIMI_MODEL,
  LLM_PRIMARY,
  LLM_TEMPERATURE,
  TOKEN_ROUTER_API_KEY,
  TOKEN_ROUTER_BASE_URL,
  TOKEN_ROUTER_MODEL,
  kimiConfigured,
  llmConfigured,
  tokenRouterConfigured,
} from "@/lib/config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface Provider {
  label: string;
  model: string;
  client: OpenAI;
}

let providers: Provider[] | null = null;

/**
 * Build the ordered list of LLM providers to try. Order follows LLM_PRIMARY;
 * whichever provider isn't first becomes the automatic fallback if the first
 * errors (e.g. Token Router out of credit). Both currently resolve to the same
 * kimi-k2.6 model, so output quality matches.
 */
function getProviders(): Provider[] {
  if (providers) return providers;

  const tokenRouter: Provider | null = tokenRouterConfigured()
    ? {
        label: "token-router",
        model: TOKEN_ROUTER_MODEL,
        client: new OpenAI({
          apiKey: TOKEN_ROUTER_API_KEY,
          baseURL: TOKEN_ROUTER_BASE_URL,
        }),
      }
    : null;

  const kimi: Provider | null = kimiConfigured()
    ? {
        label: "kimi",
        model: KIMI_MODEL,
        client: new OpenAI({ apiKey: KIMI_API_KEY, baseURL: KIMI_BASE_URL }),
      }
    : null;

  const ordered =
    LLM_PRIMARY === "tokenrouter" ? [tokenRouter, kimi] : [kimi, tokenRouter];

  providers = ordered.filter((p): p is Provider => p !== null);
  return providers;
}

/**
 * Single chat call against the configured LLM provider(s). Tries Token Router
 * first, then falls back to direct Kimi on any error. Returns the assistant
 * message text. Throws if no provider is configured — callers should gate on
 * `llmConfigured()` and use deterministic logic in mock mode.
 */
export async function kimiChat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  const available = getProviders();
  if (available.length === 0) {
    throw new Error("No LLM provider configured (Token Router or Kimi)");
  }

  let lastError: unknown;
  for (const provider of available) {
    try {
      const completion = await provider.client.chat.completions.create({
        model: provider.model,
        messages,
        temperature: opts.temperature ?? LLM_TEMPERATURE,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      });
      return completion.choices[0]?.message?.content ?? "";
    } catch (err) {
      lastError = err;
      // Try the next provider in the fallback chain.
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All LLM providers failed");
}

/** Parse a JSON object out of a model response, tolerating code fences. */
export function parseJsonResponse<T>(text: string): T {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const slice = start >= 0 && end >= 0 ? cleaned.slice(start, end + 1) : cleaned;
  return JSON.parse(slice) as T;
}

export { kimiConfigured, llmConfigured };
