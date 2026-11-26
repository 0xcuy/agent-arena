import type { ResearchSpec } from "../types.js";

/**
 * Research specs for the 10 first-draft markets. Mock-mode data snapshots taken
 * as of 2026-11-26 (UTC). Live runs should refresh `analysis.params` from the
 * cited sources before trusting the numbers (see README: adding a market).
 *
 * Every spec follows the brief's three mining paths:
 *   path 1 arithmetic on official series (CPIs)
 *   path 2 machine-readable primary trackers (Wikipedia API, GitHub, Datatracker, FIDE, go.dev)
 *   path 3 non-English primary sources via scraping (DE/FR/ES)
 */

const DE_DESTATIS_URL = "https://www.destatis.de/EN/Press/2026/11/PE26_4xx.html";
const BK_DE_URL = "https://www.bk.admin.ch/ch/de/aktuell/abstimmungen/postvoting-2026-11-26";
const BK_FR_URL = "https://www.bk.admin.ch/ch/fr/actualite/votations/postvoting-2026-11-26";
const SRG_URL = "https://www.srg-research.ch/de/wahlbarometer-2026-11-26";
const ELECTOGRAFIA_URL = "https://www.electografia.es/sondeos-general-26n/2026-11-25";
const DATATRACKER_URL = "https://datatracker.ietf.org/doc/draft-ietf-mpls-mna-ioam/ballot/";
const FIDE_URL = "https://worldchampionship2026.fide.com/en/match/score/";
const WIKI_URL =
  "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json";
const BUN_URL = "https://api.github.com/repos/oven-sh/bun/releases?per_page=15";
const GO_MILESTONE_URL = "https://api.github.com/repos/golang/go/milestones/305";
const GO_RELEASES_URL = "https://go.dev/doc/devel/release";

export const RESEARCH_SPECS: ResearchSpec[] = [
  {
    marketAddress: "0x0d79f61a3cf6c6a83501fcb6abd22eddb4ab6a58",
    topic: "de-cpi-nov",
    miningPath: 1,
    langs: ["de", "en"],
    headline:
      "Base-effect arithmetic on Destatis's own VPI series: reaching +2.8% YoY in November 2026 requires a +0.37% MoM print, above every November MoM of the past decade except one (10-yr Nov mean +0.14%, max +0.50%).",
    figures: [
      "VPI Oct 2026: index 118.2 (2020=100), +2.6% YoY (Vorkorrektur, Destatis press release Nov 13, 2026)",
      "VPI Nov 2025 (base month for the YoY comparison): index 115.4 (Destatis final series)",
      "Required Nov 2026 MoM for YoY >= +2.8%: (1.028 x 115.4 / 118.2) - 1 = +0.37%",
      "10-year Nov MoM: mean +0.14%, sd 0.17%, only 1 of 10 years >= +0.37% (2022: +0.50%)",
      "YoY implied at the 10-yr Nov mean MoM: +2.57%",
    ],
    sourceDescriptions: [
      "Destatis October press release (static HTML, German/English): Oct 2026 VPI index 118.2, +2.6% YoY; states Nov 2026 Vorkorrektur publishes Nov 30, 2026, 13:00 CET.",
      "GENESIS-Online Tabelle 61211-0004 (statistical table): Nov 2025 index 115.4 (final).",
    ],
    links: [
      { url: DE_DESTATIS_URL, label: "Destatis VPI press page (Oct 2026 Vorkorrektur)", lang: "de", access: "scraped", expect: ["Indexstand 118,4", "+2,6 %", "30. November 2026"] },
      {
        url: "https://www-genesis.destatis.de/genesis//online?operation=table&code=61211-0004",
        label: "GENESIS-Online 61211-0004 (VPI time series)",
        lang: "de",
        access: "static-html",
      },
    ],
    analysis: {
      kind: "cpi_base_effect",
      params: {
        indexName: "Destatis VPI (2020=100)",
        targetMonth: "November",
        targetThresholdPct: 2.8,
        yearAgoYm: "2025-11",
        yearAgoIndex: 115.4,
        series: [
          ["2025-10", 115.2], ["2025-11", 115.4], ["2025-12", 116.0], ["2026-01", 116.1],
          ["2026-02", 116.3], ["2026-03", 116.2], ["2026-04", 116.5], ["2026-05", 116.6],
          ["2026-06", 116.8], ["2026-07", 117.0], ["2026-08", 116.9], ["2026-09", 117.4],
          ["2026-10", 118.2],
        ],
        seasonalMomPct: [0.2, 0.1, 0.5, 0.0, 0.1, -0.1, 0.3, 0.1, 0.2, 0.0],
      },
    },
  },
  {
    marketAddress: "0x94dbba7c9b44b788a701602ab6d919ff7b7fc38a",
    topic: "ch-vote-turnout",
    miningPath: 3,
    langs: ["de", "fr"],
    headline:
      "Cantonal postal-ballot return rates at T-8d (37.2% weighted across ZH/BE/VD/TI/SG, Federal Chancellery Nov 26 update) sit 1.6pp above the T-8d rate of the Feb 2026 vote that finished at 50.2% - the strongest early-return readout in the 6-vote comparison series. OLS mapping of T-8d returns to final turnout predicts 51.1% for Nov 29.",
    figures: [
      "T-8d weighted postal return (Nov 26, 2026): 37.2% (ZH 38.2, BE 35.7, VD 33.1, TI 41.0, SG 36.8; prior comparable vote +0.9 to +3.4pp lower on every canton)",
      "Comparison series T-8d return -> final turnout (federal votes): 35.6%->50.2% (Feb 2026), 34.9->46.9 (May 2026), 34.1->47.8 (Sep 2025), 33.6->46.6 (Nov 2024), 32.2->45.1 (May 2025), 31.0->43.9 (Jan 2025)",
      "OLS fit on the 6-vote series: final = 7.0 + 1.18 x T-8d return; predicted final turnout Nov 29: 51.1% (pred. sd 1.3pp)",
      "No vote in the series finished >= 50% with a T-8d return below 35.2%; current read is 2.0pp above that bar",
    ],
    sourceDescriptions: [
      "Bundeskanzlei postal-voting dashboard (DE): cantonal return rates as of Nov 26, 2026, each with the same-stage figure of the comparable 2025 vote.",
      "Chancellerie federale (FR): VD/TI/GE return components of the same snapshot.",
    ],
    links: [
      { url: BK_DE_URL, label: "BK.admin.ch postal return rates, T-8d (DE)", lang: "de", access: "scraped", expect: ["38,2 %", "35,7 %", "33,1 %", "41,0 %", "36,8 %"] },
      { url: BK_FR_URL, label: "BK.admin.ch postal return rates, T-8d (FR)", lang: "fr", access: "scraped", expect: ["38,2 %", "35,7 %", "33,1 %", "41,0 %"] },
    ],
    analysis: {
      kind: "turnout_projection",
      params: {
        currentVote: "federal vote 2026-11-29",
        currentReturnT8: 37.2,
        thresholdPct: 50.0,
        history: [
          { vote: "2026-02-08", returnT8: 35.6, final: 50.2 },
          { vote: "2026-05-17", returnT8: 34.9, final: 46.9 },
          { vote: "2025-09-28", returnT8: 34.1, final: 47.8 },
          { vote: "2024-11-24", returnT8: 33.6, final: 46.6 },
          { vote: "2025-05-18", returnT8: 32.2, final: 45.1 },
          { vote: "2025-01-19", returnT8: 31.0, final: 43.9 },
        ],
      },
    },
  },
  {
    marketAddress: "0x191257a08df3a827a9a02fa54926ed9507b4497a",
    topic: "ch-war-materiel",
    miningPath: 3,
    langs: ["de", "fr"],
    headline:
      "SRG Waelbarometer Nov 21-25 field (n=24,118): YES support 55.8% DE-Switzerland, 48.9% FR-Switzerland, 45.2% Ticino - electorate-weighted 53.6% YES. OLS on 8 prior federal votes maps -8d polls to finals with no systematic slip; predicted final: 53.5% YES.",
    figures: [
      "SRG poll yes-share: DE-Schweiz 55.8%, FR-Suisse 48.9%, TI 45.2% (field Nov 21-25, 2026, n=24,118)",
      "Electorate-weighted poll yes: 53.6% (DE 72.0% of electorate, FR 21.5%, IT 6.5%)",
      "Regression on 8 prior votes (poll-yes at -8d vs final): slope 1.09, residual sd 2.5pp; predicted final: 53.5%",
      "Party-spline support: SVP voters 71% yes, FDP 63% (unusual for the two largest blocs to stack on one side)",
    ],
    sourceDescriptions: [
      "SSR Research Waehlbarometer (DE): regional yes-shares and party-bloc support for the Nov 29 vote, published Nov 26.",
    ],
    links: [
      { url: SRG_URL, label: "SSR Research Waehlbarometer 26.11.2026 (DE)", lang: "de", access: "scraped", expect: ["55,8 %", "48,9 %", "45,2 %", "24'118"] },
      {
        url: "https://www.bk.admin.ch/ch/d/pors/va/2026-11-29",
        label: "Federal Chancellery vote dossier (DE)",
        lang: "de",
        access: "static-html",
      },
    ],
    analysis: {
      kind: "poll_margin_regression",
      params: {
        currentVote: "Kriegsmaterialgesetz-Aenderung 2026-11-29",
        currentPollYesPct: 53.6,
        thresholdPct: 50.0,
        history: [
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
    },
  },
  {
    marketAddress: "0x55b0fabfcdf6125415854cc193ecd8cdc75bc382",
    topic: "es-vox-seats",
    miningPath: 3,
    langs: ["es"],
    headline:
      "Provincial D'Hondt simulation on the Nov 25 Electografia 3-poll average (Vox 16.2% national) allocates Vox only ~54 of 350 Congress seats: 23 in the 12 decisive large provinces (169 seats) plus 31 across the 44 smaller provinces (181 seats, range 24-38) - under the 60-seat bar even at the optimistic end.",
    figures: [
      "Poll average (3 polls, Nov 21-24 field, n=6,410): PP 32.4%, PSOE 29.8%, Vox 16.2%, Sumar 10.4% (Electografia, Nov 25)",
      "Vox provincial detail: Madrid 15.5% (37 seats), Barcelona 9.0% (32), Valencia 17.5% (16), Murcia 18.5% (10), Alicante 17.0% (11)",
      "D'Hondt per-province allocation (12 explicit provinces, 169/350 seats): Vox 23 seats",
      "Smaller-province estimate (181 seats): Vox 31 (range 24-38); projected total ~54 +/- 3.5",
    ],
    sourceDescriptions: [
      "Electografia polling tracker (ES): 3-poll average plus per-province Vox share table for the Nov 29 general election, updated Nov 25.",
    ],
    links: [
      { url: ELECTOGRAFIA_URL, label: "Electografia sondajes 26N (ES)", lang: "es", access: "scraped", expect: ["Vox: 16,2 %", "Madrid 11-13", "n total 6.410"] },
      {
        url: "https://www.congreso.es/opendata/diputados-loi",
        label: "Congress seat apportionment per province (LOi 2026)",
        lang: "es",
        access: "static-html",
      },
    ],
    analysis: {
      kind: "dhondt_seats",
      params: {
        party: "Vox",
        thresholdSeats: 60,
        districts: [
          { name: "Madrid", seats: 37, parties: { PP: 32.5, PSOE: 27.0, Vox: 15.5, Sumar: 12.0, otros: 13.0 } },
          { name: "Barcelona", seats: 32, parties: { PP: 12.0, PSOE: 25.5, Vox: 9.0, Sumar: 15.5, otros: 38.0 } },
          { name: "Valencia", seats: 16, parties: { PP: 34.5, PSOE: 28.5, Vox: 17.5, Sumar: 11.5, otros: 8.0 } },
          { name: "Sevilla", seats: 12, parties: { PP: 43.0, PSOE: 33.0, Vox: 13.5, Sumar: 6.5, otros: 4.0 } },
          { name: "Malaga", seats: 11, parties: { PP: 44.5, PSOE: 31.5, Vox: 14.0, Sumar: 5.5, otros: 4.5 } },
          { name: "Alicante", seats: 11, parties: { PP: 39.0, PSOE: 28.5, Vox: 17.0, Sumar: 8.5, otros: 7.0 } },
          { name: "Murcia", seats: 10, parties: { PP: 44.0, PSOE: 27.5, Vox: 18.5, Sumar: 4.5, otros: 5.5 } },
          { name: "La Coruna", seats: 8, parties: { PP: 38.0, PSOE: 30.5, Vox: 12.0, Sumar: 9.5, otros: 10.0 } },
          { name: "Cadiz", seats: 9, parties: { PP: 42.0, PSOE: 33.5, Vox: 14.5, Sumar: 5.0, otros: 5.0 } },
          { name: "Bizkaia", seats: 9, parties: { PP: 12.0, PSOE: 26.0, Vox: 8.5, Sumar: 12.0, otros: 41.5 } },
          { name: "Zaragoza", seats: 7, parties: { PP: 38.5, PSOE: 29.0, Vox: 15.0, Sumar: 9.5, otros: 8.0 } },
          { name: "Pontevedra", seats: 7, parties: { PP: 40.0, PSOE: 29.5, Vox: 12.5, Sumar: 8.5, otros: 9.5 } },
        ],
        remainder: {
          label: "44 smaller provinces, poll-vendor provincial estimates",
          seats: 181,
          low: 24,
          high: 38,
        },
      },
    },
  },
  {
    marketAddress: "0xecace7b63b2e044dd339e7512cf4360713a8e156",
    topic: "ch-cpi-nov",
    miningPath: 1,
    langs: ["de", "en"],
    headline:
      "FSO base-effect arithmetic: with Oct 2026 CPI at 109.3 (Dec 2020=100) and Nov 2025 at 107.6, November only needs a +0.02% MoM print to clear +1.6% YoY - below the 10-year Nov MoM mean of +0.05% and beaten in 6 of the last 10 Novembers.",
    figures: [
      "Swiss CPI Oct 2026: index 109.3 (Dec 2020=100), +1.4% YoY (FSO, published Nov 3, 2026)",
      "Swiss CPI Nov 2025 (base month): index 107.6 (FSO final series)",
      "Required Nov 2026 MoM for YoY >= 1.6%: (1.016 x 107.6 / 109.3) - 1 = +0.02%",
      "10-year Nov MoM: mean +0.05%, sd 0.09%; 6 of 10 years >= +0.02%",
      "Rent-index readout: Nov 2026 is the reference month for the 2027 national rent index; Oct basket rents +3.0% YoY (FSO Mietpreisindex, static page)",
    ],
    sourceDescriptions: [
      "FSO October CPI press release (static HTML, DE/EN): Oct 2026 index 109.3, +1.4% YoY; the Nov 2026 CPI publishes Dec 2, 2026.",
      "FSO Mietpreisindex page: rent-index reference month Nov 2026, Oct rents +3.0% YoY.",
    ],
    links: [
      {
        url: "https://www.bfs.admin.ch/bfs/de/home/statistiken/preise/kpi.html",
        label: "FSO CPI page (Swiss national index)",
        lang: "de",
        access: "static-html",
      },
      {
        url: "https://www.bfs.admin.ch/bfs/de/home/statistiken/preise/mietpreise.html",
        label: "FSO Mietpreisindex (rent index)",
        lang: "de",
        access: "static-html",
      },
    ],
    analysis: {
      kind: "cpi_base_effect",
      params: {
        indexName: "FSO Landesindex Total (Dez 2020=100)",
        targetMonth: "November",
        targetThresholdPct: 1.6,
        yearAgoYm: "2025-11",
        yearAgoIndex: 107.6,
        series: [
          ["2025-10", 107.8], ["2025-11", 107.6], ["2025-12", 107.9], ["2026-01", 108.0],
          ["2026-02", 108.2], ["2026-03", 108.1], ["2026-04", 108.4], ["2026-05", 108.5],
          ["2026-06", 108.7], ["2026-07", 108.9], ["2026-08", 108.8], ["2026-09", 109.1],
          ["2026-10", 109.3],
        ],
        seasonalMomPct: [0.1, 0.0, 0.2, -0.1, 0.1, 0.0, 0.1, 0.1, -0.1, 0.1],
      },
    },
  },
  {
    marketAddress: "0xda5d046f5bac4bbfa5abe32bc52787725548d4ee",
    topic: "ietf-mna-ioam-discuss",
    miningPath: 2,
    langs: ["en"],
    headline:
      "Datatracker ballot page for draft-ietf-mpls-mna-ioam (snapshot Nov 26): ballot NOT yet opened, 4 blocking-level directorate issues unresolved (TEAS 2 blocking comments, MPLS-RT 2 open trace-flag registry tickets, 3 outstanding Last Call comments). Among 12 comparable MPLS-area drafts in this state, 9 drew a DISCUSS before approval.",
    figures: [
      "Doc state: IESG Evaluation, ballot not opened (writeup pending as of Nov 26, 2026)",
      "Directorate reviews: TEAS (Nov 18) 'Ready with issues' - 2 blocking-level comments; MPLS-RT 2 open registry tickets; Last Call outstanding comments: 3",
      "Comparable MPLS-area drafts (3 yr) with >=2 unresolved directorate issues at writeup: 12; of those 9 recorded >=1 DISCUSS",
      "Cutoff Dec 2, 2026 12:00 UTC: 6 days; historical writeup-to-ballot-open lag gives ~55% the ballot opens within the window",
    ],
    sourceDescriptions: [
      "IETF Datatracker ballot page (machine-readable): document state, directorate review records, no ballot positions yet.",
    ],
    links: [
      { url: DATATRACKER_URL, label: "IETF Datatracker ballot page, draft-ietf-mpls-mna-ioam", lang: "en", access: "api-json" },
      {
        url: "https://datatracker.ietf.org/doc/draft-ietf-mpls-mna-ioam/",
        label: "IETF Datatracker document history",
        lang: "en",
        access: "static-html",
      },
    ],
    analysis: {
      kind: "ballot_flag_snapshot",
      params: {
        doc: "draft-ietf-mpls-mna-ioam",
        similarDrafts: 12,
        withDiscuss: 9,
        issuesCurrent: 4,
        cutoffDaysLeft: 6,
        openBallotProbability: 0.55,
      },
    },
  },
  {
    marketAddress: "0x42fdc3fb099766fd01289f215cd399146e1f224e",
    topic: "fide-game8",
    miningPath: 2,
    langs: ["en"],
    headline:
      "FIDE official color allocation for Game 8 (published Nov 26, 09:00 UTC on the match page): Sindarov plays WHITE on Dec 3. After Game 7 Sindarov leads 4.0-3.5, so 'strictly more points after Game 8' fails only if Sindarov loses with White - he has lost just 15% of White games vs 2750+ opponents in 2025-26.",
    figures: [
      "Standings after Game 7 (rest day Nov 26): Sindarov 4.0 - Gukesh 3.5 (+0.5 lead)",
      "Official Game 8 color allocation: Sindarov White, Gukesh Black (Dec 3, 2026)",
      "Sindarov White vs 2750+, 2025-26: 30% win / 55% draw / 15% loss (0.575 score rate, 46 games)",
      "Loss levels the score 4.0-4.0 ('strictly more' fails on a tie); draw or win keeps/extends the lead",
    ],
    sourceDescriptions: [
      "FIDE World Championship 2026 match page (static): standings after Game 7 and official Game 8 color allocation, published Nov 26.",
    ],
    links: [
      { url: FIDE_URL, label: "FIDE WCC 2026 match page (score + color allocation)", lang: "en", access: "scraped", expect: ["Sindarov 4.0 - Gukesh 3.5", "Sindarov plays White"] },
    ],
    analysis: {
      kind: "markov_lead",
      params: {
        asOfGame: 7,
        leader: "Sindarov",
        leaderPoints: 4.0,
        trailer: "Gukesh",
        trailerPoints: 3.5,
        games: [
          { leaderColor: "White", winProb: 0.3, drawProb: 0.55, lossProb: 0.15 },
        ],
        historicalBasis: "Sindarov White vs 2750+, 2025-26 season (46 games, 0.575 score rate)",
      },
    },
  },
  {
    marketAddress: "0x7a17b76f7f1cda20e8bc5a88166c4732e6db39f5",
    topic: "wikipedia-articles",
    miningPath: 2,
    langs: ["en"],
    headline:
      "Siteinfo API snapshot (Nov 25, 2026): 7,271,234 English Wikipedia articles. Reaching 7,275,500 by Dec 10 12:00 UTC requires +4,266 net articles in 14 days = +304/day, roughly 7x the observed net creation rate of +43.7/day over the last 30 days (+1,312) and +38.4/day over 90 days (+3,458).",
    figures: [
      "Current count: 7,271,234 articles (siteinfo statistics API, fetched 2026-11-25 23:59 UTC)",
      "Threshold: 7,275,500 by Dec 10, 2026 12:00 UTC (14 days later) = +4,266 net required = 304.7/day",
      "Observed net velocity: +43.7/day over 30 days (net +1,312), +38.4/day over 90 days (net +3,458)",
      "Projected 14-day net at the 30d rate: +612 (sd +/-144); z vs required: +25 sigma",
    ],
    sourceDescriptions: [
      "Wikipedia siteinfo statistics API (JSON, no JS): live article count at fetch time.",
      "Wikimedia stats: daily net article deltas for the 30d/90d velocity computation.",
    ],
    links: [
      { url: WIKI_URL, label: "English Wikipedia siteinfo statistics API", lang: "en", access: "api-json" },
    ],
    analysis: {
      kind: "threshold_velocity",
      params: {
        currentCount: 7271234,
        targetCount: 7275500,
        daysRemaining: 14,
        dailyNetMean: 43.7,
        dailyNetSd: 38.4,
        net30d: 1312,
        net90d: 3458,
      },
    },
  },
  {
    marketAddress: "0x921e39354e4bfc18251ad1b1c80eec1a3940ab82",
    topic: "bun-release",
    miningPath: 2,
    langs: ["en"],
    headline:
      "GitHub releases API (last 15 bun tags, Nov 26 snapshot): mean gap 12.4 days, only one gap > 17 days in the entire cycle (v1.3.1, audit-period freeze, 18 days). v1.4.5 published Nov 24; 13 of 14 historical gaps would put v1.4.6 inside the Nov 28 - Dec 11 window, and 68 commits are already untagged on main.",
    figures: [
      "Last release: bun-v1.4.5, published 2026-11-24T10:00Z (GitHub releases API)",
      "Gap distribution, last 14 gaps: mean 12.4d, median 12.0d, max 18d (v1.3.1->v1.3.2 audit freeze), all others 10-14d",
      "Window: v1.4.6 or later must publish between Nov 28 and Dec 11 => next gap must be 4-17 days",
      "13/14 historical gaps fall in that range; untagged commits on main since v1.4.5: 68",
    ],
    sourceDescriptions: [
      "GitHub releases API (JSON): publish dates of the last 15 bun releases.",
    ],
    links: [
      { url: BUN_URL, label: "oven-sh/bun releases API (last 15)", lang: "en", access: "api-json" },
    ],
    analysis: {
      kind: "release_gap_cdf",
      params: {
        releases: [
          { tag: "bun-v1.3.1", date: "2026-06-02" },
          { tag: "bun-v1.3.2", date: "2026-06-20" },
          { tag: "bun-v1.3.3", date: "2026-07-01" },
          { tag: "bun-v1.3.4", date: "2026-07-15" },
          { tag: "bun-v1.3.5", date: "2026-07-29" },
          { tag: "bun-v1.3.6", date: "2026-08-10" },
          { tag: "bun-v1.3.7", date: "2026-08-22" },
          { tag: "bun-v1.3.8", date: "2026-09-04" },
          { tag: "bun-v1.3.9", date: "2026-09-17" },
          { tag: "bun-v1.4.0", date: "2026-09-28" },
          { tag: "bun-v1.4.1", date: "2026-10-12" },
          { tag: "bun-v1.4.2", date: "2026-10-22" },
          { tag: "bun-v1.4.3", date: "2026-11-01" },
          { tag: "bun-v1.4.4", date: "2026-11-13" },
          { tag: "bun-v1.4.5", date: "2026-11-24" },
        ],
        windowStart: "2026-11-28",
        windowEnd: "2026-12-11",
      },
    },
  },
  {
    marketAddress: "0xf640443d15af94932e1a7294c15312f0ad9e1136",
    topic: "go-1-27-5",
    miningPath: 2,
    langs: ["en"],
    headline:
      "Go1.27.5 milestone has 14 open blockers (GitHub API, Nov 26) and go.dev lists minors on a strict 28-day cadence (1.27.1 Aug 20 -> 1.27.2 Sep 17 -> 1.27.3 Oct 15 -> 1.27.4 Nov 12) - already 14 days overdue. Comparable minors cleared 22 blockers in 18d, 28 in 23d, 16 in 15d, 21 in 22d; predicted listing for 14 blockers: Dec 8-9, right at the deadline.",
    figures: [
      "Go1.27.5 milestone: 14 open / 87 closed blockers (GitHub API snapshot Nov 26, 2026)",
      "go.dev release history: go1.27.4 listed Nov 12, 1.27.3 Oct 15, 1.27.2 Sep 17, 1.27.1 Aug 20 - 28-day cadence",
      "Comparable clearance: 1.27.4: 22 blockers/18d (1.22/day); 1.27.3: 28/23d (1.22/day); 1.27.2: 16/15d (1.07/day); 1.27.1: 21/22d (0.95/day)",
      "Deadline Dec 8 23:59 UTC = 12.5 days from snapshot; predicted snapshot-to-listing: 12.7 +/- 3.0 days",
    ],
    sourceDescriptions: [
      "GitHub milestones API (JSON): Go1.27.5 milestone open/closed blocker counts.",
      "go.dev release history (static HTML): listing dates of go1.27.x minors.",
    ],
    links: [
      { url: GO_MILESTONE_URL, label: "golang/go Go1.27.5 milestone (GitHub API)", lang: "en", access: "api-json" },
      { url: GO_RELEASES_URL, label: "go.dev release history", lang: "en", access: "scraped", expect: ["go1.27.4 (released November 12, 2026)", "14 open"] },
    ],
    analysis: {
      kind: "blocker_clearance",
      params: {
        milestone: "Go1.27.5",
        openBlockers: 14,
        deadlineDays: 12.5,
        sdFloorDays: 3.0,
        comparables: [
          { version: "1.27.4", listedAt: "2026-11-12", openAtSnapshot: 22, daysToListing: 18 },
          { version: "1.27.3", listedAt: "2026-10-15", openAtSnapshot: 28, daysToListing: 23 },
          { version: "1.27.2", listedAt: "2026-09-17", openAtSnapshot: 16, daysToListing: 15 },
          { version: "1.27.1", listedAt: "2026-08-20", openAtSnapshot: 21, daysToListing: 22 },
        ],
      },
    },
  },
];

export const SPECS_BY_MARKET = new Map(RESEARCH_SPECS.map((s) => [s.marketAddress, s]));
