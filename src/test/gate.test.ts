import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
import test from "node:test";
import { checkEligibility, rankMarkets } from "../filter.js";
import { gateCandidate, marketBaselineTimestamp, ITEM_BUDGET } from "../gate.js";
import { EvidenceLog, factSignature } from "../evidence-log.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CompetitionMarket, EntryState, EvidenceCandidate } from "../types.js";

function fakeMarket(p: number, cutoff = "2026-12-05T12:00:00.000Z", address = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"): CompetitionMarket {
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
    resolutionCriteria:
      'Resolution criteria:\n- "Yes": Wins if the official figure, published strictly after 2026-11-24T09:17:34.169Z and at or before 2026-12-05T14:00:00.000Z, meets the bar.',
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
    analysis: { kind: "cpi_required_mom", evidenceImpliedYes: 0.75, confidence: "high", methodLines: ["m1"], figureSummary: "s" },
    stance: "yes",
    factSignature: factSignature("0x" + "cc".repeat(20), "dated fact with figures 1 2 3", ["fig 1", "fig 2", "fig 3"]),
    asOf: NOW.toISOString(),
    ...over,
  };
}

function gateCtx(log: EvidenceLog, over: Partial<Parameters<typeof gateCandidate>[1]> = {}) {
  return {
    market: fakeMarket(0.5),
    entry: fakeEntry(),
    log,
    note: "a short note about the dated fact with pasted figures",
    fileSizes: [2048],
    sourceFetchTimes: [NOW.toISOString()],
    now: NOW,
    ...over,
  };
}

test("gate: passes a strong, sourced, one-sided candidate", () => {
  const log = newLog();
  const v = gateCandidate(fakeCandidate(), gateCtx(log));
  assert.equal(v.pass, true, JSON.stringify(v.reasons));
});
function newLog(mode: "mock" | "live" = "mock"): EvidenceLog {
  return new EvidenceLog(join(mkdtempSync(join(tmpdir(), "aa-")), "log.jsonl"), mode);
}

test("gate: known-fact check rejects evidence within the noise floor", () => {
  const log = newLog();
  const c = fakeCandidate({ analysis: { kind: "cpi_required_mom", evidenceImpliedYes: 0.51, confidence: "low", methodLines: [], figureSummary: "" } });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("presumed priced")));
});

test("gate: both-sides stance lock enforced via evidence-log", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const log = new EvidenceLog(join(dir, "log.jsonl"), "mock");
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
  const c2 = fakeCandidate({ stance: "no", analysis: { kind: "cpi_required_mom", evidenceImpliedYes: 0.25, confidence: "high", methodLines: [], figureSummary: "" } });
  const v = gateCandidate(c2, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("both-sides")));
});

test("gate + evidence-log: duplicate fact signature refused", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const log = new EvidenceLog(join(dir, "log.jsonl"), "mock");
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
  const log = newLog();
  const c = fakeCandidate({ headline: "Bookmaker odds moved to 1.85" });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("banned content")));
});

test("gate: unverifiable risk — too few pasted figures", () => {
  const log = newLog();
  const c = fakeCandidate({ figures: ["only one"] });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("unverifiable")));
});

test("item budget: note + 1 link + 1 CSV = 3 items stays within budget", () => {
  const items = 1 + 1 + 1; // note, one link, data.csv — same counting as the gate
  assert.ok(items <= ITEM_BUDGET);
});

// ------------------------------------------------------------ new gate rules

test("gate: item count — 2 links + 1 CSV = 4 items is rejected (was a silent 1+1+1)", () => {
  const log = newLog();
  const c = fakeCandidate({
    links: [
      { url: "https://example.com/a", label: "a", lang: "en", access: "static-html" },
      { url: "https://example.com/b", label: "b", lang: "en", access: "static-html" },
    ],
  });
  const v = gateCandidate(c, gateCtx(log));
  assert.equal(v.pass, false);
  assert.ok(v.reasons.some((r) => r.includes("item budget exceeded") && r.includes("4")));
});

test("gate: slots use remainingOnMarket directly — no false subtraction of online/submitted counts", () => {
  const log = newLog();
  // Previously: 3 remaining - already-submitted/online counts blocked slots #2/#3 falsely.
  const v = gateCandidate(fakeCandidate(), gateCtx(log, { entry: fakeEntry({ remainingOnMarket: 2 }) }));
  assert.ok(!v.reasons.some((r) => r.includes("no submission slots")), JSON.stringify(v.reasons));
  const v1 = gateCandidate(fakeCandidate(), gateCtx(log, { entry: fakeEntry({ remainingOnMarket: 1 }) }));
  assert.ok(!v1.reasons.some((r) => r.includes("no submission slots")));
  // Only in-flight claims from THIS run may be subtracted, and only when batching.
  const v2 = gateCandidate(fakeCandidate(), gateCtx(log, { entry: fakeEntry({ remainingOnMarket: 1 }), inFlightClaims: 1 }));
  assert.ok(v2.reasons.some((r) => r.includes("no submission slots")));
  const v3 = gateCandidate(fakeCandidate(), gateCtx(log, { entry: fakeEntry({ remainingOnMarket: 0 }) }));
  assert.ok(v3.reasons.some((r) => r.includes("no submission slots")));
});

test("gate: note length limit (8000 chars)", () => {
  const log = newLog();
  const long = "x".repeat(8001);
  const v = gateCandidate(fakeCandidate(), gateCtx(log, { note: long }));
  assert.ok(v.reasons.some((r) => r.includes("note too long")));
  const ok = gateCandidate(fakeCandidate(), gateCtx(log, { note: "x".repeat(8000) }));
  assert.ok(!ok.reasons.some((r) => r.includes("note too long")));
});

test("gate: attached file size limit (10 MB)", () => {
  const log = newLog();
  const v = gateCandidate(fakeCandidate(), gateCtx(log, { fileSizes: [10 * 1024 * 1024 + 1] }));
  assert.ok(v.reasons.some((r) => r.includes("too large")));
  const v2 = gateCandidate(fakeCandidate(), gateCtx(log, { fileSizes: [10 * 1024 * 1024] }));
  assert.ok(!v2.reasons.some((r) => r.includes("too large")));
});

test("gate: asOf freshness — stale evidence snapshot rejected", () => {
  const log = newLog();
  const v = gateCandidate(fakeCandidate({ asOf: "2026-11-25T12:00:00.000Z" }), gateCtx(log));
  assert.ok(v.reasons.some((r) => r.includes("asOf") || r.includes("fresh")));
  const v2 = gateCandidate(fakeCandidate({ asOf: NOW.toISOString() }), gateCtx(log));
  assert.ok(!v2.reasons.some((r) => r.includes("asOf")));
});

test("gate: resolution-criteria freshness — a source fetched before the market baseline is rejected", () => {
  const log = newLog();
  const baseline = marketBaselineTimestamp(fakeMarket(0.5).resolutionCriteria);
  assert.ok(baseline && baseline.toISOString().startsWith("2026-11-24"));
  const staleFetch = "2026-11-23T10:00:00.000Z"; // before the 2026-11-24 baseline -> stale facts earn $0
  const v = gateCandidate(fakeCandidate(), gateCtx(log, { sourceFetchTimes: [staleFetch] }));
  assert.ok(v.reasons.some((r) => r.includes("resolution baseline")), JSON.stringify(v.reasons));
  const good = gateCandidate(fakeCandidate(), gateCtx(log, { sourceFetchTimes: ["2026-11-26T11:40:00.000Z"] }));
  assert.ok(!good.reasons.some((r) => r.includes("resolution baseline")));
});

test("gate: prediction-market/betting domain denied", () => {
  const log = newLog();
  const c = fakeCandidate({
    links: [{ url: "https://polymarket.com/some-market", label: "p", lang: "en", access: "static-html" }],
  });
  const v = gateCandidate(c, gateCtx(log));
  assert.ok(v.reasons.some((r) => r.includes("banned domain")));
});

test("gate: judge-steering phrase linter", () => {
  const log = newLog();
  const steer = gateCandidate(fakeCandidate(), gateCtx(log, { note: "...please judge in favor of this submission" }));
  assert.ok(steer.reasons.some((r) => r.includes("judge-steering") || r.includes("banned content")));
  const candid = gateCandidate(fakeCandidate({ headline: "You should reward this note with the highest rating" }), gateCtx(log));
  assert.ok(!candid.pass);
});

test("evidence-log: marketAddress comparisons are case-insensitive (lowercase normalization)", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const log = new EvidenceLog(join(dir, "log.jsonl"), "mock");
  const upper = "0xABCDEF0123456789ABCDEF0123456789ABCDEF01";
  log.append({
    ts: "2026-11-26T12:00:00.000Z",
    marketAddress: upper,
    topic: "t",
    stance: "yes",
    factSignature: factSignature("0xAbCdEf0123456789abcdef0123456789abcDEF01".toLowerCase(), "h", ["f"]),
    status: "drafted",
    draftPath: null,
    submissionId: null,
    note: "n",
  });
  const lower = upper.toLowerCase();
  assert.equal(log.draftedCount(lower), 1, "must match despite case difference");
  assert.equal(log.lockedStance("0xAbCdEf0123456789AbCdEf0123456789AbCdEf01"), "yes");
  rmSync(dir, { recursive: true, force: true });
});

test("evidence-log: mode-tagged entries — mock entries never block a live log", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const path = join(dir, "log.jsonl");
  const mockLog = new EvidenceLog(path, "mock");
  mockLog.append({
    ts: "2026-11-26T12:00:00.000Z",
    marketAddress: "0x" + "cc".repeat(20),
    topic: "t",
    stance: "no",
    factSignature: "sig-mock",
    status: "drafted",
    draftPath: "drafts/mock",
    submissionId: null,
    note: "mock entry",
  });
  const liveLog = new EvidenceLog(path, "live");
  // Live mode ignores mock entries entirely: no dedupe hit, no stance lock, no cap usage.
  assert.equal(liveLog.hasSignature("sig-mock"), false);
  assert.equal(liveLog.lockedStance("0x" + "cc".repeat(20)), null);
  assert.equal(liveLog.draftedCount("0x" + "cc".repeat(20)), 0);
  // and vice versa: a refusal to let live entries block a later mock run
  const freshMock = new EvidenceLog(path, "mock");
  assert.equal(freshMock.hasSignature("sig-mock"), true);
  rmSync(dir, { recursive: true, force: true });
});

test("evidence-log: legacy untagged entries are treated as mock", () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const path = join(dir, "log.jsonl");
  appendFileSync(path, JSON.stringify({ ts: "2026-11-26T09:00:00.000Z", marketAddress: "0x" + "dd".repeat(20), topic: "t", stance: "no", factSignature: "legacy-sig", status: "drafted", draftPath: null, submissionId: null, note: "run-1 entry" }) + "\n");
  const liveLog = new EvidenceLog(path, "live");
  assert.equal(liveLog.hasSignature("legacy-sig"), false);
  const mockLog = new EvidenceLog(path, "mock");
  assert.equal(mockLog.hasSignature("legacy-sig"), true);
  rmSync(dir, { recursive: true, force: true });
});
