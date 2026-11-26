import { mkdirSync, readFileSync, rmSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AgentConfig } from "./config.js";
import { createDelphiApi } from "./delphi/client.js";
import { createSources } from "./miners/live/sources.js";
import { SEEDS_BY_MARKET, refreshSeed, LiveMiningError } from "./miners/live/refreshers.js";
import { checkEligibility, rankMarkets } from "./filter.js";
import { EvidenceLog } from "./evidence-log.js";
import { gateCandidate } from "./gate.js";
import { assembleCandidate, preSignature, runAnalysis, stagingCsvPath, verifySources } from "./miners/mine.js";
import { composeNote, writeDraft } from "./draft.js";
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
  const sourceApi = createSources(cfg);
  const log = new EvidenceLog(EVIDENCE_LOG_PATH, cfg.mode);

  // 1. Limits: do we have submissions left this hour at all?
  const limits: EvidenceLimits = await api.getLimits();
  if (limits.submitsLeftThisHour <= 0) {
    throw new Error(`no submissions left this hour (resets ${limits.hourEndsAt}); nothing to prepare`);
  }

  // 2. Terms: in live mode the account must have accepted them before researching.
  const terms: EvidenceTerms = await api.getTerms();
  if (cfg.mode === "live" && !terms.acceptedAt) {
    throw new Error(
      `terms not accepted (${terms.url}). Review them, then run \`npm run accept-terms\` (never automatic inside a run).`,
    );
  }

  // 3. Markets + entry states, then filter and rank.
  const markets = await api.listCompetitionMarkets();
  const now = cfg.mode === "mock" ? new Date(MOCK_NOW) : new Date();
  const pathByAddress = new Map([...SEEDS_BY_MARKET.values()].map((s) => [s.marketAddress, s.miningPath] as const));
  const skips: { address: string; question: string; reason: string }[] = [];
  const eligible: ReturnType<typeof checkEligibility>[] = [];
  for (const m of markets) {
    const entry = await api.getEntryState(m.address);
    const el = checkEligibility(m, entry, now, COMPETITION_END);
    if (el.eligible) eligible.push(el);
    else skips.push({ address: m.address, question: m.question, reason: el.reasons.join("; ") });
  }
  const ranked = rankMarkets(eligible, pathByAddress);

  // Report every eligible market that has no research template yet (computed once; the loop must not re-add).
  const noSpecMarkets = ranked
    .filter((r) => !SEEDS_BY_MARKET.has(r.market.address))
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
    miningFailures: [],
    draftsSkippedNoSpec: noSpecMarkets,
    feedbackDrafts: [],
  };

  const runDate = (cfg.mode === "mock" ? MOCK_NOW : new Date().toISOString()).slice(0, 10);
  const asOf = now.toISOString();
  // In-flight draft claims written by THIS run, PER MARKET: only these may be
  // subtracted from remainingOnMarket, and only when batching several drafts
  // for the same market (fix 6). One draft per market keeps every entry at 0.
  const inFlightByMarket = new Map<string, number>();

  for (const { market, entry } of ranked) {
    if (report.draftsWritten.length >= opts.maxDrafts) break;
    const seed = SEEDS_BY_MARKET.get(market.address);
    if (!seed) continue; // already listed in draftsSkippedNoSpec (assigned once above)

    // 4. Online-submissions check BEFORE mining (a market already at the account
    //    cap must not cost sources, analysis or API budget).
    let onlineCount = 0;
    try {
      onlineCount = (await api.listSubmissions({ market: market.address })).length;
    } catch (err) {
      report.gateRejects.push({ topic: seed.topic, reasons: [`online submissions check failed: ${(err as Error).message}`] });
      continue;
    }
    const cap = entry.restricted ? 1 : 3;
    if (onlineCount >= cap) {
      report.marketSkips.push({
        address: market.address,
        question: market.question,
        reason: `online submissions already at account cap (${onlineCount}/${cap}) before mining`,
      });
      continue;
    }

    // 5. Per-market cap on the local ledger (mode-tagged: mock entries never count here in live mode).
    const used = log.draftedCount(market.address);
    if (used >= cap) {
      report.marketSkips.push({
        address: market.address,
        question: market.question,
        reason: `local log already drafted ${used}/${cap} for this market (mode=${cfg.mode})`,
      });
      continue;
    }

    // 6. LIVE MINE: refresh the spec from HTTP-200 fetches made in THIS run.
    //    Frozen numbers are never used; a mining failure skips the market.
    let refreshed;
    try {
      refreshed = await refreshSeed(seed, sourceApi, { now, live: cfg.mode === "live" });
    } catch (err) {
      report.miningFailures.push({
        topic: seed.topic,
        reason: err instanceof LiveMiningError ? err.message : `live mining failed: ${(err as Error).message}`,
      });
      continue;
    }
    const spec = refreshed.spec;

    // 7. Dedupe before any expensive work — repeats earn nothing.
    if (log.hasSignature(preSignature(spec))) {
      report.duplicatesSkipped.push(spec.topic);
      continue;
    }
    const locked = log.lockedStance(market.address);

    // 8. Anti-`unverifiable`: EVERY link (scraped, static-html, api-json) must still
    //    contain what the note pastes, and every figure must appear in the content.
    //    The docs already fetched by the refresher (this same run) are reused rather
    //    than re-fetched, so all model inputs are cross-checked, not just the shipped link.
    const verify = await verifySources(spec, sourceApi, spec.figures, {
      live: cfg.mode === "live",
      now,
      docs: new Map(refreshed.docs.map((d) => [d.url, d])),
    });
    if (!verify.ok) {
      report.gateRejects.push({
        topic: spec.topic,
        reasons: verify.failures.map((f) => `unverifiable at ${f.url}: ${f.missing.join(", ")}`),
      });
      continue;
    }
    if (locked !== null) {
      // Cheap lookahead: stance-lock contradiction is visible pre-analysis; skip.
      report.gateRejects.push({
        topic: spec.topic,
        reasons: [`stance lock: market already covered with ${locked.toUpperCase()} stance`],
      });
      continue;
    }

    report.candidatesMined += 1;

    // 9. Analysis via the local Python math/CSV generator (models: assumptions stated in the note).
    mkdirSync(STAGING_DIR, { recursive: true });
    const csvPath = stagingCsvPath(spec.topic);
    const sourceMeta = refreshed.docs.map((d) => ({ url: d.url, fetchedAt: d.fetchedAt }));
    const analysis = runAnalysis(spec, csvPath, asOf, sourceMeta);
    const candidate = assembleCandidate(spec, market, analysis, asOf);
    // Per-link fetch times (mock mode: the fixtures' recorded fetch times, not the
    // mock run clock) so the note's SOURCES lines match the CSV source rows.
    const linkFetchedAt = candidate.links.map((l) => verify.docs.get(l.url)?.fetchedAt ?? asOf);

    // 10. Strict pre-submit gate on the exact note + attachment that would ship.
    const note = composeNote(candidate, market, refreshed.assumptions, linkFetchedAt);
    let csvBytes = 0;
    try {
      csvBytes = statSync(csvPath).size;
    } catch {
      csvBytes = 0;
    }
    const fetchTimes = [...verify.docs.values()].map((d) => d.fetchedAt);
    const verdict = gateCandidate(candidate, {
      market,
      entry,
      log,
      note,
      fileSizes: [csvBytes],
      sourceFetchTimes: fetchTimes,
      now,
      inFlightClaims: inFlightByMarket.get(market.address) ?? 0,
    });
    if (!verdict.pass) {
      report.gateRejects.push({ topic: spec.topic, reasons: verdict.reasons });
      continue;
    }

    // 11. Draft: note + CSV + manifest under drafts/<date>-<topic>/.
    const draft = writeDraft(candidate, market, cfg.mode, runDate, refreshed.assumptions, linkFetchedAt);
    writeFileSync(draft.csv, readFileSync(csvPath, "utf-8"), "utf-8");
    report.draftsWritten.push(draft.dir);
    inFlightByMarket.set(market.address, (inFlightByMarket.get(market.address) ?? 0) + 1);

    // 12. Ledger (mode-tagged): stance lock + dedupe apply from now on.
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

  // 13. Feedback drafts ($250 bounty pool): record friction observed this run.
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
  const pathByAddress = new Map([...SEEDS_BY_MARKET.values()].map((s) => [s.marketAddress, s.miningPath] as const));
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
    miningFailures: [],
    draftsSkippedNoSpec: ranked
      .filter((r) => !SEEDS_BY_MARKET.has(r.market.address))
      .map((r) => ({
        address: r.market.address,
        question: r.market.question,
        cutoff: r.market.evidenceCutoffAt,
      })),
    feedbackDrafts: [],
  };
}
