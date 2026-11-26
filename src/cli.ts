import { resolveConfig } from "./config.js";
import { planPipeline, runPipeline } from "./pipeline.js";
import { SPECS_BY_MARKET } from "./miners/specs.js";

/**
 * CLI.
 *   npm run mock                 mock end-to-end run -> drafts under drafts/
 *   npm run live                 live run (needs DELPHI_API_ACCESS_KEY), drafts only
 *   npm run live -- --live-submit  live run; also POSTs drafts (further requires LIVE_SUBMIT=1)
 *   npm run plan                 no writes: eligibility + ranking table
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
    console.log(`  gate rejects:        ${report.gateRejects.length}`);
    for (const r of report.gateRejects) console.log(`     - ${r.topic}: ${r.reasons.join(" | ")}`);
    console.log(`  drafts written:      ${report.draftsWritten.length}`);
    for (const d of report.draftsWritten) console.log(`     - ${d}`);
    console.log(`  feedback drafts:     ${report.feedbackDrafts.length}`);
    if (cfg.liveSubmit) {
      console.log(
        "  NOTE: --live-submit was passed, but this build never POSTs drafts; " +
          "drafts sit under drafts/ with idempotency keys reserved in manifest.json.",
      );
    }
  } else if (cmd === "plan") {
    const report = await planPipeline(cfg);
    console.log(`plan (mode=${report.mode}, ${report.runTs})`);
    console.log(`markets seen: ${report.marketsSeen}, eligible: ${report.marketsEligible}`);
    for (const m of report.marketsConsidered) {
      const hasSpec = SPECS_BY_MARKET.has(m.address);
      console.log(
        `  eligible  cutoff=${m.evidenceCutoffAt} p(yes)=${m.odds.yes.toFixed(3)} spec=${hasSpec ? "yes" : "no "}  ${m.question.slice(0, 62)}`,
      );
    }
    for (const s of report.marketSkips) {
      console.log(`  skip      ${s.question.slice(0, 50)} :: ${s.reason}`);
    }
    console.log(`eligible without a research spec: ${report.draftsSkippedNoSpec.length}`);
  } else {
    console.error("usage: cli.ts run|plan [--mode=mock|live] [--live-submit] [--max-drafts=N]");
    process.exit(2);
  }
}

void main();
