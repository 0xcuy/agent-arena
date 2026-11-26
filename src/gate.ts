import type { CompetitionMarket, EntryState, EvidenceCandidate, GateVerdict } from "./types.js";
import { type EvidenceLog, factSignature } from "./evidence-log.js";

/**
 * Strict pre-submit quality/anti-rejection gate. A candidate that fails any check is
 * dropped from the run, never submitted. The goal is to stay on the Standard tier:
 * no spam, no unverifiable items, no both-sides hedging, no known facts.
 *
 * Item budget: a submission = note (1) + links (counted individually) + files
 * (counted individually) and the API 400s above 3 items in total, so the gate
 * counts exactly 1 + links.length + files.length.
 */

export const ITEM_BUDGET = 3;
export const MIN_EDGE_PCT = 2.5; // evidence must move the implied probability by at least this
export const MAX_NOTE_CHARS = 8000;
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB per attached file
export const MAX_AS_OF_AGE_MS = 2 * 60 * 60 * 1000; // asOf must be fresher than 2h at gate time

/** Evidence must never cite prediction/betting markets or bookmakers (banned content, $0). */
export const DOMAIN_DENYLIST = [
  "delphi.fyi",
  "manifold.markets",
  "metaculus.com",
  "polymarket.com",
  "kalshi.com",
  "predictit.org",
  "oddschecker.com",
  "betfair.com",
  "bet365.com",
  "williamhill.com",
  "bwin.com",
  "unibet.com",
  "draftkings.com",
  "fanduel.com",
];

/** Judge-steering phrases: any appeal to the judge earns $0 and risks a tier demotion. */
export const BANNED_PHRASES = [
  "bookmaker",
  "oddschecker",
  "betting odds",
  "in my opinion",
  "please judge",
  "judge in favor",
  "favor this submission",
  "highest rating",
  "award me",
  "as a judge",
  "you should",
  "reward this",
  "be generous",
  "deserves the bounty",
  "please consider",
];

export interface GateContext {
  market: CompetitionMarket;
  entry: EntryState;
  log: EvidenceLog;
  /** The full note text that would be submitted. */
  note: string;
  /** Size of each attached file in bytes. */
  fileSizes: number[];
  /** fetchedAt (ISO) of every source fetched in this run that backs the candidate. */
  sourceFetchTimes: string[];
  /** Run time (asOf is measured against this). */
  now: Date;
  /** In-flight draft claims on this market created by THIS run and not yet submitted (only when batching). */
  inFlightClaims?: number;
}

/** Extract the "published strictly after <ts>" baseline from a market's resolution criteria. */
export function marketBaselineTimestamp(resolutionCriteria: string): Date | null {
  const m = resolutionCriteria.match(/strictly after (\d{4}-\d{2}-\d{2}T[\d:.]+Z?)/);
  if (!m) return null;
  const group = m[1];
  if (group === undefined) return null;
  const ts = group.endsWith("Z") ? group : group + "Z";
  const d = new Date(ts);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtPct(p: number): string {
  return (p < 0.001 ? 0.1 : p * 100).toFixed(1) + "%";
}

export function gateCandidate(c: EvidenceCandidate, ctx: GateContext): GateVerdict {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!ctx.entry.canSubmit) reasons.push("entry state canSubmit=false");
  // Fix 6: remainingOnMarket is the server-tracked remaining submissions on this market
  // (0 when cap_reached) and already nets everything submitted. Only in-flight claims
  // from THIS run that are not yet submitted may be subtracted, and only when batching.
  const slots = ctx.entry.remainingOnMarket - (ctx.inFlightClaims ?? 0);
  if (slots <= 0) reasons.push(`no submission slots left on market (remainingOnMarket=${ctx.entry.remainingOnMarket}, in-flight=${ctx.inFlightClaims ?? 0})`);
  if (ctx.entry.restricted) {
    warnings.push("restricted tier: max 1 submission per market (would not be Standard-tier multi-submit)");
  }
  if (Number(ctx.entry.judgementPotRemainingBaseUnits) <= 0) {
    warnings.push("judgment pot empty: judgment bounty $0 (settlement value may still count)");
  }

  // Both-sides rule: settlement value nets to $0 per person per market.
  const locked = ctx.log.lockedStance(c.marketAddress);
  if (locked !== null && locked !== c.stance) {
    reasons.push(
      `stance lock: market already covered with ${locked.toUpperCase()} stance; refusing ${c.stance.toUpperCase()} (both-sides nets $0)`,
    );
  }

  // Dedupe: same fact signature already drafted/submitted.
  if (ctx.log.hasSignature(c.factSignature)) {
    reasons.push("duplicate: fact signature already in evidence-log.jsonl");
  }

  // Unverifiable risk: the judge fetches cited URLs with no browser/JS.
  if (c.links.length === 0) reasons.push("no links: judge cannot verify");
  for (const link of c.links) {
    let u: URL;
    try {
      u = new URL(link.url);
    } catch {
      reasons.push(`malformed link: ${link.url}`);
      continue;
    }
    if (u.protocol !== "https:" && u.protocol !== "http:") reasons.push(`non-http link: ${link.url}`);
    const host = u.hostname.toLowerCase().replace(/^www\./, "");
    const banned = DOMAIN_DENYLIST.find((d) => host === d || host.endsWith("." + d));
    if (banned) reasons.push(`banned domain (prediction/betting market or bookmaker): ${host}`);
  }
  if (c.figures.length < 2) {
    reasons.push("fewer than 2 key figures pasted into the note (unverifiable risk)");
  }

  // Anti-rejection: never submit bookmaker odds, stale headlines, opinion, or
  // judge-steering phrasing.
  const blob = (c.headline + " " + c.figures.join(" ") + " " + c.sourceDescriptions.join(" ") + " " + ctx.note).toLowerCase();
  for (const b of BANNED_PHRASES) {
    if (blob.includes(b)) reasons.push(`banned content/phrasing: "${b}" (known not to earn or judge-steering)`);
  }

  // Known-fact check.
  const edge = Math.abs(c.analysis.evidenceImpliedYes - c.marketImpliedYes) * 100;
  if (edge < MIN_EDGE_PCT) {
    reasons.push(
      `evidence-implied P(yes)=${fmtPct(c.analysis.evidenceImpliedYes)} within ` +
        `${MIN_EDGE_PCT}pp of market implied ${fmtPct(c.marketImpliedYes)} (presumed priced)`,
    );
  }

  // Direction sanity.
  const delta = c.analysis.evidenceImpliedYes - c.marketImpliedYes;
  const derivedStance = delta >= 0 ? "yes" : "no";
  if (derivedStance !== c.stance) {
    reasons.push(
      `stance ${c.stance} disagrees with derived P(yes)=${c.analysis.evidenceImpliedYes.toFixed(3)} vs market ${fmtPct(c.marketImpliedYes)}`,
    );
  }

  // Item budget: note (1) + links[] + files[] — the same count the API enforces.
  const items = 1 + c.links.length + ctx.fileSizes.length;
  if (items > ITEM_BUDGET) {
    reasons.push(`item budget exceeded: 1 note + ${c.links.length} links + ${ctx.fileSizes.length} files = ${items} > ${ITEM_BUDGET}`);
  }

  // Note length: judge-facing note stays small (< 8000 chars).
  if (ctx.note.length > MAX_NOTE_CHARS) {
    reasons.push(`note too long: ${ctx.note.length} > ${MAX_NOTE_CHARS} chars`);
  }

  // File size: submissions cap at 10 MB per file.
  for (const [i, size] of ctx.fileSizes.entries()) {
    if (size > MAX_FILE_BYTES) {
      reasons.push(`attached file #${i + 1} too large: ${size} > ${MAX_FILE_BYTES} bytes`);
    }
  }

  // asOf freshness: the evidence snapshot must be from this run (< 2h old).
  const asOfAge = ctx.now.getTime() - new Date(c.asOf).getTime();
  if (asOfAge < -60_000 || asOfAge > MAX_AS_OF_AGE_MS) {
    reasons.push(`asOf ${c.asOf} is not fresh (age ${(asOfAge / 3_600_000).toFixed(1)}h, limit 2h)`);
  }

  // Freshness vs the market's resolution window. Two cases:
  //  - PAST baseline ("figure published strictly after <ts>" already passed): every
  //    source fetch must sit AFTER that baseline — pre-baseline publications are stale
  //    facts and earn $0.
  //  - FUTURE baseline ("event published strictly after <ts> and before ..."): the
  //    market resolves on an event that has not happened yet; the fetch must be fresh
  //    from THIS run (already enforced by the 2h asOf rule), which is the live readout
  //    the event will follow. A hard fetchedAt > baseline would wrongly reject every
  //    fetch made before the event window even opens.
  const baseline = marketBaselineTimestamp(ctx.market.resolutionCriteria);
  const cutoff = new Date(ctx.market.evidenceCutoffAt);
  const baselineIsPast = baseline !== null && baseline.getTime() <= ctx.now.getTime();
  for (const t of ctx.sourceFetchTimes) {
    const d = new Date(t);
    if (Number.isNaN(d.getTime())) {
      reasons.push(`source fetch time not parseable: ${t}`);
      continue;
    }
    if (baselineIsPast && d.getTime() <= baseline!.getTime()) {
      reasons.push(`source fetched ${t} is NOT after the market's resolution baseline ${baseline!.toISOString()} (stale facts earn $0)`);
    }
    if (baseline && d.getTime() >= cutoff.getTime()) {
      reasons.push(`source fetched ${t} is after the evidence cutoff ${ctx.market.evidenceCutoffAt}`);
    }
  }
  if (ctx.sourceFetchTimes.length === 0) {
    reasons.push("no live source fetch times recorded for this candidate (freshness unverifiable)");
  }

  return { pass: reasons.length === 0, reasons, warnings };
}

export function signatureFor(c: Omit<EvidenceCandidate, "factSignature">): string {
  return factSignature(c.marketAddress, c.headline, c.figures);
}
