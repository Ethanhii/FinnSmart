import "server-only";

import { createHash } from "crypto";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import {
  VIDEO_DB_API_KEY,
  VIDEODB_COLLECTION,
  videoDbConfigured,
} from "@/lib/config";
import type { NewsItem } from "@/lib/integrations/brightdata";

const API_BASE = "https://api.videodb.io";
const CACHE_DIR = path.join(process.cwd(), "data", "videodb-cache");
const MAX_VIDEOS_PER_ENTITY = 1;
const MAX_VIDEOS_PER_RUN = 3;
const TRANSCRIPT_POLL_MS = 3_000;
const TRANSCRIPT_TIMEOUT_MS = 90_000;

let runVideoBudget = MAX_VIDEOS_PER_RUN;

/** Call at the start of each analyze run to cap VideoDB usage. */
export function resetVideoEnrichBudget(max = MAX_VIDEOS_PER_RUN): void {
  runVideoBudget = max;
}

interface TranscriptSegment {
  text?: string;
  start?: number;
  end?: number;
}

interface VideoDbResponse<T = unknown> {
  success?: boolean;
  status?: string;
  message?: string;
  data?: T;
}

interface UploadResult {
  id?: string;
}

interface TranscriptResult {
  transcript?: TranscriptSegment[];
}

interface CacheEntry {
  url: string;
  insight: string;
  cachedAt: string;
}

function cachePath(url: string): string {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 24);
  return path.join(CACHE_DIR, `${hash}.json`);
}

async function readCache(url: string): Promise<string | null> {
  try {
    const raw = await readFile(cachePath(url), "utf8");
    const parsed = JSON.parse(raw) as CacheEntry;
    return parsed.insight?.trim() || null;
  } catch {
    return null;
  }
}

async function writeCache(url: string, insight: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });
  const entry: CacheEntry = { url, insight, cachedAt: new Date().toISOString() };
  await writeFile(cachePath(url), JSON.stringify(entry, null, 2), "utf8");
}

async function videodbRequest<T>(
  route: string,
  init: RequestInit = {}
): Promise<VideoDbResponse<T>> {
  const res = await fetch(`${API_BASE}${route}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-access-token": VIDEO_DB_API_KEY,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });

  const text = await res.text();
  let body: VideoDbResponse<T> = {};
  try {
    body = JSON.parse(text) as VideoDbResponse<T>;
  } catch {
    if (!res.ok) throw new Error(`VideoDB ${res.status}: ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(
      body.message ?? `VideoDB ${res.status}: ${text.slice(0, 200)}`
    );
  }

  return body;
}

/** YouTube or other URLs VideoDB can ingest as video. */
export function isVideoCandidate(item: Pick<NewsItem, "url" | "title">): boolean {
  const url = item.url.toLowerCase();
  if (
    url.includes("youtube.com/watch") ||
    url.includes("youtube.com/shorts") ||
    url.includes("youtu.be/")
  ) {
    return true;
  }
  if (/\.(mp4|webm|m3u8)(\?|$)/i.test(url)) return true;
  if (/(vimeo\.com|dailymotion\.com|\/video\/|\/videos\/)/i.test(url)) return true;
  if (/\bvideo\b/i.test(item.title)) return true;
  return false;
}

function transcriptToInsight(segments: TranscriptSegment[]): string {
  const text = segments
    .map((s) => s.text?.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= 900) return text;
  return `${text.slice(0, 897)}…`;
}

async function uploadVideoUrl(url: string, name: string): Promise<string> {
  const body = await videodbRequest<UploadResult>(
    `/collection/${encodeURIComponent(VIDEODB_COLLECTION)}/upload`,
    {
      method: "POST",
      body: JSON.stringify({ url, name: name.slice(0, 120), media_type: "video" }),
    }
  );

  const id = body.data?.id;
  if (!id) throw new Error("VideoDB upload did not return a video id");
  return id;
}

async function requestTranscription(videoId: string): Promise<void> {
  await videodbRequest(`/video/${encodeURIComponent(videoId)}/transcription/`, {
    method: "POST",
    body: JSON.stringify({ language_code: "en-US", force: false }),
  });
}

async function waitForTranscript(videoId: string): Promise<string> {
  const deadline = Date.now() + TRANSCRIPT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const body = await videodbRequest<TranscriptResult>(
      `/video/${encodeURIComponent(videoId)}/transcription/?segmenter=sentence&length=1`
    );

    if (body.status === "failed") {
      throw new Error("VideoDB transcription failed");
    }

    const segments = body.data?.transcript ?? [];
    if (body.status === "completed" && segments.length > 0) {
      const insight = transcriptToInsight(segments);
      if (insight) return insight;
    }

    await sleep(TRANSCRIPT_POLL_MS);
  }

  throw new Error("VideoDB transcription timed out");
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms));
}

/** Upload a video URL, transcribe via VideoDB, return spoken insight text. */
export async function getVideoInsight(url: string, title: string): Promise<string | null> {
  if (!videoDbConfigured()) return null;

  const cached = await readCache(url);
  if (cached) return cached;

  const videoId = await uploadVideoUrl(url, title);
  await requestTranscription(videoId);
  const insight = await waitForTranscript(videoId);
  if (insight) await writeCache(url, insight);
  return insight || null;
}

/**
 * Enrich news items whose URLs are videos — adds transcript insight into snippets
 * so the existing Kimi evaluation step can use them unchanged.
 */
export async function enrichVideoNews(
  items: NewsItem[],
  opts: { maxVideos?: number } = {}
): Promise<NewsItem[]> {
  if (!videoDbConfigured() || items.length === 0 || runVideoBudget <= 0) return items;

  const maxVideos = Math.min(opts.maxVideos ?? MAX_VIDEOS_PER_ENTITY, runVideoBudget);
  const candidates = items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isVideoCandidate(item))
    .slice(0, maxVideos);

  if (candidates.length === 0) return items;

  const out = [...items];

  for (const { item, index } of candidates) {
    if (runVideoBudget <= 0) break;
    runVideoBudget -= 1;
    try {
      const insight = await getVideoInsight(item.url, item.title);
      if (!insight) continue;

      const prefix = item.snippet?.trim() ? `${item.snippet.trim()} ` : "";
      out[index] = {
        ...item,
        snippet: `${prefix}[Video transcript: ${insight}]`,
        weight: Math.min(1, (item.weight ?? 0.3) + 0.12),
      };
    } catch {
      /* keep original item on any VideoDB failure */
    }
  }

  return out;
}
