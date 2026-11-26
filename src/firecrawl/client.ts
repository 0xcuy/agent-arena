import type { AgentConfig } from "../config.js";

/**
 * Firecrawl scraper abstraction.
 * Live: POST /v1/scrape with markdown extraction.
 * Mock: returns fixture markdown per URL so mining path 3 (non-English scraping)
 * exercises the same code path offline.
 */

export interface ScrapeResult {
  url: string;
  markdown: string;
  fetchedAt: string;
  mock: boolean;
}

/** Deterministic fixture scrapes (mock mode). Content mirrors what the source page
 *  shows on 2026-11-26 (UTC) minus any JS-dependent chrome. */
export const SCRAPE_FIXTURES: Record<string, string> = {
  // Path 3 fixture: German-language Destatis press area (static HTML page).
  "https://www.destatis.de/EN/Press/2026/11/PE26_4xx.html": `# Destatis – Verbraucherpreisindex (VPI)
Pressemitteilung vom 13. November 2026 (Vorkorrektur Oktober 2026)
- VPI Oktober 2026: +2,6 % zum Vorjahresmonat (Vorkorrektur), Indexstand 118,4 (2020=100)
- VPI November 2026: Veröffentlichung der Vorkorrektur am 30. November 2026, 13:00 MEZ
Regionalwerte und Zeitreihen: GENESIS-Online Tabelle 61211-0004.`,

  // Path 3 fixtures: Swiss cantonal chancellor pages (DE/FR) with postal ballot return rates.
  "https://www.bk.admin.ch/ch/de/aktuell/abstimmungen/postvoting-2026-11-26": `# Bundeskanzlei – Postal Voting Rücklauf, Stand 26.11.2026
Kantonale Rücklaufquoten (eingegangene Stimmscheine / versandte), 8 Tage vor Abstimmung:
- ZH: 38,2 % (Vergleich Vorlage 2025-09: 36,9 %)
- BE: 35,7 % (Vergleich: 34,1 %)
- VD: 33,1 % (Vergleich: 32,2 %)
- TI: 41,0 % (Vergleich: 39,4 %)
- SG: 36,8 % (Vergleich: 35,1 %)`,
  "https://www.bk.admin.ch/ch/fr/actualite/votations/postvoting-2026-11-26": `# Chancellerie fédérale – Taux de retour postal, état au 26.11.2026
- ZH: 38,2 % (référence votation 2025-09: 36,9 %)
- BE: 35,7 % (référence: 34,1 %)
- VD: 33,1 % (référence: 32,2 %)
- TI: 41,0 % (référence: 39,4 %)`,

  // Path 3 fixture: SRG regional poll aggregation (DE) for Nov 29 vote.
  "https://www.srg-research.ch/de/wahlbarometer-2026-11-26": `# SSR Research – Wählbarometer, 26.11.2026
Bundesabstimmung 29.11.2026, n=24'118, Feld: 21.-25.11.2026:
- Ja-Anteil Kriegsmaterialgesetz-Änderung: DE-Schweiz 55,8 %, FR-Schweiz 48,9 %, TI 45,2 %
- Positiv für die Vorlage: SVP-Wählerschaft 71 %, FDP 63 %, Mitte 52 %
- Negativ: SP 31 %, Grüne 27 %`,

  // Path 3 fixture: Spanish-language tracking poll aggregator page.
  "https://www.electografia.es/sondeos-general-26n/2026-11-25": `# Electografía – Sondeos 26N, actualizado 25.11.2026
Media de sondeos (3 encuestas, 21-24.11, n total 6.410):
- PP: 32,4 %  |  PSOE: 29,8 %  |  Vox: 16,2 %  |  Sumar: 10,4 %
Proyección de escaños por provincia (método D'Hondt, ver tabla):
- Vox: Madrid 11-13, Sevilla 4-5, Valencia 5-6, Barcelona 6-7, Málaga 2-3, resto provincial 27-31`,

  // Path 2 fixture: IETF Datatracker ballot page (machine-readable doc state).
  "https://datatracker.ietf.org/doc/draft-ietf-mpls-mna-ioam/ballot/": `# IESG Evaluation Record: draft-ietf-mpls-mna-ioam
Document state: IESG Evaluation. Ballot not yet opened (writeup pending, AD shepherd: RFC-to-be approved 2026-11-20).
Positions: (none recorded yet - ballot opens after writeup)
Directorate reviews on record:
- TEAS Directorate (2026-11-18): Ready with issues - TLV length checks underspecified, 2 blocking-level comments
- MPLS-RT (2026-11-21): 2 open review tickets on the IOAM trace-flag registry, unaddressed
Last Call comments outstanding: 3`,

  // Path 2 fixture: FIDE World Championship match page (Game 8 color allocation).
  "https://worldchampionship2026.fide.com/en/match/score/": `# FIDE World Chess Championship 2026 - Sindarov vs Gukesh
Standings after Game 7 (2026-11-26, rest day): Sindarov 4.0 - Gukesh 3.5.
Game 8 official color allocation (published 2026-11-26 09:00 UTC): Sindarov plays White, Gukesh Black (Dec 3, 2026, 14:00 local).
Remaining schedule: Game 8 Dec 3 (Sindarov W), Game 9 Dec 5 (Gukesh W), Game 10 Dec 7 (Sindarov W), Game 11 Dec 9 (Gukesh W), Game 12 Dec 11 (Sindarov W).
Earlier pairing rule: 7-game cycle, Sindarov opened the match with White.`,

  // Path 2 fixture: go.dev release list (static page).
  "https://go.dev/doc/devel/release": `# Release History
- go1.27.4 (released November 12, 2026)
- go1.27.3 (released October 15, 2026)
- go1.27.2 (released September 17, 2026)
- go1.27.1 (released August 20, 2026)
- go1.27.0 (released July 23, 2026)
Current development cycle: go1.28 (expected February 2027). go1.27.5 carries 14 open milestone blockers (14 open / 87 closed on the Go1.27.5 milestone).`,

  // Path 2 fixtures: public machine-readable endpoints.
  "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json": `{"query":{"statistics":{"articles":7271234,"pages":64011322,"edits":1240001122,"activeusers":119204}}}`,
  "https://api.github.com/repos/oven-sh/bun/releases?per_page=15": `[
  {"tag_name": "bun-v1.4.5", "published_at": "2026-11-24T10:00:00Z"},
  {"tag_name": "bun-v1.4.4", "published_at": "2026-11-13T10:00:00Z"},
  {"tag_name": "bun-v1.4.3", "published_at": "2026-11-01T10:00:00Z"},
  {"tag_name": "bun-v1.4.2", "published_at": "2026-10-22T10:00:00Z"},
  {"tag_name": "bun-v1.4.1", "published_at": "2026-10-12T10:00:00Z"},
  {"tag_name": "bun-v1.4.0", "published_at": "2026-09-28T10:00:00Z"},
  {"tag_name": "bun-v1.3.9", "published_at": "2026-09-17T10:00:00Z"},
  {"tag_name": "bun-v1.3.8", "published_at": "2026-09-04T10:00:00Z"},
  {"tag_name": "bun-v1.3.7", "published_at": "2026-08-22T10:00:00Z"},
  {"tag_name": "bun-v1.3.6", "published_at": "2026-08-10T10:00:00Z"},
  {"tag_name": "bun-v1.3.5", "published_at": "2026-07-29T10:00:00Z"},
  {"tag_name": "bun-v1.3.4", "published_at": "2026-07-15T10:00:00Z"},
  {"tag_name": "bun-v1.3.3", "published_at": "2026-07-01T10:00:00Z"},
  {"tag_name": "bun-v1.3.2", "published_at": "2026-06-20T10:00:00Z"},
  {"tag_name": "bun-v1.3.1", "published_at": "2026-06-02T10:00:00Z"}
]`,
  "https://api.github.com/repos/golang/go/milestones/305": `{"title":"Go1.27.5","open_issues":14,"closed_issues":87,"state":"open","created_at":"2026-10-28T12:00:00Z"}`,
};

export interface FirecrawlApi {
  scrape(url: string): Promise<ScrapeResult>;
  readonly mock: boolean;
}

export function createFirecrawl(cfg: AgentConfig): FirecrawlApi {
  if (cfg.mode === "mock" || !cfg.firecrawlApiKey) {
    return {
      mock: true,
      scrape: async (url: string) => ({
        url,
        markdown: SCRAPE_FIXTURES[url] ?? "",
        fetchedAt: "2026-11-26T11:30:00.000Z",
        mock: true,
      }),
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
  };
}
