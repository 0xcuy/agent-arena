import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAnalysis, verifySources } from "../miners/mine.js";
import { createSources, LIVE_FIXTURES, FIXTURE_FETCHED_AT } from "../miners/live/sources.js";
import { RESEARCH_SEEDS, SEEDS_BY_MARKET, refreshSeed } from "../miners/live/refreshers.js";
import type { ResearchSpec } from "../types.js";
import type { AgentConfig } from "../config.js";

const MOCK_CFG = { mode: "mock", liveSubmit: false } as unknown as AgentConfig;
const CTX = { now: new Date("2026-11-26T12:00:00.000Z"), live: false };

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

test("mathgen: match_lead_elo — exact enumeration from a tie with an Elo edge", () => {
  const spec: ResearchSpec = {
    marketAddress: "0x" + "23".repeat(20),
    topic: "test-elo",
    miningPath: 2,
    langs: ["en"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [],
    analysis: {
      kind: "match_lead_elo",
      params: {
        nameA: "A",
        nameB: "B",
        scoreA: 1,
        scoreB: 1,
        eloA: 2780,
        eloB: 2712,
        gamesRemaining: 6,
        drawShare: 0.75,
        scoreSource: "t",
        eloSource: "t",
      },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const res = runAnalysis(spec, join(dir, "data.csv"), "2026-11-26T12:00:00.000Z");
  assert.ok(res.evidenceImpliedYes > 0.5 && res.evidenceImpliedYes < 0.95, `p=${res.evidenceImpliedYes}`);
  // symmetric check: a zero Elo gap must give exactly 1 - P(ahead) on the mirrored question
  const mirror = runAnalysis(
    { ...spec, analysis: { kind: "match_lead_elo", params: { ...spec.analysis.params, eloA: 2712, eloB: 2780 } } },
    join(dir, "m.csv"),
    "2026-11-26T12:00:00.000Z",
  );
  assert.ok(mirror.evidenceImpliedYes < 0.5);
  rmSync(dir, { recursive: true, force: true });
});

test("verifySources: expect substrings must be present in scraped content (live-fixture-backed)", async () => {
  const sources = createSources(MOCK_CFG);
  const url = Object.keys(LIVE_FIXTURES).find((k) => k.includes("destatis.de/DE/Presse/Pressemitteilungen/2026"))!;
  const spec: ResearchSpec = {
    marketAddress: "0x" + "33".repeat(20),
    topic: "test-verify",
    miningPath: 3,
    langs: ["de"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [{ url, label: "l", lang: "de", access: "scraped", expect: ["Verbraucherpreisindex"] }],
    analysis: { kind: "ballot_flag_snapshot", params: {} },
  };
  const ok = await verifySources(spec, sources, []);
  assert.equal(ok.ok, true, JSON.stringify(ok.failures));
  const bad: ResearchSpec = {
    ...spec,
    links: [{ url, label: "l", lang: "de", access: "scraped", expect: ["NOT-PRESENT-STRING"] }],
  };
  const fail = await verifySources(bad, sources, []);
  assert.equal(fail.ok, false);
  assert.equal(fail.failures[0]!.missing[0], "NOT-PRESENT-STRING");
});

test("verifySources: api-json links are verified too (no longer shipped on trust)", async () => {
  const sources = createSources(MOCK_CFG);
  const spec: ResearchSpec = {
    marketAddress: "0x" + "34".repeat(20),
    topic: "test-verify-json",
    miningPath: 2,
    langs: ["en"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [
      {
        url: "https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json",
        label: "siteinfo",
        lang: "en",
        access: "api-json",
        expect: ["7269403"],
      },
    ],
    analysis: { kind: "threshold_velocity", params: {} },
  };
  const out = await verifySources(spec, sources, []);
  assert.equal(out.ok, true, JSON.stringify(out.failures));
});

test("verifySources: note-figure cross-check — a figure typo in the note is caught", async () => {
  const sources = createSources(MOCK_CFG);
  const url = "https://www.stadt-zuerich.ch/de/aktuell/news/2026/stimmbeteiligung.html";
  const spec: ResearchSpec = {
    marketAddress: "0x" + "35".repeat(20),
    topic: "test-verify-figs",
    miningPath: 3,
    langs: ["de"],
    headline: "h",
    figures: ["bogus figure: postal return was 99,9%"],
    sourceDescriptions: ["s"],
    links: [{ url, label: "l", lang: "de", access: "scraped", expect: ["39,6"] }],
    analysis: { kind: "turnout_threshold", params: {} },
  };
  const out = await verifySources(spec, sources, spec.figures);
  assert.equal(out.ok, false);
  assert.ok(out.failures.some((f) => f.missing.some((m) => m.includes("figure #1"))));
  // and a comma/decimal-faithful figure passes: the page says 39,6, the note says 39.6
  const okOut = await verifySources(
    { ...spec, figures: ["Stadt Zürich postal returns: 39.6% at fetch time"] },
    sources,
    ["Stadt Zürich postal returns: 39.6% at fetch time"],
  );
  assert.equal(okOut.ok, true, JSON.stringify(okOut.failures));
});

test("mock source layer: a URL with no fixture fails loudly (never invents content)", async () => {
  const sources = createSources(MOCK_CFG);
  await assert.rejects(() => sources.fetch("https://never-fetched.example/missing"), /no fixture/);
});

test("live refresh: wikipedia — fresh siteinfo count + year-start row drive the velocity math", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "wikipedia-articles")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const p = r.spec.analysis.params as Record<string, number | undefined>;
  assert.equal(p.currentCount, 7269403);
  assert.ok(p.dailyNetMean! > 400 && p.dailyNetMean! < 500, `dailyNetMean=${p.dailyNetMean}`);
  const requiredPerDay = (7275500 - (p.currentCount as number)) / (p.daysRemaining as number);
  assert.ok(requiredPerDay > 400 && requiredPerDay < 460, `requiredPerDay=${requiredPerDay}`);
  assert.ok(r.spec.figures.some((f) => f.includes("7,269,403")));
  assert.ok(r.spec.links.every((l) => l.expect && l.expect.length > 0));
});

test("live refresh: go-1-27-5 — milestone found BY TITLE (457), never the #305 bug", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "go-1-27-5")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const fig0 = r.spec.figures.join(" ");
  assert.match(fig0, /number 457/);
  assert.match(fig0, /14 open \/ 18 closed/);
  // go.dev minors parsed live: 1.27.4 released 2026-11-10 (run-1 spec said Nov 12 — wrong)
  assert.match(fig0, /go1\.27\.4 \(2026-11-10\)/);
  // the parsed releases feed release_gap_cdf with the listing window
  const params = r.spec.analysis.params as { releases: { tag: string; date: string }[]; windowEnd: string };
  assert.ok(params.releases.some((x) => x.tag === "go1.27.4" && x.date === "2026-11-10"));
});

test("live refresh: de-cpi — real Destatis figures (index 126.5 / 122.7), not the run-1 fiction", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "de-cpi-nov")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const figs = r.spec.figures.join(" ");
  assert.match(figs, /126\.5/);
  assert.match(figs, /122\.7/);
  assert.match(figs, /\+2\.8% YoY/);
  const p = r.spec.analysis.params as { yearAgoIndex: number; latestIndex: number; targetThresholdPct: number };
  // required MoM for YoY >= 2.8%: (1.028*122.7/126.5 - 1) = -0.2879%
  assert.ok(Math.abs(p.yearAgoIndex - 122.7) < 0.01);
  assert.ok(Math.abs(p.latestIndex - 126.5) < 0.01);
  const required = ((1 + p.targetThresholdPct / 100) * p.yearAgoIndex) / p.latestIndex - 1;
  assert.ok(Math.abs(required * 100 + 0.288) < 0.01, `required MoM ${(required * 100).toFixed(3)}%`);
});

test("live refresh: ch-cpi — BFS chain puts Nov 2025 at ~100.094 on the current base", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-cpi-nov")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const p = r.spec.analysis.params as { yearAgoIndex: number; latestIndex: number };
  assert.ok(Math.abs(p.yearAgoIndex - 100.094) < 0.01, `yearAgoIndex=${p.yearAgoIndex}`);
  assert.ok(Math.abs(p.latestIndex - 101.7) < 0.01);
});

test("live refresh: fide — live score 1-1 after game 2 + live Elo 2780/2712", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const p = r.spec.analysis.params as { scoreA: number; scoreB: number; eloA: number; eloB: number; gamesRemaining: number };
  assert.equal(p.scoreA, 1);
  assert.equal(p.scoreB, 1);
  assert.equal(p.eloA, 2780);
  assert.equal(p.eloB, 2712);
  assert.equal(p.gamesRemaining, 6);
  assert.ok(r.spec.links.some((l) => l.url.includes("fide.com")));
});

test("live refresh: ietf ballot — 1 Yes, no DISCUSS, 14 members (live ballot state)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ietf-mna-ioam-discuss")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const p = r.spec.analysis.params as { positionsTotal: number; positionsRecorded: number; neededToPass: number; discussCount: number };
  assert.equal(p.positionsTotal, 14);
  assert.equal(p.positionsRecorded, 1);
  assert.equal(p.neededToPass, 9);
  assert.equal(p.discussCount, 0);
});

test("live refresh: es-vox — tracker seats 64 vs the 60-seat bar", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "es-vox-seats")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const p = r.spec.analysis.params as { sourceSeatEstimate: number; sourceVoteSharePct: number; thresholdSeats: number };
  assert.equal(p.sourceSeatEstimate, 64);
  assert.ok(Math.abs(p.sourceVoteSharePct - 19.1) < 0.01);
  assert.equal(p.thresholdSeats, 60);
});

test("live refresh: ch-turnout + ch-war-materiel — live Zürich return and SRG poll", async () => {
  const src = createSources(MOCK_CFG);
  const turnout = await refreshSeed(RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!, src, CTX);
  const tp = turnout.spec.analysis.params as { earlyReturnPct: number; participationIntentionPct: number; longTermAvgIntentionPct: number };
  assert.ok(Math.abs(tp.earlyReturnPct - 39.6) < 0.01);
  assert.equal(tp.participationIntentionPct, 52);
  assert.ok(Math.abs(tp.longTermAvgIntentionPct - 47.3) < 0.01);
  const km = await refreshSeed(RESEARCH_SEEDS.find((s) => s.topic === "ch-war-materiel")!, src, CTX);
  const kp = km.spec.analysis.params as { currentPollYesPct: number };
  assert.ok(Math.abs(kp.currentPollYesPct - (49 / 95) * 100) < 0.05, `pollYes=${kp.currentPollYesPct}`);
});

test("live refresh: bun — live release dates parsed from the fixtures (v1.4.5 @ 2026-11-19)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "bun-release")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const params = r.spec.analysis.params as { releases: { tag: string; date: string }[]; windowStart: string; windowEnd: string };
  assert.ok(params.releases.some((x) => x.tag === "bun-v1.4.5" && x.date === "2026-11-19"));
});

test("live refresh: node dist calculator — index.json parsed", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "node-v26-latest")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const params = r.spec.analysis.params as { releases: { tag: string; date: string }[] };
  assert.ok(params.releases.length >= 4);
});

test("mock sources fail loudly when live market data has no fixture registered", () => {
  assert.ok(SEEDS_BY_MARKET.size >= 11);
});

test("submitter guard: mode=mock config can never enable liveSubmit", async () => {
  const { resolveConfig } = await import("../config.js");
  delete process.env.DELPHI_API_ACCESS_KEY;
  delete process.env.LIVE_SUBMIT;
  const cfg = resolveConfig({ mode: "mock", liveSubmit: true });
  assert.equal(cfg.liveSubmit, false);
  assert.equal(cfg.mode, "mock");
  assert.equal(cfg.agentId, "siera-labs-evidence-miner");
});

test("submitDraft refuses without the triple guard", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  writeFileSync(join(dir, "manifest.json"), "{}");
  const { submitDraft, SubmitGuardError } = await import("../submitter.js");
  const cfg = { mode: "live", liveSubmit: false } as unknown as AgentConfig;
  await assert.rejects(() => submitDraft(cfg, dir), SubmitGuardError);
  rmSync(dir, { recursive: true, force: true });
});

test("submitDraft refuses a draft whose manifest says it was already submitted", async () => {
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  writeFileSync(
    join(dir, "manifest.json"),
    JSON.stringify({ marketAddress: "0x" + "ee".repeat(20), submittedAt: "2026-11-26T10:00:00.000Z", submissionId: "sub-1", idempotencyKey: "k", links: [], files: [], factSignature: "s", asOf: "2026-11-26T11:00:00.000Z" }),
  );
  const { submitDraft, SubmitGuardError } = await import("../submitter.js");
  const cfg = { mode: "live", liveSubmit: true } as unknown as AgentConfig;
  await assert.rejects(() => submitDraft(cfg, dir), /already submitted/);
  rmSync(dir, { recursive: true, force: true });
});

// ------------------------------------------------------------ run-3 polish

test("polish 1: ch-cpi KEY FIGURES render '+0.2% MoM' (no '+0,0,2%' template garble)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-cpi-nov")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const blob = [...r.spec.figures, ...r.spec.sourceDescriptions].join(" | ");
  assert.ok(blob.includes("+0.2% MoM"), blob);
  assert.ok(!blob.includes("+0,0"), `garbled MoM leaked into the draft text: ${blob}`);
  assert.ok(!blob.includes("+0,0,2%"), blob);
});

test("polish 2: wikipedia velocity — ONE number (154,500 over 329 days = 469.6/day) everywhere", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "wikipedia-articles")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const p = r.spec.analysis.params as { dailyNetMean: number; velocity: { days: number; net: number } };
  // 329 whole days elapsed since 2026-01-01 at MOCK_NOW; 154,500 / 329 = 469.6/day
  assert.equal(p.velocity.days, 329);
  assert.ok(Math.abs(p.dailyNetMean - 154500 / 329) < 0.05, `dailyNetMean=${p.dailyNetMean}`);
  assert.ok(Math.abs(p.dailyNetMean - 469.6) < 0.1, `dailyNetMean=${p.dailyNetMean}`);
  const figs = r.spec.figures.join(" | ");
  assert.ok(figs.includes("over the 329 days since"), figs);
  assert.ok(figs.includes("469.6/day"), figs);
  assert.ok(!figs.includes("~468"), "no stale ~468.x/day rounding may survive");
});

test("polish 3: fide figure line reads as a plain result (no table-scrape name garble)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const src = createSources(MOCK_CFG);
  const r = await refreshSeed(seed, src, CTX);
  const blob = [...r.spec.figures, ...r.spec.sourceDescriptions].join(" | ");
  assert.ok(!blob.includes("Black (White)"), `player-color artifact survived: ${blob}`);
  assert.ok(!blob.includes("Result (Black)"), `player-color artifact survived: ${blob}`);
  assert.ok(!/Sindarov Result/.test(blob), blob);
  assert.ok(/game 2 ended ½-½; match score 1-1/.test(blob), `figure must read as a plain result: ${blob}`);
  assert.ok(blob.includes("White: Gukesh Dommaraju, Black: Javokhir Sindarov"), blob);
});

test("polish 4: release_gap_cdf uses the STANDARD median (mean of the two middle gaps, not the upper one)", () => {
  const releases = [
    { tag: "v1", date: "2026-01-01" },
    { tag: "v2", date: "2026-01-15" }, // gap 14
    { tag: "v3", date: "2026-01-17" }, // gap 2
    { tag: "v4", date: "2026-01-27" }, // gap 10
    { tag: "v5", date: "2026-02-14" }, // gap 18
    { tag: "v6", date: "2026-03-06" }, // gap 20
    { tag: "v7", date: "2026-03-29" }, // gap 23
    { tag: "v8", date: "2026-04-08" }, // gap 10
    { tag: "v9", date: "2026-05-01" }, // gap 23
    { tag: "v10", date: "2026-08-08" }, // gap 99
    { tag: "v11", date: "2026-08-23" }, // gap 15
    { tag: "v12", date: "2026-08-24" }, // gap 1
    { tag: "v13", date: "2026-09-28" }, // gap 35
    { tag: "v14", date: "2026-10-10" }, // gap 12
    { tag: "v15", date: "2026-11-07" }, // gap 28
  ];
  // gaps (14, even): sorted = 1,2,10,10,12,14,15,18,20,23,23,28,35,99 -> standard median (15+18)/2 = 16.5
  const spec: ResearchSpec = {
    marketAddress: "0x" + "55".repeat(20),
    topic: "test-gap-median",
    miningPath: 2,
    langs: ["en"],
    headline: "h",
    figures: ["f1", "f2"],
    sourceDescriptions: ["s"],
    links: [],
    analysis: {
      kind: "release_gap_cdf",
      params: { releases, windowStart: "2026-11-28", windowEnd: "2026-12-11" },
    },
  };
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const res = runAnalysis(spec, join(dir, "data.csv"), "2026-11-26T12:00:00.000Z");
  const medianLine = res.methodLines.find((l) => l.includes("median"))!;
  assert.ok(medianLine.includes("16.5 days"), `standard median of the 14 gaps is 16.5: ${medianLine}`);
  assert.ok(!medianLine.includes("18 days"), `upper-median artifact survived: ${medianLine}`);
  rmSync(dir, { recursive: true, force: true });
});

test("polish 5: mock SourceDocs carry the fixture's recorded fetchedAt, never the mock clock", async () => {
  const sources = createSources(MOCK_CFG);
  const url = Object.keys(LIVE_FIXTURES)[0]!;
  const doc = await sources.fetch(url);
  assert.equal(doc.fetchedAt, FIXTURE_FETCHED_AT[url]);
  assert.notEqual(doc.fetchedAt, "2026-11-26T12:00:00.000Z");
  assert.ok(/^\d{4}-11-26T0\d:\d\d:\d\d\.\d{3}Z$/.test(doc.fetchedAt));
  // every registered fixture has a recorded fetch time (no fixture may fall back to the clock)
  assert.deepEqual(
    [...new Set([...Object.keys(LIVE_FIXTURES), ...Object.keys(FIXTURE_FETCHED_AT)])].sort(),
    Object.keys(LIVE_FIXTURES).sort(),
  );
});

test("polish 7: an immediately-rejected submission is written back at once — no 30-minute poll, stance lock released", async () => {
  const { submitDraft } = await import("../submitter.js");
  type SdkModule = typeof import("@gensyn-ai/gensyn-delphi-sdk");
  const dir = mkdtempSync(join(tmpdir(), "aa-"));
  const cwd = process.cwd();
  process.chdir(dir); // evidence-log.jsonl / submit-attempts.jsonl writes stay in the sandbox
  try {
    const addr = "0x" + "ee".repeat(20);
    const sig = "sig-live-rejected";
    writeFileSync(
      join(dir, "evidence-log.jsonl"),
      JSON.stringify({
        ts: "2026-11-26T04:00:00.000Z",
        marketAddress: addr,
        topic: "t",
        stance: "yes",
        factSignature: sig,
        status: "drafted",
        draftPath: "drafts/t",
        submissionId: null,
        mode: "live",
        note: "n",
      }) + "\n",
    );
    const draftDir = join(dir, "draft");
    mkdirSync(draftDir, { recursive: true });
    writeFileSync(join(draftDir, "note.md"), "a short note with figures 1 2 3", "utf-8");
    writeFileSync(join(draftDir, "data.csv"), "row_type,item,value_1,value_2\n", "utf-8");
    writeFileSync(
      join(draftDir, "manifest.json"),
      JSON.stringify({
        topic: "t",
        marketAddress: addr,
        marketQuestion: "q",
        generatedAt: new Date().toISOString(),
        mode: "live",
        asOf: new Date().toISOString(), // < 2h old at submit time
        stance: "yes",
        links: ["https://example.com/a"],
        files: ["data.csv"],
        factSignature: sig,
        idempotencyKey: "key-1",
        submittedAt: null,
        submissionId: null,
      }),
      "utf-8",
    );
    const calls: string[] = [];
    const fakeClient = {
      getTerms: async () => ({ data: { acceptedAt: "2026-11-01T00:00:00.000Z", url: "t" } }),
      getLimits: async () => ({ data: { submitsLeftThisHour: 10, hourEndsAt: "2026-11-26T13:00:00.000Z" } }),
      getEntryState: async () => ({ data: { canSubmit: true, remainingOnMarket: 3, judgementPotRemainingBaseUnits: "20000000" } }),
      submitEvidence: async () => {
        calls.push("submitEvidence");
        return {
          data: {
            id: "sub-rej-1",
            createdAt: "2026-11-26T12:00:00.000Z",
            agentId: null,
            note: null,
            links: [],
            files: [],
            status: "rejected",
            code: "spam",
            canRetry: false,
            markets: [
              { marketAddress: addr, status: "rejected", verdict: null, reason: "spam", bounty: null, settlementUpTo: null },
            ],
          },
        };
      },
      waitForSubmission: async () => {
        calls.push("waitForSubmission");
        throw new Error("waitForSubmission must NOT be called for an immediately-rejected submission");
      },
    } as unknown as InstanceType<SdkModule["EvidenceClient"]>;
    const cfg = { mode: "live", liveSubmit: true } as unknown as AgentConfig;
    const out = await submitDraft(cfg, draftDir, { createClient: async () => fakeClient });
    assert.deepEqual(calls, ["submitEvidence"]);
    assert.equal(out.submissionId, "sub-rej-1");
    assert.equal(out.status, "rejected");
    assert.equal(out.outcome.reason, "spam");
    // ledger: the entry is "rejected" — a rejected entry releases the stance lock
    const { EvidenceLog } = await import("../evidence-log.js");
    const ledger = new EvidenceLog(join(dir, "evidence-log.jsonl"), "live");
    const entry = ledger.forMarket(addr).find((e) => e.factSignature === sig)!;
    assert.equal(entry.status, "rejected");
    assert.equal(entry.submissionId, "sub-rej-1");
    assert.equal(ledger.lockedStance(addr), null, "rejected entries must not lock a stance");
    const manifest = JSON.parse(readFileSync(join(draftDir, "manifest.json"), "utf-8")) as { submittedAt: string | null; submissionId: string | null };
    assert.ok(manifest.submittedAt && manifest.submissionId === "sub-rej-1");
  } finally {
    process.chdir(cwd);
    rmSync(dir, { recursive: true, force: true });
  }
});
