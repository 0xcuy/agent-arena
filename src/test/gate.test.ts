import assert from "node:assert/strict";
import test from "node:test";
import { checkEligibility, rankMarkets } from "../filter.js";
import { gateCandidate, ITEM_BUDGET } from "../gate.js";
import { EvidenceLog, factSignature } from "../evidence-log.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompetitionMarket, EntryState, EvidenceCandidate } from "../types.js";

function fakeMarket(p: number, cutoff = "2026-12-05T12:00:00.000Z", address = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"): CompetitionMarket {
  return {
    address,
    question: "Will the fake market resolve YES?",
    delphiUrl: `https://delphi.fyi/market/${address}`,
    category: "economics",
    marketTier: "A",
    wave: 1,
    status: "open",
    odds: { yes: p, no: 1 - p },
    closesAt: "2026-12-06T12:00:00.000Z",
    evidenceCutoffAt: cutoff,
    pots: { judgement: "20000000", settlement: "30000000" },
    resolutionCriteria: "criteria",
  };
}

function fakeEntry(over: Partial<EntryState> = {}): EntryState {
  return {
    canSubmit: true,
    remainingOnMarket: 3,
    judgementPotRemainingBaseUnits: "20000000",
    restricted: false,
    rateLimit: { resetAt: "2026-11-26T18:00:00.000Z" },
    ...over,
  };
}

const NOW = new Date("2026-11-26T12:00:00.000Z");
const END = new Date("2026-12-11T17:00:00.000Z");

test("filter: odds band rejects extremes, accepts fair band", () => {
  assert.equal(checkEligibility(fakeMarket(0.299), fakeEntry(), NOW, END).eligible, false);
  assert.equal(checkEligibility(fakeMarket(0.701), fakeEntry(), NOW, END).eligible, false);
  assert.equal(checkEligibility(fakeMarket(0.30), fakeEntry(), NOW, END).eligible, true);
  assert.equal(checkEligibility(fakeMarket(0.70), fakeEntry(), NOW, END).eligible, true);
});

test("filter: cutoff lead, canSubmit, slots, pot", () => {
  // cutoff less than 6h away
  const soon = checkEligibility(fakeMarket(0.5, "2026-11-26T15:00:00.000Z"), fakeEntry(), NOW, END);
  assert.equal(soon.eligible, false);
  assert.ok(soon.reasons.some((r) => r.includes("cutoff")));
  // cannot submit
  const blocked = checkEligibility(fakeMarket(0.5), fakeEntry({ canSubmit: false, remainingOnMarket: 0 }), NOW, END);
  assert.equal(blocked.eligible, false);
  assert.ok(blocked.reasons.some((r) => r.includes("canSubmit")));
  // empty judgment pot
  const drained = checkEligibility(fakeMarket(0.5), fakeEntry({ judgementPotRemainingBaseUnits: "0" }), NOW, END);
  assert.equal(drained.eligible, false);
  assert.ok(drained.reasons.some((r) => r.includes("judgment pot")));
});

test("filter: ranks higher remaining pot first, then mining path", () => {
  const a = checkEligibility(fakeMarket(0.5, "2026-12-05T00:00:00.000Z", "0x" + "aa".repeat(20)), fakeEntry({ judgementPotRemainingBaseUnits: "5000000" }), NOW, END);
  const b = checkEligibility(fakeMarket(0.5, "2026-12-05T00:00:00.000Z", "0x" + "bb".repeat(20)), fakeEntry({ judgementPotRemainingBaseUnits: "15000000" }), NOW, END);
  const ranks = rankMarkets([a, b], new Map());
  assert.equal(ranks[0]!.market.address, b.market.address);
});

function fakeCandidate(over: Partial<EvidenceCandidate> = {}): EvidenceCandidate {
  return {
    marketAddress: "0x" + "cc".repeat(20),
    marketQuestion: "q",
    marketImpliedYes: 0.5,
    topic: "t",
    miningPath: 1,
    langs: ["en"],
    headline: "dated fact with figures 1 2 3",
    figures: ["fig 1", "fig 2", "fig 3"],
    sourceDescriptions: ["shows figures"],
    links: [{ url: "https://example.com/a", label: "a", lang: "en", access: "static-html" }],
    analysis: { kind: "cpi_base_effect", evidenceImpliedYes: 0.75, confidence: "high", methodLines: ["m1"], figureSummary: "s" },
    stance: "yes",
    factSignature: factSignature("0x" + "cc".repeat(20), "dated fact with figures 1 2 3", ["fig 1", "fig 2", "fig 3"]),
    asOf: "2026-11-26T12:00:00.000Z",
    ...over,
  };
}

function gateCtx(log: EvidenceLog) {
  return {
    market: fakeMarket(0.5),
    entry: fakeEntry(),
    log,
    onlineSubmissionCount: 0,
  };
}

test("gate: passes a strong, sourced, one-sided candidate", () => {
  const log = new EvidenceLog(join(mkdtempSync(join(tmpdir(), "aa-")), "log.jsonl"));
  const v = gateCandidate(fakeCandidate(), gateCtx(log));
  assert.equal(v.pass, true, JSON.stringify(v.reasons));
});

test("gate: known-fact check rejects evidence within the noise floor", () => {
  const log = new EvidenceLog(join(mkdtempSync(join(tmpdir(), "aa-")), "log.jsonl"));
  const c = fakeCandidate({ analysis: { kind: "cpi_base_effect", evidenceImpliedYes: 0.51, confidence: "low", methodLines: [], figureSummary: "" } });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("presumed priced")));
});

test("gate: both-sides stance lock enforced via evidence-log", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const log = new EvidenceLog(join(dir, "log.jsonl"));
  const c1 = fakeCandidate();
  log.append({
    ts: "2026-11-26T12:00:00.000Z",
    marketAddress: c1.marketAddress,
    topic: c1.topic,
    stance: "yes",
    factSignature: "sig-1",
    status: "drafted",
    draftPath: "drafts/x",
    submissionId: null,
    note: "first stance",
  });
  const c2 = fakeCandidate({ stance: "no", analysis: { kind: "cpi_base_effect", evidenceImpliedYes: 0.25, confidence: "high", methodLines: [], figureSummary: "" } });
  const v = gateCandidate(c2, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("both-sides")));
});

test("gate + evidence-log: duplicate fact signature refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const log = new EvidenceLog(join(dir, "log.jsonl"));
  const c = fakeCandidate();
  log.append({
    ts: "2026-11-26T12:00:00.000Z",
    marketAddress: c.marketAddress,
    topic: c.topic,
    stance: "yes",
    factSignature: c.factSignature,
    status: "submitted",
    draftPath: "drafts/x",
    submissionId: "sub-1",
    note: "already sent",
  });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("duplicate")));
  rmSync(dir, { recursive: true, force: true });
});

test("gate: banned bookmaker content refused", () => {
  const log = new EvidenceLog(join(mkdtempSync(join(tmpdir(), "aa-")), "log.jsonl"));
  const c = fakeCandidate({ headline: "Bookmaker odds moved to 1.85" });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("banned content")));
});

test("gate: unverifiable risk — too few pasted figures", () => {
  const log = new EvidenceLog(join(mkdtempSync(join(tmpdir(), "aa-")), "log.jsonl"));
  const c = fakeCandidate({ figures: ["only one"] });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("unverifiable")));
});

test("item budget: note + links + 1 CSV stays within 3 items", () => {
  const items = 1 + 1 + 1; // note, links block, data.csv — mirrors gate counting
  assert.ok(items <= ITEM_BUDGET);
});
