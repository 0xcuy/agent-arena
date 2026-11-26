import type { ResearchSpec, SourceLink } from "../../types.js";
import type { SourceApi } from "./sources.js";
import type { RefreshCtx, Refreshed, SeedInput } from "./refreshers-part1.js";
import { refreshChCpi, refreshChTurnout, refreshChWarMateriel, refreshDeCpi } from "./refreshers-part1.js";
import {
  refreshBunReleases,
  refreshEsVox,
  refreshFideMatch,
  refreshGoRelease,
  refreshIetfBallot,
  refreshNodeReleases,
  refreshWikipedia,
} from "./refreshers-part2.js";

/**
 * Registry: research seeds + the refresher each spec is mined through.
 * specs.ts holds the frozen Nov-26 fallback numbers ONLY as a seed; a run
 * always calls `refreshSpec` and uses whatever the sources say NOW.
 */

export type { Refreshed, SeedInput } from "./refreshers-part1.js";
export { LiveMiningError } from "./refreshers-part1.js";

export interface ResearchSeed {
  kind: import("./refreshers-part1.js").RefreshKind;
  topic: string;
  marketAddress: string;
  miningPath: 1 | 2 | 3;
  langs: string[];
  market: Record<string, unknown>;
  assumptions: Record<string, unknown>;
  sources: Record<string, SourceLink>;
  /** Frozen Nov-26 fallback — structure only; figures are never submitted without a refresh. */
  frozen?: Partial<ResearchSpec> & { note?: string };
}

export const RESEARCH_SEEDS: ResearchSeed[] = [
  {
    kind: "de-cpi",
    topic: "de-cpi-nov",
    marketAddress: "0x0d79f61a3cf6c6a83501fcb6abd22eddb4ab6a58",
    miningPath: 1,
    langs: ["de", "en"],
    market: { thresholdPct: 2.8 },
    assumptions: {
      novMomPct10y: [0.1, 0.2, -0.1, 0.3, 0.0, 0.5, 0.0, 0.2, 0.1, 0.0],
    },
    sources: {
      destatisOct: {
        url: "https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html",
        label: "Destatis VPI Oktober 2026 (KORREKTUR)",
        lang: "de",
        access: "scraped",
      },
      destatisNovPrev: {
        url: "https://www.destatis.de/DE/Presse/Pressemitteilungen/2025/12/PD25_447_611.html",
        label: "Destatis VPI November 2025",
        lang: "de",
        access: "scraped",
      },
    },
    frozen: {
      note: "run-1 frozen spec used a fictional 118,2/115,4 series with an unverifiable 'Indexstand 118,4' needle; replaced by live Destatis parsing.",
    },
  },
  {
    kind: "ch-turnout",
    topic: "ch-vote-turnout",
    marketAddress: "0x94dbba7c9b44b788a701602ab6d919ff7b7fc38a",
    miningPath: 3,
    langs: ["de", "fr"],
    market: { thresholdPct: 50.0 },
    assumptions: { intentionOffsetPct: 1.5, sdPct: 2.0 },
    sources: {
      stadtZh: {
        url: "https://www.stadt-zuerich.ch/de/aktuell/news/2026/stimmbeteiligung.html",
        label: "Stadt Zürich Stand Stimmbeteiligung (postal return)",
        lang: "de",
        access: "scraped",
      },
      gfsbern: {
        url: "https://www.gfsbern.ch/de/news/2-srg-trendumfrage-zur-eidg-abstimmung-vom-29-november-2026/",
        label: "gfs.bern 2nd SRG trend survey 29.11.2026",
        lang: "de",
        access: "scraped",
      },
    },
  },
  {
    kind: "ch-war-materiel",
    topic: "ch-war-materiel",
    marketAddress: "0x191257a08df3a827a9a02fa54926ed9507b4497a",
    miningPath: 3,
    langs: ["de", "fr"],
    market: { thresholdPct: 50.0, currentVote: "Kriegsmaterialgesetz-Aenderung 2026-11-29" },
    assumptions: {
      pollToFinalHistory: [
        { vote: "2026-05-17", pollYesPct: 48.5, finalYesPct: 45.2 },
        { vote: "2025-09-28", pollYesPct: 54.0, finalYesPct: 52.6 },
        { vote: "2026-02-08", pollYesPct: 46.2, finalYesPct: 49.9 },
        { vote: "2025-05-18", pollYesPct: 55.3, finalYesPct: 56.4 },
        { vote: "2024-11-24", pollYesPct: 51.7, finalYesPct: 53.1 },
        { vote: "2025-01-19", pollYesPct: 42.9, finalYesPct: 40.6 },
        { vote: "2024-06-09", pollYesPct: 47.8, finalYesPct: 46.3 },
        { vote: "2023-11-26", pollYesPct: 50.4, finalYesPct: 48.4 },
      ],
    },
    sources: {
      gfsbern: {
        url: "https://www.gfsbern.ch/de/news/2-srg-trendumfrage-zur-eidg-abstimmung-vom-29-november-2026/",
        label: "gfs.bern 2nd SRG trend survey 29.11.2026 (KM 49/46)",
        lang: "de",
        access: "scraped",
      },
    },
  },
  {
    kind: "es-vox",
    topic: "es-vox-seats",
    marketAddress: "0x55b0fabfcdf6125415854cc193ecd8cdc75bc382",
    miningPath: 3,
    langs: ["es"],
    market: { thresholdSeats: 60 },
    assumptions: { seatEstimateSd: 3.5 },
    sources: {
      electografica: {
        url: "https://www.electografica.com/2026/11/encuesta-data10-261123.html",
        label: "Electografía/Data10 26N tracking",
        lang: "es",
        access: "scraped",
      },
    },
  },
  {
    kind: "ch-cpi",
    topic: "ch-cpi-nov",
    marketAddress: "0xecace7b63b2e044dd339e7512cf4360713a8e156",
    miningPath: 1,
    langs: ["de", "en"],
    market: { thresholdPct: 1.6 },
    assumptions: {
      novMomPct10y: [-0.2, -0.1, 0.0, 0.1, 0.1, -0.1, 0.0, 0.2, 0.1, -0.1],
    },
    sources: {
      bfsOct26New: {
        url: "https://www.admin.ch/de/newnsb/UA8hylpLYO6i",
        label: "BFS news: LIK Oktober 2026 (Dez 2025=100)",
        lang: "de",
        access: "scraped",
      },
      bfsNov25Old: {
        url: "https://www.edi.admin.ch/de/newnsb/bgwS3ubvTRAV",
        label: "BFS news: LIK November 2025 (Dez 2020=100)",
        lang: "de",
        access: "scraped",
      },
      bfsDec25Old: {
        url: "https://statistik.admin.ch/de/news/2026-0005",
        label: "BFS news: LIK Dezember 2025 (Dez 2020=100, base-chain anchor)",
        lang: "de",
        access: "scraped",
      },
    },
  },
  {
    kind: "ietf-ballot",
    topic: "ietf-mna-ioam-discuss",
    marketAddress: "0xda5d046f5bac4bbfa5abe32bc52787725548d4ee",
    miningPath: 2,
    langs: ["en"],
    market: { doc: "draft-ietf-mpls-mna-ioam-18" },
    assumptions: { comparableDrafts: 12, comparableDraftsWithDiscuss: 9 },
    sources: {
      ballot: {
        url: "https://datatracker.ietf.org/doc/draft-ietf-mpls-mna-ioam/ballot/",
        label: "IETF Datatracker IESG evaluation record",
        lang: "en",
        access: "scraped",
      },
    },
  },
  {
    kind: "fide-match",
    topic: "fide-game8",
    marketAddress: "0x42fdc3fb099766fd01289f215cd399146e1f224e",
    miningPath: 2,
    langs: ["en"],
    market: { targetGame: 8 },
    assumptions: { drawShare: 0.75 },
    sources: {
      fideNews: {
        url: "https://www.fide.com/new-documents/",
        label: "FIDE official factsheets (WCC 2026)",
        lang: "en",
        access: "scraped",
      },
      worldchess: {
        url: "https://worldchess.com/watch/fide-world-chess-championship-2026",
        label: "World Chess WCC 2026 event page (ratings)",
        lang: "en",
        access: "scraped",
      },
    },
  },
  {
    kind: "wikipedia",
    topic: "wikipedia-articles",
    marketAddress: "0x7a17b76f7f1cda20e8bc5a88166c4732e6db39f5",
    miningPath: 2,
    langs: ["en"],
    market: { targetCount: 7275500, cutoffAt: "2026-12-10T12:00:00.000Z" },
    assumptions: { dailyNetSd: 60 },
    sources: {
      siteinfoApi: {
        url: "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json",
        label: "English Wikipedia siteinfo statistics API",
        lang: "en",
        access: "api-json",
      },
      sizePage: {
        url: "https://en.wikipedia.org/wiki/Wikipedia:Size_of_Wikipedia",
        label: "Wikipedia:Size of Wikipedia growth table",
        lang: "en",
        access: "scraped",
      },
    },
  },
  {
    kind: "bun-releases",
    topic: "bun-release",
    marketAddress: "0x921e39354e4bfc18251ad1b1c80eec1a3940ab82",
    miningPath: 2,
    langs: ["en"],
    market: { windowStart: "2026-11-28", windowEnd: "2026-12-11" },
    assumptions: {},
    sources: {
      bunApi: {
        url: "https://api.github.com/repos/oven-sh/bun/releases?per_page=15",
        label: "oven-sh/bun GitHub releases API",
        lang: "en",
        access: "api-json",
      },
    },
  },
  {
    kind: "go-release",
    topic: "go-1-27-5",
    marketAddress: "0xf640443d15af94932e1a7294c15312f0ad9e1136",
    miningPath: 2,
    langs: ["en"],
    market: {
      minorPrefix: "go1.27.",
      milestoneTitle: "Go1.27.5",
      milestonesUrl: "https://api.github.com/repos/golang/go/milestones?state=all&per_page=100&page={page}",
      windowEnd: "2026-12-07",
    },
    assumptions: {},
    sources: {
      goDevel: {
        url: "https://go.dev/doc/devel/release",
        label: "go.dev release history",
        lang: "en",
        access: "scraped",
      },
    },
  },
  {
    kind: "node-releases",
    topic: "node-v26-latest",
    marketAddress: "0x3c8a98eb4ebca3156af93bf85c76bb3ac13ab4b0",
    miningPath: 2,
    langs: ["en"],
    market: { versionLine: "26", windowEnd: "2026-12-10", minVersion: "26.14.0" },
    assumptions: {},
    sources: {
      nodeDist: {
        url: "https://nodejs.org/dist/index.json",
        label: "nodejs.org/dist index JSON",
        lang: "en",
        access: "api-json",
      },
    },
  },
];

const REFRESHERS: { [k in import("./refreshers-part1.js").RefreshKind]: (seed: SeedInput, api: SourceApi, ctx: RefreshCtx) => Promise<Refreshed> } = {
  "de-cpi": refreshDeCpi,
  "ch-turnout": refreshChTurnout,
  "ch-war-materiel": refreshChWarMateriel,
  "es-vox": refreshEsVox,
  "ch-cpi": refreshChCpi,
  "ietf-ballot": refreshIetfBallot,
  "fide-match": refreshFideMatch,
  wikipedia: refreshWikipedia,
  "bun-releases": refreshBunReleases,
  "go-release": refreshGoRelease,
  "node-releases": refreshNodeReleases,
};

export const SEEDS_BY_MARKET = new Map(RESEARCH_SEEDS.map((s) => [s.marketAddress, s]));

/** Refresh one seed into a live ResearchSpec. Errors mean the market is skipped. */
export function refreshSeed(seed: ResearchSeed, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const fn = REFRESHERS[seed.kind];
  if (!fn) {
    return Promise.reject(new Error(`no refresher registered for kind "${seed.kind}"`));
  }
  return fn(
    {
      topic: seed.topic,
      marketAddress: seed.marketAddress,
      miningPath: seed.miningPath,
      langs: seed.langs,
      market: seed.market,
      assumptions: seed.assumptions,
      sources: seed.sources,
    },
    api,
    ctx,
  );
}
