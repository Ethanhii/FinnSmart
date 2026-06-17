import OpenAI from "openai";
import {
  KIMI_API_KEY,
  KIMI_BASE_URL,
  KIMI_GRAPH_MODEL,
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

/** Kimi K2.6 may leave `content` empty and put text in `reasoning_content`. */
function messageText(message: { content?: string | null; reasoning_content?: string | null }): string {
  const content = message.content?.trim();
  if (content) return content;

  const reasoning = message.reasoning_content?.trim();
  if (!reasoning) return "";

  const start = reasoning.indexOf("{");
  const end = reasoning.lastIndexOf("}");
  if (start >= 0 && end > start) return reasoning.slice(start, end + 1);

  return reasoning;
}

/**
 * Single chat call against the configured LLM provider(s). Tries Token Router
 * first, then falls back to direct Kimi on any error. Returns the assistant
 * message text. Throws if no provider is configured — callers should gate on
 * `llmConfigured()` and use deterministic logic in mock mode.
 */
export async function kimiChat(
  messages: ChatMessage[],
  opts: {
    json?: boolean;
    temperature?: number;
    max_tokens?: number;
    /** Override model id (e.g. kimi-k2-turbo for fast structured tasks). */
    model?: string;
  } = {}
): Promise<string> {
  const available = getProviders();
  if (available.length === 0) {
    throw new Error("No LLM provider configured (Token Router or Kimi)");
  }

  let lastError: unknown;
  for (const provider of available) {
    const modelsToTry = opts.model
      ? [opts.model, provider.model]
      : [provider.model];

    for (const model of modelsToTry) {
      try {
        const completion = await provider.client.chat.completions.create({
          model,
          messages,
          temperature: opts.temperature ?? LLM_TEMPERATURE,
          ...(opts.max_tokens != null ? { max_tokens: opts.max_tokens } : {}),
          ...(opts.json ? { response_format: { type: "json_object" } } : {}),
        });
        return messageText(
          completion.choices[0]?.message ?? { content: "" }
        );
      } catch (err) {
        lastError = err;
        // If explicit model override failed, try the provider default next.
        if (opts.model && model === opts.model) continue;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All LLM providers failed");
}

/** Fast structured LLM call tuned for relationship-map generation. */
export async function kimiGraphChat(messages: ChatMessage[]): Promise<string> {
  const fallbacks = [KIMI_GRAPH_MODEL, "kimi-k2.5", KIMI_MODEL].filter(
    (m, i, arr) => arr.indexOf(m) === i
  );

  let lastError: unknown;
  for (const model of fallbacks) {
    try {
      const text = await kimiChat(messages, {
        json: true,
        model,
        max_tokens: 3000,
      });
      if (text.trim()) return text;
      lastError = new Error(`Empty response from ${model}`);
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Graph LLM call failed");
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
