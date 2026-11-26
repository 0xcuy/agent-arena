import type { CompetitionMarket, EntryState, EvidenceCandidate, GateVerdict } from "./types.js";
import { type EvidenceLog, factSignature } from "./evidence-log.js";

/**
 * Strict pre-submit quality/anti-rejection gate. A candidate that fails any check is
 * dropped from the run, never submitted. The goal is to stay on the Standard tier:
 * no spam, no unverifiable items, no both-sides hedging, no known facts.
 *
 * Item budget (per competition guide: "up to 3 items in total: a note, links and files"):
 * interpreted as 1 (note) + 1 (links block) + up to 1 attached CSV = 3 items.
 * If DELPHI counts each link separately, this bundle still fits the cap.
 */

export const ITEM_BUDGET = 3;
const MIN_EDGE_PCT = 2.5; // evidence must move the implied probability by at least this

export interface GateContext {
  market: CompetitionMarket;
  entry: EntryState;
  log: EvidenceLog;
  /** Online submissions already on the market for this account (live check). */
  onlineSubmissionCount: number;
}

export function gateCandidate(c: EvidenceCandidate, ctx: GateContext): GateVerdict {
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (!ctx.entry.canSubmit) reasons.push("entry state canSubmit=false");
  const slots = ctx.entry.remainingOnMarket - ctx.onlineSubmissionCount - ctx.log.submittedCount(ctx.market.address);
  if (slots <= 0) reasons.push("no submission slots left on market");
  if (ctx.entry.restricted) {
    warnings.push(
      "restricted tier: max 1 submission per market (would not be Standard-tier multi-submit)",
    );
  }
  if (Number(ctx.entry.judgementPotRemainingBaseUnits) <= 0) {
    warnings.push("judgment pot empty: judgment bounty $0 (settlement value may still count)");
  }

  // Both-sides rule: settlement value nets to $0 per person per market.
  const locked = ctx.log.lockedStance(c.marketAddress);
  if (locked !== null && locked !== c.stance) {
    reasons.push(`stance lock: market already covered with ${locked.toUpperCase()} stance; refusing ${c.stance.toUpperCase()} (both-sides nets $0)`);
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
  }
  if (c.figures.length < 2) {
    reasons.push("fewer than 2 key figures pasted into the note (unverifiable risk)");
  }

  // Anti-rejection: never submit bookmaker odds, stale headlines, opinion.
  const bannedFragments = ["bookmaker", "oddschecker", "betting odds", "prediction, ", "in my opinion"];
  const blob = (c.headline + " " + c.figures.join(" ") + " " + c.sourceDescriptions.join(" ")).toLowerCase();
  for (const b of bannedFragments) {
    if (blob.includes(b)) reasons.push(`banned content: "${b}" (known not to earn)`);
  }

  // Known-fact check: evidence that agrees with the market to within the noise floor earns nothing.
  const edge = Math.abs(c.analysis.evidenceImpliedYes - c.marketImpliedYes) * 100;
  if (edge < MIN_EDGE_PCT) {
    reasons.push(
      `evidence-implied P(yes)=${(c.analysis.evidenceImpliedYes * 100).toFixed(1)}% within ` +
        `${MIN_EDGE_PCT}pp of market implied ${(c.marketImpliedYes * 100).toFixed(1)}% (presumed priced)`,
    );
  }

  // Item budget: note (1) + links block (1) + files (n). One CSV attached keeps us at 3.
  const items = 1 + 1 + 1; // note + links + one CSV
  if (items > ITEM_BUDGET) reasons.push(`item budget exceeded: ${items} > ${ITEM_BUDGET}`);

  // Direction sanity: stance is the direction this evidence pushes the market
  // (up on P(yes) = "yes" stance, down = "no" stance), so it must agree with the
  // sign of the derived-vs-market gap.
  const delta = c.analysis.evidenceImpliedYes - c.marketImpliedYes;
  const derivedStance = delta >= 0 ? "yes" : "no";
  if (derivedStance !== c.stance) {
    reasons.push(
      `stance ${c.stance} disagrees with derived P(yes)=${c.analysis.evidenceImpliedYes.toFixed(3)} ` +
        `vs market ${(c.marketImpliedYes * 100).toFixed(1)}%`,
    );
  }

  return { pass: reasons.length === 0, reasons, warnings };
}

export function signatureFor(c: Omit<EvidenceCandidate, "factSignature">): string {
  return factSignature(c.marketAddress, c.headline, c.figures);
}
