import OpenAI from "openai";
import { KIMI_API_KEY, KIMI_BASE_URL, KIMI_MODEL, kimiConfigured } from "@/lib/config";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: KIMI_API_KEY, baseURL: KIMI_BASE_URL });
  }
  return client;
}

/**
 * Single chat call against the Kimi (Moonshot) OpenAI-compatible API.
 * Returns the assistant message text. Throws if Kimi is not configured —
 * callers should gate on `kimiConfigured()` and use deterministic logic
 * in mock mode.
 */
export async function kimiChat(
  messages: ChatMessage[],
  opts: { json?: boolean; temperature?: number } = {}
): Promise<string> {
  if (!kimiConfigured()) {
    throw new Error("Kimi API not configured");
  }

  const completion = await getClient().chat.completions.create({
    model: KIMI_MODEL,
    messages,
    temperature: opts.temperature ?? 0.3,
    ...(opts.json ? { response_format: { type: "json_object" } } : {}),
  });

  return completion.choices[0]?.message?.content ?? "";
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

export { kimiConfigured };
