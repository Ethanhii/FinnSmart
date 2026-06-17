/**
 * Central place to read environment + decide whether we run on live APIs or
 * realistic mock fixtures. The whole app works with no keys set; the moment
 * the relevant env vars are present it switches to live data with no code
 * change.
 *
 * LLM calls can go through two interchangeable providers:
 *   1. Token Router (OpenAI-compatible gateway) — preferred when configured.
 *   2. Kimi / Moonshot direct — used as the primary or as an automatic
 *      fallback if Token Router errors.
 */

export const KIMI_API_KEY = process.env.KIMI_API_KEY ?? "";
export const KIMI_BASE_URL =
  process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
export const KIMI_MODEL = process.env.KIMI_MODEL ?? "kimi-k2.6";

export const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY ?? "";
export const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE ?? "";

export const TOKEN_ROUTER_API_KEY = process.env.TOKEN_ROUTER_API_KEY ?? "";
export const TOKEN_ROUTER_BASE_URL =
  process.env.TOKEN_ROUTER_BASE_URL ?? "https://api.tokenrouter.com/v1";
/** Token Router prefixes provider to the model id, e.g. moonshotai/kimi-k2.6. */
export const TOKEN_ROUTER_MODEL =
  process.env.TOKEN_ROUTER_MODEL ?? "moonshotai/kimi-k2.6";

/**
 * Which provider to try first for LLM calls: "kimi" or "tokenrouter".
 * Defaults to Kimi because it is funded and working; switch to "tokenrouter"
 * once that account has credit to route spend/usage through the gateway.
 */
export const LLM_PRIMARY = (process.env.LLM_PRIMARY ?? "kimi").toLowerCase();

/**
 * kimi-k2.6 only accepts temperature = 1. Centralized so the value is correct
 * for the configured model everywhere.
 */
export const LLM_TEMPERATURE = Number(process.env.LLM_TEMPERATURE ?? "1");

/** Force mocks regardless of keys with FINNSMART_USE_MOCKS=true. */
const FORCE_MOCKS = process.env.FINNSMART_USE_MOCKS === "true";

/** Log + return per-phase timing on analysis runs (server terminal). */
export function profileEnabled(): boolean {
  return process.env.FINNSMART_PROFILE === "true";
}

export function tokenRouterConfigured(): boolean {
  return !FORCE_MOCKS && TOKEN_ROUTER_API_KEY.length > 0;
}

export function kimiConfigured(): boolean {
  return !FORCE_MOCKS && KIMI_API_KEY.length > 0;
}

/** True when at least one LLM provider (Token Router or Kimi) is available. */
export function llmConfigured(): boolean {
  return tokenRouterConfigured() || kimiConfigured();
}

export function brightDataConfigured(): boolean {
  return !FORCE_MOCKS && BRIGHTDATA_API_KEY.length > 0 && BRIGHTDATA_ZONE.length > 0;
}

/** True when at least one external dependency is mocked. */
export function usingMocks(): boolean {
  return !llmConfigured() || !brightDataConfigured();
}
