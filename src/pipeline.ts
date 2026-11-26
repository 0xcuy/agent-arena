import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AgentConfig } from "./config.js";
import { createDelphiApi } from "./delphi/client.js";
import { createFirecrawl } from "./firecrawl/client.js";
import { checkEligibility, rankMarkets } from "./filter.js";
import { EvidenceLog } from "./evidence-log.js";
import { gateCandidate } from "./gate.js";
import { SPECS_BY_MARKET } from "./miners/specs.js";
import { assembleCandidate, preSignature, runAnalysis, verifySources } from "./miners/mine.js";
import { writeDraft } from "./draft.js";
import { writeFeedbackDrafts } from "./feedback.js";
import { MOCK_NOW } from "./delphi/fixtures.js";
import type { CompetitionMarket, EvidenceLimits, EvidenceTerms, RunReport } from "./types.js";

const COMPETITION_END = new Date("2026-12-11T17:00:00.000Z");
const EVIDENCE_LOG_PATH = "evidence-log.jsonl";
const STAGING_DIR = "staging";

export interface RunOptions {
  /** Cap on drafts per run — stay far below the hourly/daily API caps. */
  maxDrafts: number;
}

export async function runPipeline(cfg: AgentConfig, opts: RunOptions): Promise<RunReport> {
  const api = await createDelphiApi(cfg);
  const firecrawl = createFirecrawl(cfg);
  const log = new EvidenceLog(EVIDENCE_LOG_PATH);

  // 1. Limits: do we have submissions left this hour at all?
  const limits: EvidenceLimits = await api.getLimits();
  if (limits.submitsLeftThisHour <= 0) {
    throw new Error(`no submissions left this hour (resets ${limits.hourEndsAt}); nothing to prepare`);
  }

  // 2. Terms: in live mode the account must have accepted them before researching.
  const terms: EvidenceTerms = await api.getTerms();
  if (cfg.mode === "live" && !terms.acceptedAt) {
    throw new Error(
      `terms not accepted (${terms.url}). Review, then POST /v1/terms/acceptance {"termsVersion": ${JSON.stringify(terms.version)}}.`,
    );
  }

  // 3. Markets + entry states, then filter and rank.
  const markets = await api.listCompetitionMarkets();
  const now = cfg.mode === "mock" ? new Date(MOCK_NOW) : new Date();
  const pathByAddress = new Map(
    [...SPECS_BY_MARKET.values()].map((s) => [s.marketAddress, s.miningPath] as const),
  );
  const skips: { address: string; question: string; reason: string }[] = [];
  const eligible: ReturnType<typeof checkEligibility>[] = [];
  for (const m of markets) {
    const entry = await api.getEntryState(m.address);
    const el = checkEligibility(m, entry, now, COMPETITION_END);
    if (el.eligible) eligible.push(el);
    else skips.push({ address: m.address, question: m.question, reason: el.reasons.join("; ") });
  }
  const ranked = rankMarkets(eligible, pathByAddress);

  // Report every eligible market that has no research spec yet (extension point).
  const noSpecMarkets = ranked
    .filter((r) => !SPECS_BY_MARKET.has(r.market.address))
    .map((r) => ({
      address: r.market.address,
      question: r.market.question,
      cutoff: r.market.evidenceCutoffAt,
    }));

  const report: RunReport = {
    runTs: new Date().toISOString(),
    mode: cfg.mode,
    marketsSeen: markets.length,
    marketsEligible: ranked.length,
    marketsConsidered: ranked.map((r) => r.market),
    marketSkips: skips,
    candidatesMined: 0,
    draftsWritten: [],
    duplicatesSkipped: [],
    gateRejects: [],
    draftsSkippedNoSpec: noSpecMarkets,
    feedbackDrafts: [],
  };

  const runDate = (cfg.mode === "mock" ? MOCK_NOW : new Date().toISOString()).slice(0, 10);
  const asOf = cfg.mode === "mock" ? MOCK_NOW : new Date().toISOString();

  for (const { market, entry } of ranked) {
    if (report.draftsWritten.length >= opts.maxDrafts) break;
    const spec = SPECS_BY_MARKET.get(market.address);
    if (!spec) {
      report.draftsSkippedNoSpec.push({
        address: market.address,
        question: market.question,
        cutoff: market.evidenceCutoffAt,
      });
      continue;
    }

    // Dedupe before any expensive work — repeats earn nothing.
    if (log.hasSignature(preSignature(spec))) {
      report.duplicatesSkipped.push(spec.topic);
      continue;
    }
    // Per-market cap: 3 submissions (1 if restricted) — enforce locally.
    const cap = entry.restricted ? 1 : 3;
    const used = log.draftedCount(market.address);
    if (used >= cap) {
      report.marketSkips.push({
        address: market.address,
        question: market.question,
        reason: `local log already drafted ${used}/${cap} for this market`,
      });
      continue;
    }

    // Anti-`unverifiable`: scraped sources must still contain the pasted figures.
    const verify = await verifySources(spec, firecrawl);
    if (!verify.ok) {
      report.gateRejects.push({
        topic: spec.topic,
        reasons: verify.failures.map((f) => `unverifiable at ${f.url}: missing ${f.missing.join(", ")}`),
      });
      continue;
    }

    report.candidatesMined += 1;

    // 5. Analysis via the local Python math/CSV generator.
    mkdirSync(STAGING_DIR, { recursive: true });
    const csvPath = join(STAGING_DIR, `${spec.topic}-data.csv`);
    const analysis = runAnalysis(spec, csvPath, asOf);
    const candidate = assembleCandidate(spec, market, analysis, asOf);

    // 6. Strict pre-submit gate.
    const online = await api.listSubmissions({ market: market.address });
    const verdict = gateCandidate(candidate, { market, entry, log, onlineSubmissionCount: online.length });
    if (!verdict.pass) {
      report.gateRejects.push({ topic: spec.topic, reasons: verdict.reasons });
      continue;
    }

    // 7. Draft: note + CSV + manifest under drafts/<date>-<topic>/.
    const draft = writeDraft(candidate, market, cfg.mode, runDate);
    writeFileSync(draft.csv, readFileSync(csvPath, "utf-8"), "utf-8");
    report.draftsWritten.push(draft.dir);

    // 8. Ledger: stance lock + dedupe apply from now on.
    log.append({
      ts: new Date().toISOString(),
      marketAddress: market.address,
      topic: spec.topic,
      stance: candidate.stance,
      factSignature: candidate.factSignature,
      status: "drafted",
      draftPath: draft.dir,
      submissionId: null,
      note: spec.headline.slice(0, 200),
    });
  }

  // 9. Feedback drafts ($250 bounty pool): record friction observed this run.
  report.feedbackDrafts = writeFeedbackDrafts(report, process.env.DELPHI_WALLET);

  rmSync(STAGING_DIR, { recursive: true, force: true });
  writeFileSync(join("drafts", "index.json"), JSON.stringify(report, null, 2), "utf-8");
  return report;
}

/** Plan only: eligibility + ranking table, no mining, no writes. */
export async function planPipeline(cfg: AgentConfig): Promise<RunReport> {
  const api = await createDelphiApi(cfg);
  const markets = await api.listCompetitionMarkets();
  const now = cfg.mode === "mock" ? new Date(MOCK_NOW) : new Date();
  const pathByAddress = new Map(
    [...SPECS_BY_MARKET.values()].map((s) => [s.marketAddress, s.miningPath] as const),
  );
  const skips: { address: string; question: string; reason: string }[] = [];
  const eligible: ReturnType<typeof checkEligibility>[] = [];
  for (const m of markets) {
    const entry = await api.getEntryState(m.address);
    const el = checkEligibility(m, entry, now, COMPETITION_END);
    if (el.eligible) eligible.push(el);
    else skips.push({ address: m.address, question: m.question, reason: el.reasons.join("; ") });
  }
  const ranked = rankMarkets(eligible, pathByAddress);
  return {
    runTs: new Date().toISOString(),
    mode: cfg.mode,
    marketsSeen: markets.length,
    marketsEligible: ranked.length,
    marketsConsidered: ranked.map((r) => r.market),
    marketSkips: skips,
    candidatesMined: 0,
    draftsWritten: [],
    duplicatesSkipped: [],
    gateRejects: [],
    draftsSkippedNoSpec: ranked
      .filter((r) => !SPECS_BY_MARKET.has(r.market.address))
      .map((r) => ({
        address: r.market.address,
        question: r.market.question,
        cutoff: r.market.evidenceCutoffAt,
      })),
    feedbackDrafts: [],
  };
}
