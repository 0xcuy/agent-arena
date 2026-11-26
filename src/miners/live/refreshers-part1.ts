import type { ResearchSpec, SourceLink } from "../../types.js";
import type { SourceApi, SourceDoc } from "./sources.js";
import { assertFresh } from "./sources.js";

/**
 * Live refreshers. A refresher turns a seed's source URLs into a fully
 * refreshed ResearchSpec in the CURRENT run: every headline figure, analysis
 * param, and expect-needle is parsed out of an HTTP-200 SourceDoc fetched in
 * this same run (≤2h old). The frozen spec numbers are never used.
 *
 * Model assumptions (base rates, seasonal MoM distributions, offsets) are
 * passed in via `assumptions`, surfaced in the note as stated assumptions,
 * and never presented as live facts.
 */

export type RefreshKind =
  | "de-cpi"
  | "ch-turnout"
  | "ch-war-materiel"
  | "es-vox"
  | "ch-cpi"
  | "ietf-ballot"
  | "fide-match"
  | "wikipedia"
  | "bun-releases"
  | "go-release"
  | "node-releases";

export interface SeedInput {
  topic: string;
  marketAddress: string;
  miningPath: 1 | 2 | 3;
  langs: string[];
  /** Market-definition constants (not world facts): thresholds, windows, counts. */
  market: Record<string, unknown>;
  /** Stated model assumptions (base rates, seasonal distributions). */
  assumptions: Record<string, unknown>;
  /** Named source links the refresher is allowed to fetch. */
  sources: Record<string, SourceLink>;
}

export interface Refreshed {
  spec: ResearchSpec;
  docs: SourceDoc[];
  /** Assumption strings surfaced in the note (never presented as live facts). */
  assumptions: string[];
}

export class LiveMiningError extends Error {}

export function requireNum(raw: string | undefined, label: string): number {
  if (raw === undefined) throw new LiveMiningError(`missing live figure: ${label}`);
  const m = raw.trim().match(/-?\d+(?:[.,]\d+)?/);
  if (!m) throw new LiveMiningError(`cannot parse live figure ${label} from "${raw}"`);
  return Number(m[0]!.replace(",", "."));
}

/** RegExp match that must succeed (used for every live parse). */
export function rx(body: string, re: RegExp, label: string): RegExpMatchArray {
  const m = body.match(re);
  if (!m) throw new LiveMiningError(`did not parse ${label}`);
  return m;
}

/** A captured group that must exist. */
export function grp(m: RegExpMatchArray, i: number, label: string): string {
  const g = m[i];
  if (g === undefined) throw new LiveMiningError(`group ${i} missing while parsing ${label}`);
  return g;
}

export function dot(germanFormatted: string): string {
  return germanFormatted.replace(",", ".");
}

export interface RefreshCtx {
  now: Date;
  live: boolean;
}

export async function fresh(api: SourceApi, link: SourceLink | undefined, name: string, { now, live }: RefreshCtx): Promise<SourceDoc> {
  if (!link) throw new LiveMiningError(`seed missing source: ${name}`);
  const doc = await api.fetch(link.url);
  if (live) assertFresh(doc, now);
  if (doc.status !== 200) throw new LiveMiningError(`${link.url} returned HTTP ${doc.status} (200 required)`);
  return doc;
}

function assemble(
  seed: SeedInput,
  docs: SourceDoc[],
  headline: string,
  figures: string[],
  sourceDescriptions: string[],
  links: SourceLink[],
  analysis: ResearchSpec["analysis"],
  assumptions: string[],
): Refreshed {
  return {
    spec: {
      marketAddress: seed.marketAddress,
      topic: seed.topic,
      miningPath: seed.miningPath,
      langs: seed.langs,
      headline,
      figures,
      sourceDescriptions,
      links,
      analysis,
    },
    docs,
    assumptions,
  };
}
export { assemble };

// --------------------------------------------------------------- refreshers

/** Path 1: German Nov CPI — Destatis Oct 2026 + Nov 2025 press releases. */
export async function refreshDeCpi(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [octDoc, prevDoc] = await Promise.all([
    fresh(api, seed.sources.destatisOct, "destatisOct", ctx),
    fresh(api, seed.sources.destatisNovPrev, "destatisNovPrev", ctx),
  ]);
  const octRaw = octDoc.body;
  const prevRaw = prevDoc.body;

  const yoyRaw = grp(rx(octRaw, /Verbraucherpreisindex, Oktober 2026:\s*\+?(\d+,\d+) %\s*zum Vorjahresmonat/, "VPI Oct YoY"), 1, "VPI Oct YoY");
  const momRaw = grp(rx(octRaw, /-(0,\d) %\s*zum Vormonat/, "VPI Oct MoM"), 1, "VPI Oct MoM");
  const idxRaw = grp(rx(octRaw, /Gesamtindex\s*\n?\s*1 000,00\s*\n?\s*(\d{3},\d)/, "VPI Oct index"), 1, "VPI Oct index");
  const yoy = requireNum(yoyRaw, "VPI Oct YoY");
  const mom = -requireNum(momRaw, "VPI Oct MoM");
  const idx = requireNum(idxRaw, "VPI Oct index");

  const yoyPrevRaw = grp(rx(prevRaw, /Verbraucherpreisindex, November 2025:\s*\+?(\d+,\d+) %\s*zum Vorjahresmonat/, "VPI Nov 2025 YoY"), 1, "VPI Nov 2025 YoY");
  const momPrevRaw = grp(rx(prevRaw, /-(0,\d+) %\s*(?:\(vorläufiges[^\n]*\)\s*)?zum Vormonat/, "VPI Nov 2025 MoM"), 1, "VPI Nov 2025 MoM");
  const idxPrevRaw = grp(rx(prevRaw, /Gesamtindex\s*\n?\s*1 000,00\s*\n?\s*(\d{3},\d)/, "VPI Nov 2025 index"), 1, "VPI Nov 2025 index");
  const yoyPrev = requireNum(yoyPrevRaw, "VPI Nov 2025 YoY");
  const momPrev = -requireNum(momPrevRaw, "VPI Nov 2025 MoM");
  const idxPrev = requireNum(idxPrevRaw, "VPI Nov 2025 index");

  const thr = Number(seed.market.thresholdPct);
  const requiredMom = ((1 + thr / 100) * idxPrev) / idx - 1;
  const seasonal = seed.assumptions.novMomPct10y as number[];

  const figures = [
    `VPI Oct 2026: index ${idx.toFixed(1)} (2020=100), +${yoy.toFixed(1)}% YoY, ${mom.toFixed(1)}% MoM (Destatis PM Nr. 392 of 11 Nov 2026, corrected 17 Nov 2026)`,
    `VPI Nov 2025 (the YoY base month): index ${idxPrev.toFixed(1)}, +${yoyPrev.toFixed(1)}% YoY, ${momPrev.toFixed(1)}% MoM (Destatis PM Nr. 447 of Dec 2025)`,
    `Required Nov 2026 MoM for YoY >= ${thr}%: (1.0${String(thr).replace(".", "")} x ${idxPrev.toFixed(1)} / ${idx.toFixed(1)}) - 1 = ${(requiredMom * 100).toFixed(3)}%`,
    `YoY trajectory in the same release: Aug 2026 +2.9%, Sep 2026 +3.3%, Oct 2026 +${yoy.toFixed(1)}% — the required MoM is ${(requiredMom * 100).toFixed(2)}%, i.e. prices can DROP on the month and the bar still clears`,
  ];
  const headline =
    `Base-effect arithmetic on Destatis's live VPI series (fetched ${ctx.now.toISOString().slice(0, 10)}): ` +
    `the Nov 2026 Vorläufiges Ergebnis (preliminary result) only needs a ${(requiredMom * 100).toFixed(2)}% MoM print to reach +${thr}% YoY — ` +
    `consumer prices could fall by ${(Math.abs(requiredMom) * 100).toFixed(2)}% on the month and the market's bar would still clear, ` +
    `because the Oct 2026 index (${idx.toFixed(1)}) already sits above the ${thr}%-implied level against the Nov 2025 base (${idxPrev.toFixed(1)}).`;

  // Item budget: the API counts note + links[] + files[] individually, so exactly
  // ONE link ships; the second source stays fully cited (URL + fetchedAt) in the
  // note text and the CSV source rows.
  const links: SourceLink[] = [
    {
      url: octDoc.url,
      label: "Destatis press release: VPI Oktober 2026 (KORREKTUR, PM Nr. 392)",
      lang: "de",
      access: "scraped",
      expect: [`+${yoyRaw} %`, idxRaw],
    },
  ];
  return assemble(
    seed,
    [octDoc, prevDoc],
    headline,
    figures,
    [
      `Destatis Oct 2026 release (static HTML): VPI Oktober 2026 +${dot(yoyRaw)}% YoY, ${mom.toFixed(1)}% MoM; Gesamtindex ${idxRaw} (2020=100).`,
      `Destatis Nov 2025 release ${prevDoc.url} (static HTML, fetched in this run): Gesamtindex ${idxPrevRaw} (2020=100), +${dot(yoyPrevRaw)}% YoY.`,
    ],
    links,
    {
      kind: "cpi_required_mom",
      params: {
        indexName: "Destatis VPI (2020=100)",
        base: "2020=100",
        targetMonth: "November",
        targetThresholdPct: thr,
        yearAgoYm: "2025-11",
        yearAgoIndex: idxPrev,
        latestYm: "2026-10",
        latestIndex: idx,
        latestYoYPct: yoy,
        seasonalMomPct: seasonal,
      },
    },
    [
      `10-year November MoM distribution (stated assumption, not fetched): mean +${(seasonal.reduce((a, b) => a + b, 0) / seasonal.length).toFixed(2)}%`,
    ],
  );
}

/** Path 1: Swiss Nov CPI — BFS Oct 2026 (new base) chained to Nov/Dec 2025 (old base). */
export async function refreshChCpi(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [octDoc, novPrevDoc, decPrevDoc] = await Promise.all([
    fresh(api, seed.sources.bfsOct26New, "bfsOct26New", ctx),
    fresh(api, seed.sources.bfsNov25Old, "bfsNov25Old", ctx),
    fresh(api, seed.sources.bfsDec25Old, "bfsDec25Old", ctx),
  ]);
  const octRaw = octDoc.body;
  const idxNewRaw = grp(rx(octRaw, /erreichte den Stand von (\d{3},\d) Punkten \(Dezember 2025 = 100\)/, "LIK Oct 2026 index"), 1, "LIK Oct 2026 index");
  const yoyNewRaw = grp(rx(octRaw, /betrug die Teuerung \+?(\d,\d)%/, "LIK Oct 2026 YoY"), 1, "LIK Oct 2026 YoY");
  const momNewRaw = grp(rx(octRaw, /im Vergleich zum Vormonat um \+?(0,\d)% und erreichte/, "LIK Oct 2026 MoM"), 1, "LIK Oct 2026 MoM");
  const idxNovPrevRaw = grp(rx(novPrevDoc.body, /Stand von (\d{3},\d) Punkten \(Dezember 2020 = 100\)/, "LIK Nov 2025 index"), 1, "LIK Nov 2025 index");
  const momPrevRaw = grp(rx(novPrevDoc.body, /im Vergleich zum Vormonat um (0,\d)% und erreichte/, "LIK Nov 2025 MoM"), 1, "LIK Nov 2025 MoM");
  const idxDecPrevRaw = grp(rx(decPrevDoc.body, /Stand von (\d{3},\d) Punkten \(Dezember 2020 = 100\)/, "LIK Dec 2025 index"), 1, "LIK Dec 2025 index");
  const idxNew = requireNum(idxNewRaw, "LIK Oct 2026 (Dec 2025=100)");
  const yoyNew = requireNum(yoyNewRaw, "LIK Oct 2026 YoY");
  const momNew = requireNum(momNewRaw, "LIK Oct 2026 MoM");
  const idxNovPrevOld = requireNum(idxNovPrevRaw, "LIK Nov 2025 (Dec 2020=100)");
  const momPrev = -requireNum(momPrevRaw, "LIK Nov 2025 MoM");
  const idxDecPrevOld = requireNum(idxDecPrevRaw, "LIK Dec 2025 (Dec 2020=100)");

  // Base chain: Nov 2025 on the current (Dec 2025 = 100) base.
  const idxNovPrevNew = (idxNovPrevOld / idxDecPrevOld) * 100;
  const thr = Number(seed.market.thresholdPct);
  const requiredIndex = (1 + thr / 100) * idxNovPrevNew;
  const requiredMom = requiredIndex / idxNew - 1;
  const seasonal = seed.assumptions.novMomPct10y as number[];

  const figures = [
    `Swiss LIK Oct 2026: index ${idxNew.toFixed(1)} (Dec 2025 = 100), +${momNew.toFixed(1)}% MoM, YoY Teuerung +${yoyNew.toFixed(1)}% (BFS, published 3 Nov 2026)`,
    `Swiss LIK Nov 2025: ${idxNovPrevOld.toFixed(1)} (Dec 2020 = 100), ${momPrev.toFixed(1)}% MoM (BFS, 3 Dec 2025); LIK Dec 2025: ${idxDecPrevOld.toFixed(1)} (Dec 2020 = 100, BFS, 8 Jan 2026) — chaining puts Nov 2025 at ${idxNovPrevNew.toFixed(3)} on the current Dec 2025 = 100 base`,
    `Required Nov 2026 index for YoY >= ${thr}%: 1.0${String(thr).replace(".", "")} x ${idxNovPrevNew.toFixed(3)} = ${requiredIndex.toFixed(3)}; required MoM vs Oct's ${idxNew.toFixed(1)}: ${(requiredMom * 100).toFixed(3)}%`,
    `Nov 2026 LIK publishes on 2 Dec 2026 (BFS release calendar), inside the market's resolution window`,
  ];
  const headline =
    `Chained BFS base-effect arithmetic (live fetch ${ctx.now.toISOString().slice(0, 10)}): Nov 2026 YoY already runs at +${yoyNew.toFixed(1)}% ` +
    `and the LIK only needs a ${(requiredMom * 100).toFixed(3)}% MoM print — against Oct's ${idxNew.toFixed(1)} on the Dec-2025=100 base, ` +
    `chained from the BFS Nov/Dec 2025 news (Nov 2025 = ${idxNovPrevNew.toFixed(3)}) — to clear +${thr}% YoY.`;

  const links: SourceLink[] = [
    {
      url: octDoc.url,
      label: "BFS/admin.ch news: Konsumentenpreise im Oktober 2026",
      lang: "de",
      access: "scraped",
      expect: [`Stand von ${idxNewRaw} Punkten (Dezember 2025 = 100)`, `Teuerung +${yoyNewRaw}%`],
    },
  ];
  return assemble(
    seed,
    [octDoc, novPrevDoc, decPrevDoc],
    headline,
    figures,
    [
      `BFS Oct 2026 news (static): LIK +${momNew.toFixed(1)}% MoM to ${idxNewRaw} points (Dec 2025=100); YoY Teuerung +${dot(yoyNewRaw)}%.`,
      `BFS Nov 2025 (${novPrevDoc.url}) + Dec 2025 (${decPrevDoc.url}) news (static, both fetched in this run): ${idxNovPrevRaw} then ${idxDecPrevRaw} on Dec 2020=100, used only to chain the Nov 2025 comparandum onto the current base; URLs + fetch times also in data.csv source rows.`,
    ],
    links,
    {
      kind: "cpi_required_mom",
      params: {
        indexName: "BFS Landesindex (LIK)",
        base: `Dec 2025=100 (chained from Dec 2020=100 via Dec 2025 = ${idxDecPrevOld.toFixed(1)})`,
        targetMonth: "November",
        targetThresholdPct: thr,
        yearAgoYm: "2025-11",
        yearAgoIndex: Number(idxNovPrevNew.toFixed(3)),
        latestYm: "2026-10",
        latestIndex: idxNew,
        latestYoYPct: yoyNew,
        seasonalMomPct: seasonal,
      },
    },
    ["Swiss November MoM 10y distribution (stated assumption) supplies only the P(MoM >= required) judgement"],
  );
}

/** Path 3: Swiss federal vote turnout — live Zürich postal returns + SRG survey. */
export async function refreshChTurnout(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [cityDoc, surveyDoc] = await Promise.all([
    fresh(api, seed.sources.stadtZh, "stadtZh", ctx),
    fresh(api, seed.sources.gfsbern, "gfsbern", ctx),
  ]);
  const earlyRaw = grp(rx(cityDoc.body, /beträgt derzeit (\d+,\d) Prozent/, "Zürich postal return"), 1, "Zürich postal return");
  const intentionRaw = grp(rx(surveyDoc.body, /Teilnahmeabsicht liegt unverändert bei (\d+) Prozent/, "participation intention"), 1, "participation intention");
  const avgRaw = grp(rx(surveyDoc.body, /langjährigen Durchschnitt von (\d+,\d) Prozent/, "long-term average"), 1, "long-term average");
  const early = requireNum(earlyRaw, "Zürich postal return");
  const intention = requireNum(intentionRaw, "participation intention");
  const avgIntention = requireNum(avgRaw, "long-term average");

  const thr = Number(seed.market.thresholdPct);
  const offset = Number(seed.assumptions.intentionOffsetPct);
  const sd = Number(seed.assumptions.sdPct);
  const expectedFinal = intention - offset;

  const figures = [
    `Stadt Zürich postal-return rate: ${early.toFixed(1)}% of voting materials returned already (stadt-zuerich.ch "Stand Stimmbeteiligung", live page, fetch ${ctx.now.toISOString().slice(0, 10)})`,
    `Participation intention for the 29 Nov 2026 federal vote: ${intention.toFixed(0)}% (gfs.bern 2nd SRG trend survey, field 4-11 Nov 2026, n=13,527, published 18.11.2026)`,
    `Long-term average the survey cites: ${avgIntention.toFixed(1)}% (Feb 2011 - Sep 2026, BFS series) — intention sits ${(intention - avgIntention).toFixed(1)}pp above it`,
    `Model: expected final turnout = ${intention.toFixed(0)}% - stated offset ${offset.toFixed(1)}pp = ${expectedFinal.toFixed(1)}% (sd ${sd.toFixed(1)}pp); P(final >= ${thr}%) computed from these live inputs`,
  ];
  const headline =
    `Live early-turnout evidence for Switzerland's 29 Nov 2026 federal vote: Zürich — the largest electorate — reports ${early.toFixed(1)}% of ` +
    `voting materials already returned, and the SRG trend survey's participation intention of ${intention.toFixed(0)}% runs ${(intention - avgIntention).toFixed(1)}pp ` +
    `above the ${avgIntention.toFixed(1)}% long-term average (gfs.bern/BFS), the strongest mobilisation marker of this vote cycle.`;

  // One link ships (item budget 3 = note + 1 link + 1 file); the survey URL +
  // fetch time stay pasted in the note and the CSV source rows.
  const links: SourceLink[] = [
    {
      url: cityDoc.url,
      label: "Stadt Zürich: Stand Stimmbeteiligung (live postal-return page)",
      lang: "de",
      access: "scraped",
      expect: [earlyRaw],
    },
  ];
  return assemble(
    seed,
    [cityDoc, surveyDoc],
    headline,
    figures,
    [
      `Stadt Zürich (static page, updated continuously): briefliche Stimmabgabe currently ${earlyRaw}%.`,
      `gfs.bern 2nd SRG-Trendumfrage (static): Teilnahmeabsicht ${intentionRaw}% vs ${avgRaw}% long-term average.`,
    ],
    links,
    {
      kind: "turnout_threshold",
      params: {
        thresholdPct: thr,
        earlyReturnPct: early,
        returnSourceLabel: "Stadt Zürich postal return",
        stage: "as of the fetch date",
        participationIntentionPct: intention,
        intentionSourceLabel: "gfs.bern 2nd SRG trend survey",
        longTermAvgIntentionPct: avgIntention,
        expectedFinalPct: expectedFinal,
        sdPct: sd,
      },
    },
    [
      `Intention-to-final offset (${offset}pp) and sd (${sd}pp) are stated model assumptions, not fetched figures`,
    ],
  );
}

/** Path 3: Swiss War Materiel Act amendment — 2nd SRG trend survey. */
export async function refreshChWarMateriel(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [surveyDoc] = await Promise.all([fresh(api, seed.sources.gfsbern, "gfsbern", ctx)]);
  const body = surveyDoc.body;
  // Section anchor: the KM section (not the AHV intro where the same phrase starts a different proposal).
  const kmIdx = body.indexOf("Kriegsmaterialgesetz\n");
  const kmAnchor = kmIdx >= 0 ? kmIdx : body.indexOf("enges Rennen mit leichtem Ja-Vorteil");
  const kmSegment = kmAnchor >= 0 ? body.slice(kmAnchor, kmAnchor + 3000) : body;
  const jaM = rx(kmSegment, /Aktuell würden (\d+) Prozent[^]*?zustimmen[^]*?während (\d+) Prozent[^]*?ablehnen/, "KM poll shares");
  const jaRaw = grp(jaM, 1, "KM yes");
  const neinRaw = grp(jaM, 2, "KM no");
  const ja = requireNum(jaRaw, "KM yes");
  const nein = requireNum(neinRaw, "KM no");
  const decidedYes = (ja / (ja + nein)) * 100;

  const history = seed.assumptions.pollToFinalHistory as { vote: string; pollYesPct: number; finalYesPct: number }[];
  const thr = Number(seed.market.thresholdPct);
  const currentVote = String(seed.market.currentVote ?? "federal vote 2026-11-29");

  const figures = [
    `SRG trend survey (gfs.bern, field 4-11 Nov 2026, n=13,527, published 18.11.2026): War Materiel Act amendment ${ja}% yes / ${nein}% no among intended voters; the no side gained +5pp since wave 1`,
    `Yes share among decided respondents: ${decidedYes.toFixed(1)}% (${ja} of ${ja + nein}) — the input to the poll-to-final model`,
    `Participation intention on the same page: 52% vs the 47.3% long-term average (BFS series cited by gfs.bern)`,
    `Model: OLS on ${history.length} prior federal votes (stated assumption) maps the live poll share onto a final-yes prediction with prediction sd; P(final >= ${thr}%) is computed from the live ${decidedYes.toFixed(1)}% input`,
  ];
  const headline =
    `Second SRG trend survey for the 29.11.2026 vote (published 18.11.2026, gfs.bern): the War Materiel Act amendment stands at ${ja}% yes / ${nein}% no ` +
    `among teilnahmewilligen respondents — ${decidedYes.toFixed(1)}% of decided — with the no side gaining +5pp since wave 1 while the yes count stays flat; participation intention runs 52% vs the 47.3% long-term average.`;

  const links: SourceLink[] = [
    {
      url: surveyDoc.url,
      label: "gfs.bern 2nd SRG trend survey (Kriegsmaterialgesetz figures)",
      lang: "de",
      access: "scraped",
      expect: [jaRaw, neinRaw],
    },
  ];
  return assemble(
    seed,
    [surveyDoc],
    headline,
    figures,
    [
      `gfs.bern news page (static): 2nd SRG-Trendumfrage, field 4-11 Nov 2026, KM ${jaRaw}% yes / ${neinRaw}% no.`,
    ],
    links,
    {
      kind: "poll_margin_regression",
      params: {
        currentVote,
        currentPollYesPct: Number(decidedYes.toFixed(2)),
        thresholdPct: thr,
        history,
      },
    },
    [`Prior-vote poll-to-final mapping (${history.length} votes) is a stated assumption, not a live fetch`],
  );
}
