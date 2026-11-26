import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { AgentConfig } from "../../config.js";
import { MOCK_NOW } from "../../delphi/fixtures.js";

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

export const FETCH_STALENESS_MS = 2 * 60 * 60 * 1000; // 2 hours

const FIXTURES_PATH = fileURLToPath(new URL("./fixtures.json", import.meta.url));

/** Recorded snapshots of real HTTP-200 fetches (see FIX-REPORT / fixtures provenance). */
export const LIVE_FIXTURES: Record<string, string> = JSON.parse(readFileSync(FIXTURES_PATH, "utf-8"));

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

export function createSources(cfg: AgentConfig, opts?: { mockNow?: string }): SourceApi {
  if (cfg.mode === "mock") {
    const fetchedAt = opts?.mockNow ?? MOCK_NOW;
    return {
      mock: true,
      fetch: async (url: string) => {
        const body = LIVE_FIXTURES[url];
        if (body === undefined) {
          // A missing fixture is a hard fail: never fall back to invented content.
          throw new Error(`mock source missing for ${url} (no fixture — refusing to invent content)`);
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
