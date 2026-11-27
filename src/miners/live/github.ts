import { assertFresh } from "./sources.js";
import type { SourceDoc, SourceApi } from "./sources.js";
import { LiveMiningError } from "./refreshers-part1.js";

/**
 * Direct api.github.com fetch layer (Delphi fix 1).
 *
 * The bun/go release miners used to route api.github.com through Firecrawl,
 * which answered HTTP 415 (Unsupported Media Type) and killed both miners on
 * the 26 Nov live run. GitHub's REST API is called DIRECTLY here with the
 * documented request shape:
 *   - `Accept: application/vnd.github+json` (versioned JSON media type)
 *   - `X-GitHub-Api-Version: 2022-11-28`
 *   - NO Content-Type header on GET (a Content-Type on a bodiless GET is
 *     exactly what made the previous hop return 415).
 *
 * A non-200 response raises a LiveMiningError with the status so the pipeline
 * skips that one market instead of crashing the run.
 */

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_ACCEPT = "application/vnd.github+json";
const GITHUB_TIMEOUT_MS = 20_000;

/** The exact headers a GitHub API GET must carry (exported for the tests). */
export function githubRequestHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: GITHUB_ACCEPT,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
  };
  return headers;
}

/**
 * Fetch an api.github.com URL directly (native fetch, never Firecrawl) and
 * return it as a SourceDoc so the zero-hallucination layer (url, fetchedAt,
 * status, staleness check) still applies.
 */
export async function fetchGithubApi(url: string, api: SourceApi): Promise<SourceDoc> {
  if (api.mock) {
    // Mock mode never touches the network: the recorded fixture is the source.
    return api.fetch(url);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GITHUB_TIMEOUT_MS);
  let res: Response;
  try {
    res = await githubTransport(url, {
      signal: controller.signal,
      headers: githubRequestHeaders(),
      redirect: "follow",
    });
  } catch (err) {
    throw new LiveMiningError(`github api fetch failed for ${url}: ${(err as Error).message}`);
  } finally {
    clearTimeout(timer);
  }
  const raw = await res.text();
  const doc: SourceDoc = {
    url,
    body: raw,
    fetchedAt: new Date().toISOString(),
    status: res.status,
    mock: false,
  };
  if (raw) {
    try {
      doc.json = JSON.parse(raw);
    } catch {
      // Body is not JSON; callers requiring JSON will fail on the shape check.
    }
  }
  return doc;
}

/** Require HTTP 200 and pass the doc through the 2h-freshness gate. */
export function githubOk(doc: SourceDoc, live: boolean, now: Date): SourceDoc {
  if (doc.status !== 200) {
    throw new LiveMiningError(`github api for ${doc.url} returned HTTP ${doc.status} (200 required)`);
  }
  if (live) assertFresh(doc, now);
  return doc;
}

/**
 * The outbound transport. Tests replace this (setGithubTransportForTests) to
 * capture the exact RequestInit the production path sends and to serve 415
 * or malformed responses without any network access.
 */
let githubTransport: (url: string, init: RequestInit) => Promise<Response> = (url, init) => fetch(url, init);

/** @package — test seam only; never change transport in production code. */
export function setGithubTransportForTests(t: ((url: string, init: RequestInit) => Promise<Response>) | undefined): void {
  githubTransport = t ?? ((url, init) => fetch(url, init));
}
