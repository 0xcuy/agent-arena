import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { RunReport } from "./types.js";

/**
 * Feedback drafter for the 5x $250 feedback-bounty pool
 * (https://feedback.delphi.fyi). Drafts only in this build: each file holds the
 * exact JSON body + curl command, ready to POST with the API key and wallet
 * once Sekar approves. Never posts automatically.
 */

export interface FeedbackDraft {
  area: "api" | "keys" | "markets" | "judging" | "rewards" | "docs" | "site" | "other";
  title: string;
  text: string;
  marketId?: string;
}

export function feedbackSources(report: RunReport): FeedbackDraft[] {
  const drafts: FeedbackDraft[] = [];

  if (report.marketSkips.some((s) => s.reason.includes("judgment pot empty"))) {
    drafts.push({
      area: "markets",
      title: "markets.json judgment pot in base units is easy to misread",
      text:
        "competition.delphi.fyi/markets.json reports pots as raw 6-decimal base-unit strings " +
        "(\"20000000\" = $20), while /v1 entry-state returns judgementPotRemainingBaseUnits in the same " +
        "units. The markets page shows human-readable dollars. Two different encodings for the same pot " +
        "make it easy to misjudge remaining bounty before researching a market. Could the markets.json " +
        "add a display field (e.g. judgementPotUsdc)?",
    });
  }
  if (report.marketSkips.some((s) => s.reason.includes("canSubmit=false"))) {
    drafts.push({
      area: "markets",
      title: "Entry state gives no market-level hint in markets.json",
      text:
        "Markets visible in markets.json with cutoffs in the future can already be at their " +
        "per-account 3/3 cap (entry-state then reports canSubmit=false with market_submission_cap). " +
        "Agents must call entry-state for every market before shortlisting. A projected " +
        "remainingOnMarket or a visible submission-count field in markets.json would save one " +
        "API call per market per run.",
    });
  }
  drafts.push({
    area: "api",
    title: "Idempotency-Key reuse semantics after a rejected submission",
    text:
      "The guide says submissions cannot be edited or retracted, and the SDK auto-generates an " +
      "Idempotency-Key. It is unclear whether reusing the same key after a `rejected` verdict " +
      "(as opposed to a transport error) is safe, or whether it counts as a new submission against " +
      "the per-market cap. A sentence in /v1/submissions docs would help agents avoid burning a slot.",
  });
  return drafts;
}

export function writeFeedbackDrafts(report: RunReport, wallet: string | undefined): string[] {
  const dir = join("drafts", "feedback");
  mkdirSync(dir, { recursive: true });
  const written: string[] = [];
  feedbackSources(report).forEach((f, i) => {
    const slug = f.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    const path = join(dir, `${String(i + 1).padStart(2, "0")}-${slug}.md`);
    const body = {
      wallet: wallet ?? "0x<set DELPHI_WALLET to the address your API key was issued to>",
      area: f.area,
      title: f.title,
      text: f.text,
      topic: "agent-competition-evidence-mining",
      ...(f.marketId ? { marketId: f.marketId } : {}),
    };
    writeFileSync(
      path,
      [
        `# Feedback draft: ${f.title}`,
        "",
        "Draft only — review before sending. POST with the same key your API key was issued with.",
        "",
        "```bash",
        `curl -X POST https://feedback.delphi.fyi/v1/feedback \\`,
        `  -H "x-api-key: $DELPHI_API_ACCESS_KEY" \\`,
        `  -H "Content-Type: application/json" \\`,
        `  -H "X-Agent-Id: agent-arena" \\`,
        `  -d '${JSON.stringify(body)}'`,
        "```",
        "",
        "Request body:",
        "",
        "```json",
        JSON.stringify(body, null, 2),
        "```",
        "",
      ].join("\n"),
      "utf-8",
    );
    written.push(path);
  });
  return written;
}
