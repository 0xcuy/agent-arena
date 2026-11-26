import { resolveConfig } from "./config.js";
import { planPipeline, runPipeline } from "./pipeline.js";
import { SEEDS_BY_MARKET } from "./miners/live/refreshers.js";
import { createDelphiApi } from "./delphi/client.js";

/**
 * CLI.
 *   npm run mock                    mock end-to-end run -> drafts under drafts/
 *   npm run live                    live run (needs DELPHI_API_ACCESS_KEY), drafts only
 *   npm run plan [-- --mode=live]   no writes: eligibility + ranking table
 *                                   (live-mode `npm run plan` is the SDK smoke test: it
 *                                   reads limits/terms/markets/entry-state and writes NOTHING)
 *   npm run accept-terms            explicit one-time terms acceptance (live, never automatic)
 *
 * There is no --live-submit path in this build: submitting stays triple-guarded
 * (mode=live AND LIVE_SUBMIT=1 AND --live-submit) and no code path passes
 * --live-submit. See README.
 */

interface Args {
  mode?: "mock" | "live";
  liveSubmit: boolean;
  maxDrafts: number;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { liveSubmit: false, maxDrafts: 10 };
  for (const a of argv) {
    if (a === "--mode=mock") args.mode = "mock";
    else if (a === "--mode=live") args.mode = "live";
    else if (a === "--live-submit") args.liveSubmit = true;
    else if (a.startsWith("--max-drafts=")) args.maxDrafts = Number(a.slice("--max-drafts=".length));
    else {
      console.error(`unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return args;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);
  let cfg;
  try {
    cfg = resolveConfig(args);
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }

  if (cmd === "run") {
    const report = await runPipeline(cfg, { maxDrafts: args.maxDrafts });
    console.log(`run complete (mode=${report.mode})`);
    console.log(`  markets seen:        ${report.marketsSeen}`);
    console.log(`  eligible:            ${report.marketsEligible}`);
    console.log(`  skipped by filter:   ${report.marketSkips.length}`);
    console.log(`  candidates mined:    ${report.candidatesMined}`);
    console.log(`  live mining failures:${report.miningFailures.length}`);
    for (const f of report.miningFailures) console.log(`     - ${f.topic}: ${f.reason}`);
    console.log(`  gate rejects:        ${report.gateRejects.length}`);
    for (const r of report.gateRejects) console.log(`     - ${r.topic}: ${r.reasons.join(" | ")}`);
    console.log(`  drafts written:      ${report.draftsWritten.length}`);
    for (const d of report.draftsWritten) console.log(`     - ${d}`);
    console.log(`  feedback drafts:     ${report.feedbackDrafts.length}`);
    console.log("  NOTE: this build never posts drafts; they sit under drafts/ with idempotency keys reserved in manifest.json.");
  } else if (cmd === "plan") {
    const report = await planPipeline(cfg);
    console.log(`plan (mode=${report.mode}, ${report.runTs}) — no writes made`);
    console.log(`markets seen: ${report.marketsSeen}, eligible: ${report.marketsEligible}`);
    for (const m of report.marketsConsidered) {
      const hasSpec = SEEDS_BY_MARKET.has(m.address);
      console.log(
        `  eligible  cutoff=${m.evidenceCutoffAt} p(yes)=${m.odds.yes.toFixed(3)} spec=${hasSpec ? "yes" : "no "}  ${m.question.slice(0, 62)}`,
      );
    }
    for (const s of report.marketSkips) {
      console.log(`  skip      ${s.question.slice(0, 50)} :: ${s.reason}`);
    }
    console.log(`eligible without a research template: ${report.draftsSkippedNoSpec.length}`);
  } else if (cmd === "accept-terms") {
    if (cfg.mode !== "live") {
      console.error("accept-terms is a live-only action (needs DELPHI_API_ACCESS_KEY).");
      process.exit(1);
    }
    // Explicit human-in-the-loop step: the agent never accepts terms inside a run.
    const api = await createDelphiApi(cfg);
    const terms = await api.getTerms();
    if (terms.acceptedAt) {
      console.log(`terms ${terms.version} already accepted at ${terms.acceptedAt}. Nothing to do.`);
      return;
    }
    console.log(`You are about to accept the Delphi terms (version: ${terms.version}).`);
    console.log(`Read them first: ${terms.url}`);
    console.log("This is YOUR acceptance for the account; type the version number to confirm:");
    const { createInterface } = await import("node:readline/promises");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const answer = (await rl.question(`type "${terms.version}" to accept: `)).trim();
    rl.close();
    if (answer !== terms.version) {
      console.error("confirmation mismatch — NOT accepted.");
      process.exit(1);
    }
    const accepted = await api.acceptTerms(terms.version);
    console.log(`terms ${accepted.version} accepted at ${accepted.acceptedAt}.`);
  } else {
    console.error("usage: cli.ts run|plan|accept-terms [--mode=mock|live] [--max-drafts=N]");
    console.error("       (accept-terms: live only; the pipeline never accepts terms for you)");
    process.exit(2);
  }
}

void main();
