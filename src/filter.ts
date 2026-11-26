import type { CompetitionMarket, EntryState } from "./types.js";
import type { MiningPath } from "./types.js";

/**
 * Market picking filter, per the build brief:
 *  - canSubmit true, remaining slots > 0
 *  - evidence cutoff > 6h from now
 *  - remaining judgment pot > $0 (an empty pot pays no judgment bounty)
 *  - implied odds in the 30-70% band (fair two-sided markets)
 *  - market still open; evidence cutoff before competition end
 * Ranking: more judgment pot left first, then lower mining-path number (arithmetic >
 * machine-readable > scraping), because earlier, stronger evidence earns the most.
 */

export const ODDS_BAND = { min: 0.3, max: 0.7 };
export const MIN_CUTOFF_LEAD_HOURS = 6;

export interface MarketEligibility {
  market: CompetitionMarket;
  entry: EntryState;
  eligible: boolean;
  reasons: string[];
}

export function judgementPotUsd(entry: EntryState): number {
  return Number(entry.judgementPotRemainingBaseUnits) / 1e6;
}

export function checkEligibility(
  market: CompetitionMarket,
  entry: EntryState,
  now: Date,
  competitionEndsAt: Date,
): MarketEligibility {
  const reasons: string[] = [];
  const cutoff = new Date(market.evidenceCutoffAt);
  if (market.status !== "open") reasons.push(`market status ${market.status}`);
  if (!entry.canSubmit) reasons.push(entry.reason ? `canSubmit=false (${entry.reason})` : "canSubmit=false");
  if (entry.remainingOnMarket <= 0) reasons.push("no submission slots left on market");
  if (cutoff.getTime() - now.getTime() <= MIN_CUTOFF_LEAD_HOURS * 3600_000) {
    reasons.push(`cutoff ${market.evidenceCutoffAt} not > ${MIN_CUTOFF_LEAD_HOURS}h away`);
  }
  if (cutoff.getTime() >= competitionEndsAt.getTime()) {
    reasons.push("cutoff after competition end");
  }
  if (Number(entry.judgementPotRemainingBaseUnits) <= 0) {
    reasons.push("judgment pot empty (judgment bounty $0)");
  }
  const p = market.odds.yes;
  if (p < ODDS_BAND.min || p > ODDS_BAND.max) {
    reasons.push(`odds ${Math.round(p * 100)}% outside ${ODDS_BAND.min * 100}-${ODDS_BAND.max * 100}% band`);
  }
  return { market, entry, eligible: reasons.length === 0, reasons };
}

export function rankMarkets(
  eligible: MarketEligibility[],
  pathByAddress: Map<string, MiningPath>,
): MarketEligibility[] {
  return [...eligible].sort((a, b) => {
    const potDiff = Number(b.entry.judgementPotRemainingBaseUnits) - Number(a.entry.judgementPotRemainingBaseUnits);
    if (potDiff !== 0) return potDiff;
    const pa = pathByAddress.get(a.market.address) ?? 3;
    const pb = pathByAddress.get(b.market.address) ?? 3;
    if (pa !== pb) return pa - pb;
    return new Date(a.market.evidenceCutoffAt).getTime() - new Date(b.market.evidenceCutoffAt).getTime();
  });
}
