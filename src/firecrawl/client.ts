import type { AgentConfig } from "../config.js";

/**
 * Firecrawl client — Path C (wave-agnostic discovery).
 *
 * Live: domain-scoped /v1/search + /v1/scrape for local-language primary
 * sources that have no machine-readable API. Discovery results are compacted
 * into a small TXT attachment (URL + UTC fetch timestamp + extracted figures),
 * never a raw page dump.
 *
 * Mock: deterministic fixture results so Path C exercises the same code offline.
 * The frozen run-1 SCRAPE_FIXTURES (dead URLs + fabricated figures) were
 * REMOVED with fix 1-2: fixtures for mock mining are recorded snapshots of
 * real HTTP-200 fetches in src/miners/live/fixtures.json.
 */

export interface ScrapeResult {
  url: string;
  markdown: string;
  fetchedAt: string;
  mock: boolean;
}

export interface DiscoverResult {
  url: string;
  title: string;
  markdown: string;
  fetchedAt: string;
}

export interface FirecrawlApi {
  readonly mock: boolean;
  scrape(url: string): Promise<ScrapeResult>;
  /** Domain-scoped search: results restricted to officially-cited domains. */
  search(query: string, opts?: { domains?: string[]; limit?: number }): Promise<DiscoverResult[]>;
}

/** Mock discovery fixture: a recorded example of a domain-scoped search hit. */
export const DISCOVER_FIXTURES: { query: string; domains: string[]; results: DiscoverResult[] }[] = [
  {
    query: "Rücklaufquote briefliche Stimmabgabe",
    domains: ["stadt-zuerich.ch", "bk.admin.ch", "admin.ch"],
    results: [
      {
        url: "https://www.stadt-zuerich.ch/de/aktuell/news/2026/stimmbeteiligung.html",
        title: "Stand Stimmbeteiligung",
        markdown: "Urnengang vom 29. November 2026: Die Stimmbeteiligung der brieflichen Stimmabgabe beträgt derzeit 39,6 Prozent.",
        fetchedAt: "2026-11-26T12:00:00.000Z",
      },
    ],
  },
];

export function createFirecrawl(cfg: AgentConfig): FirecrawlApi {
  if (cfg.mode === "mock" || !cfg.firecrawlApiKey) {
    return {
      mock: true,
      scrape: async (url: string) => {
        const fixture = DISCOVER_FIXTURES.flatMap((f) => f.results).find((r) => r.url === url);
        return {
          url,
          markdown: fixture?.markdown ?? "",
          fetchedAt: fixture?.fetchedAt ?? "2026-11-26T12:00:00.000Z",
          mock: true,
        };
      },
      search: async (query: string, opts?: { domains?: string[]; limit?: number }) => {
        const hit = DISCOVER_FIXTURES.find(
          (f) =>
            f.query.toLowerCase().includes(query.toLowerCase().slice(0, 12)) ||
            query.toLowerCase().includes(f.query.toLowerCase().slice(0, 12)),
        );
        if (!hit) return [];
        const limit = opts?.limit ?? 3;
        return hit.results
          .filter((r) => !opts?.domains || opts.domains.some((d) => new URL(r.url).hostname.endsWith(d)))
          .slice(0, limit)
          .map((r) => ({ ...r }));
      },
    };
  }
  return {
    mock: false,
    scrape: async (url: string) => {
      const res = await fetch(`${cfg.firecrawlUrl}/scrape`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, formats: ["markdown"] }),
      });
      if (!res.ok) throw new Error(`firecrawl scrape failed (${res.status}) for ${url}`);
      const body = (await res.json()) as { data?: { markdown?: string } };
      if (!body.data?.markdown) throw new Error(`firecrawl returned no markdown for ${url}`);
      return { url, markdown: body.data.markdown, fetchedAt: new Date().toISOString(), mock: false };
    },
    search: async (query: string, opts?: { domains?: string[]; limit?: number }) => {
      const res = await fetch(`${cfg.firecrawlUrl}/search`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${cfg.firecrawlApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, limit: opts?.limit ?? 5, ...(opts?.domains ? { domains: opts.domains } : {}) }),
      });
      if (!res.ok) throw new Error(`firecrawl search failed (${res.status})`);
      const body = (await res.json()) as { data?: { url?: string; title?: string; markdown?: string; description?: string }[] };
      return (body.data ?? [])
        .filter((r) => r.url)
        .map((r) => ({
          url: r.url!,
          title: r.title ?? "",
          markdown: r.markdown ?? r.description ?? "",
          fetchedAt: new Date().toISOString(),
        }));
    },
  };
}
