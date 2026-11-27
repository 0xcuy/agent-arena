import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AgentConfig } from "../../config.js";

/**
 * Live-source fetch layer. Zero-hallucination invariant: every number that
 * enters a note must come from a SourceDoc produced here — an HTTP 200
 * response fetched in THIS run whose fetchedAt is < 2 hours old (live mode),
 * or in mock mode the recorded snapshot of exactly such a fetch.
 *
 * No spec, fixture or fallback path may inject figures directly; refreshers
 * parse them out of SourceDocs.
 */

export interface SourceDoc {
  url: string;
  body: string;
  json?: unknown;
  fetchedAt: string;
  status: number;
  mock: boolean;
}

export interface SourceApi {
  readonly mock: boolean;
  fetch(url: string, kind?: "json" | "text"): Promise<SourceDoc>;
}

/** SourceApi with a test seam: reroute fetches (e.g. to an in-memory server). */
export interface OverrideSourceApi extends SourceApi {
  readonly underlying: SourceApi;
  setNext(doc: SourceDoc | Error): void;
}

/**
 * Wrap a SourceApi so every fetch can be observed or replaced. The refresher
 * code path (fresh() / refreshSeed) is exercised unchanged; tests capture the
 * requested URL and stub the response.
 */
export function withFetchOverride(
  underlying: SourceApi,
  impl: (url: string, fallback: () => Promise<SourceDoc>) => Promise<SourceDoc>,
): OverrideSourceApi {
  const calls: string[] = [];
  const api: OverrideSourceApi = {
    mock: underlying.mock,
    underlying,
    setNext(doc: SourceDoc | Error) {
      next = doc;
    },
    fetch(url) {
      calls.push(url);
      return impl(url, () => underlying.fetch(url));
    },
  };
  let next: SourceDoc | Error | undefined;
  Object.defineProperty(api, "calls", { get: () => calls });
  return api;
}

export const FETCH_STALENESS_MS = 2 * 60 * 60 * 1000; // 2 hours

const FIXTURES_PATH = fileURLToPath(new URL("./fixtures.json", import.meta.url));
const FIXTURES_META_PATH = fileURLToPath(new URL("./fixtures-meta.json", import.meta.url));

/** Recorded snapshots of real HTTP-200 fetches (see FIX-REPORT / fixtures provenance). */
export const LIVE_FIXTURES: Record<string, string> = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8"));

/**
 * The recorded fetch time of each fixture snapshot: when that body was actually
 * fetched (2026-11-26 ~03:50-04:30 UTC recording session, all URLs re-verified
 * HTTP 200 at ~04:15 UTC — per-URL second-level times were not recorded).
 * Mock-mode SourceDocs carry THIS timestamp, never the mock run clock, so notes
 * and CSVs never misrepresent when a source was fetched. A fixture without a
 * recorded fetch time is a hard fail.
 */
export const FIXTURE_FETCHED_AT: Record<string, string> = JSON.parse(readFileSync(FIXTURES_META_PATH, "utf-8"));

export function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

const UA = "siera-labs-evidence-miner/1.0 (+https://delphi.fyi)";

/** True when mock mode has a recorded fixture for this URL (never fetches). */
export function hasMockFixture(url: string): boolean {
  return LIVE_FIXTURES[url] !== undefined;
}

export function createSources(cfg: AgentConfig): SourceApi {
  if (cfg.mode === "mock") {
    return {
      mock: true,
      fetch: async (url: string) => {
        const body = LIVE_FIXTURES[url];
        if (body === undefined) {
          // A missing fixture is a hard fail: never fall back to invented content.
          throw new Error(`mock source missing for ${url} (no fixture — refusing to invent content)`);
        }
        const fetchedAt = FIXTURE_FETCHED_AT[url];
        if (fetchedAt === undefined) {
          // Mock mode must carry the real recorded fetch time, never the mock clock.
          throw new Error(`mock source ${url} has no recorded fetchedAt in fixtures-meta.json (refusing to invent a fetch time)`);
        }
        const doc: SourceDoc = { url, body, fetchedAt, status: 200, mock: true };
        if (looksLikeJsonBody(body)) doc.json = JSON.parse(body);
        return doc;
      },
    };
  }
  return {
    mock: false,
    fetch: async (url: string, kind?: "json" | "text") => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 20_000);
      try {
        const res = await fetch(url, {
          signal: controller.signal,
          headers: { "User-Agent": UA, Accept: kind === "json" ? "application/json" : "text/html" },
          redirect: "follow",
        });
        if (res.status !== 200) {
          throw new Error(`source fetch for ${url} returned HTTP ${res.status} (200 required)`);
        }
        const raw = await res.text();
        const isJson = kind === "json" || looksLikeJsonBody(raw);
        const body = isJson ? raw : htmlToText(raw);
        const doc: SourceDoc = { url, body, fetchedAt: new Date().toISOString(), status: res.status, mock: false };
        if (isJson) {
          try {
            doc.json = JSON.parse(raw);
          } catch {
            throw new Error(`source fetch for ${url} returned invalid JSON`);
          }
        }
        return doc;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

function looksLikeJsonBody(body: string): boolean {
  const t = body.trimStart();
  if (!(t.startsWith("{") || t.startsWith("["))) return false;
  try {
    JSON.parse(body);
    return true;
  } catch {
    return false;
  }
}

/** Enforce the <2h staleness rule on a fetched doc (live mode). */
export function assertFresh(doc: SourceDoc, now: Date): void {
  const age = now.getTime() - new Date(doc.fetchedAt).getTime();
  if (age < -60_000 || age > FETCH_STALENESS_MS) {
    throw new Error(`source ${doc.url} fetched_at ${doc.fetchedAt} is not within 2h of run time (stale — refusing)`);
  }
}
