/**
 * Central place to read environment + decide whether we run on live APIs or
 * realistic mock fixtures. The whole app works with no keys set; the moment
 * the three env vars are present it switches to live data with no code change.
 */

export const KIMI_API_KEY = process.env.KIMI_API_KEY ?? "";
export const KIMI_BASE_URL =
  process.env.KIMI_BASE_URL ?? "https://api.moonshot.ai/v1";
export const KIMI_MODEL = process.env.KIMI_MODEL ?? "kimi-k2.6";

export const BRIGHTDATA_API_KEY = process.env.BRIGHTDATA_API_KEY ?? "";
export const BRIGHTDATA_ZONE = process.env.BRIGHTDATA_ZONE ?? "";

/** Force mocks regardless of keys with FINNSMART_USE_MOCKS=true. */
const FORCE_MOCKS = process.env.FINNSMART_USE_MOCKS === "true";

export function kimiConfigured(): boolean {
  return !FORCE_MOCKS && KIMI_API_KEY.length > 0;
}

export function brightDataConfigured(): boolean {
  return !FORCE_MOCKS && BRIGHTDATA_API_KEY.length > 0 && BRIGHTDATA_ZONE.length > 0;
}

/** True when at least one external dependency is mocked. */
export function usingMocks(): boolean {
  return !kimiConfigured() || !brightDataConfigured();
}
