import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { CompetitionMarket, EntryState, EvidenceLimits, EvidenceTerms, SubmissionRecord } from "../types.js";

/**
 * Mock Delphi state. Markets snapshot is the real Wave 1 list fetched read-only from
 * https://competition.delphi.fyi/markets.json (public, no key needed) so mock runs
 * exercise the same data as live runs. Entry states, limits, terms and submissions
 * are fixtures with a few deliberate edge cases for QA.
 */

const FIXTURE_MARKETS_PATH = fileURLToPath(new URL("../fixtures-markets.json", import.meta.url));

export function loadFixtureMarkets(): CompetitionMarket[] {
  const raw = JSON.parse(readFileSync(FIXTURE_MARKETS_PATH, "utf-8")) as CompetitionMarket[];
  return raw;
}

const DEFAULT_ENTRY_STATE: EntryState = {
  canSubmit: true,
  remainingOnMarket: 3,
  judgementPotRemainingBaseUnits: "20000000", // $20.00 of judgment pot left
  restricted: false,
  rateLimit: { resetAt: "2026-11-26T18:00:00.000Z" },
};

/** Edge cases so the pipeline demonstrably skips unusable markets. */
const ENTRY_STATE_OVERRIDES: Record<string, Partial<EntryState>> = {
  // Korea budget bill (0xbb26…): per-market limit exhausted (3/3 already used).
  "0xbb2666746de61bb1b119398f4db48a53d64e20cd": {
    canSubmit: false,
    remainingOnMarket: 0,
    reason: "market_submission_cap",
  },
  // Turkey CPI (0x48c2…): Restricted tier example — 1 submission per market.
  "0x48c2f4d761be00f8d9342a7de34d54673c506631": {
    canSubmit: true,
    remainingOnMarket: 1,
    restricted: true,
  },
  // ARC-AGI-3 Kaggle (0xa96d…): judgment pot drained — judgment bounty is $0.
  "0xa96dc716066329d666f3c50e6d8f71c701347296": {
    canSubmit: true,
    remainingOnMarket: 3,
    judgementPotRemainingBaseUnits: "0",
  },
};

const MOCK_LIMITS: EvidenceLimits = {
  submitsLeftThisHour: 30,
  hourEndsAt: "2026-11-26T18:00:00.000Z",
  dailyCapLeft: 80,
  dailyCapResetAt: "2026-11-27T00:00:00.000Z",
};

const MOCK_TERMS: EvidenceTerms = {
  version: "2026-11-main",
  url: "https://delphi.fyi/terms",
  acceptedAt: "2026-11-25T17:30:00.000Z",
};

/** Previously submitted items on this account in mock state (dedupe realism). */
const MOCK_SUBMISSIONS: SubmissionRecord[] = [];

export function mockEntryState(address: string): EntryState {
  return { ...DEFAULT_ENTRY_STATE, ...ENTRY_STATE_OVERRIDES[address] };
}

export function mockLimits(): EvidenceLimits {
  return { ...MOCK_LIMITS };
}

export function mockTerms(): EvidenceTerms {
  return { ...MOCK_TERMS };
}

export function mockSubmissions(market?: string): SubmissionRecord[] {
  return market
    ? MOCK_SUBMISSIONS.filter((s) => s.markets.some((m) => m.marketAddress === market))
    : [...MOCK_SUBMISSIONS];
}

export const MOCK_NOW = "2026-11-26T12:00:00.000Z";
export const MOCK_RUN_ID = randomUUID();
