import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAnalysis, verifySources } from "../miners/mine.js";
import { createFirecrawl } from "../firecrawl/client.js";
import { SCRAPE_FIXTURES } from "../firecrawl/client.js";
import type { ResearchSpec } from "../types.js";
import type { AgentConfig } from "../config.js";

test("mathgen: cpi_base_effect reproduces the required-MoM derivation", () => {
  const spec: ResearchSpec = {
    marketAddress: "0x" + "11".repeat(20),
    topic: "test-cpi",
    miningPath: 1,
    langs: ["de"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [],
    analysis: {
      kind: "cpi_base_effect",
      params: {
        indexName: "x",
        targetMonth: "November",
        targetThresholdPct: 2.8,
        yearAgoYm: "2025-11",
        yearAgoIndex: 115.4,
        series: [["2025-11", 115.4], ["2026-10", 118.2]],
        seasonalMomPct: [0.2, 0.1, 0.5, 0.0, 0.1, -0.1, 0.3, 0.1, 0.2, 0.0],
      },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const res = runAnalysis(spec, join(dir, "data.csv"), "2026-11-26T12:00:00.000Z");
  assert.equal(res.kind, "cpi_base_effect");
  // required MoM = (1.028*115.4/118.2 - 1)*100 = 0.3647... should appear in method text
  assert.ok(res.methodLines.some((l) => l.includes("0.365")), res.methodLines.join("; "));
  assert.ok(res.evidenceImpliedYes > 0 && res.evidenceImpliedYes < 0.3);
  rmSync(dir, { recursive: true, force: true });
});

test("mathgen: markov_lead — a 0.5 lead only fails if the leader loses", () => {
  const spec: ResearchSpec = {
    marketAddress: "0x" + "22".repeat(20),
    topic: "test-markov",
    miningPath: 2,
    langs: ["en"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [],
    analysis: {
      kind: "markov_lead",
      params: {
        asOfGame: 7,
        leader: "A",
        leaderPoints: 4.0,
        trailer: "B",
        trailerPoints: 3.5,
        games: [{ leaderColor: "White", winProb: 0.3, drawProb: 0.55, lossProb: 0.15 }],
        historicalBasis: "test",
      },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const res = runAnalysis(spec, join(dir, "data.csv"), "2026-11-26T12:00:00.000Z");
  assert.ok(Math.abs(res.evidenceImpliedYes - 0.85) < 1e-9);
  rmSync(dir, { recursive: true, force: true });
});

test("verifySources: expect substrings must be present in scraped content", async () => {
  const cfg = { mode: "mock", liveSubmit: false } as unknown as AgentConfig;
  const firecrawl = createFirecrawl(cfg);
  const url = Object.keys(SCRAPE_FIXTURES)[0]!;
  const spec: ResearchSpec = {
    marketAddress: "0x" + "33".repeat(20),
    topic: "test-verify",
    miningPath: 3,
    langs: ["de"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [
      { url, label: "l", lang: "de", access: "scraped", expect: ["VPI"] },
    ],
    analysis: { kind: "ballot_flag_snapshot", params: {} },
  };
  const ok = await verifySources(spec, firecrawl);
  assert.equal(ok.ok, true, JSON.stringify(ok.failures));
  const bad: ResearchSpec = {
    ...spec,
    links: [{ url, label: "l", lang: "de", access: "scraped", expect: ["NOT-PRESENT-STRING"] }],
  };
  const fail = await verifySources(bad, firecrawl);
  assert.equal(fail.ok, false);
  assert.equal(fail.failures[0]!.missing[0], "NOT-PRESENT-STRING");
});

test("submitter guard: mode=mock config can never enable liveSubmit", async () => {
  const { resolveConfig } = await import("../config.js");
  delete process.env.DELPHI_API_ACCESS_KEY;
  delete process.env.LIVE_SUBMIT;
  const cfg = resolveConfig({ mode: "mock", liveSubmit: true });
  assert.equal(cfg.liveSubmit, false);
  assert.equal(cfg.mode, "mock");
});

test("submitDraft refuses without the triple guard", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  writeFileSync(join(dir, "manifest.json"), "{}");
  const { submitDraft, SubmitGuardError } = await import("../submitter.js");
  const cfg = { mode: "live", liveSubmit: false } as unknown as AgentConfig;
  await assert.rejects(() => submitDraft(cfg, dir), SubmitGuardError);
  rmSync(dir, { recursive: true, force: true });
});
