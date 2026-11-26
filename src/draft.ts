import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { CompetitionMarket, DraftManifest, EvidenceCandidate } from "./types.js";

/**
 * Draft writer. One directory per submission under drafts/:
 *   note.md      — the exact dated note text that would be submitted
 *   data.csv     — compact machine-readable series backing the note (written by mathgen;
 *                  includes one "source" row per fetched URL with its UTC fetchedAt)
 *   manifest.json — links, files, stance, idempotency key, submission state
 *
 * The note is judge-proof by construction: key figures are pasted at the TOP (the
 * judge fetches basic HTTP once and truncates long pages), every figure appears
 * inline so nothing depends on JS or bot-walled pages, and the CSV repeats the
 * series with each source URL + UTC fetch timestamp.
 */

export interface DraftPaths {
  dir: string;
  note: string;
  csv: string;
  manifest: string;
}

export function draftDirFor(runDate: string, topic: string): DraftPaths {
  const dir = join("drafts", `${runDate}-${topic}`);
  return {
    dir,
    note: join(dir, "note.md"),
    csv: join(dir, "data.csv"),
    manifest: join(dir, "manifest.json"),
  };
}

export function composeNote(c: EvidenceCandidate, market: CompetitionMarket, assumptions: string[] = []): string {
  const pct = (p: number) => (p < 0.001 ? `<0.1%` : `${(p * 100).toFixed(1)}%`);
  const impliedPct = pct(c.analysis.evidenceImpliedYes);
  const marketPct = `${(c.marketImpliedYes * 100).toFixed(1)}%`;
  const push = c.stance === "yes" ? "up" : "down";
  const lines: string[] = [];
  lines.push(`Evidence note — ${c.asOf.slice(0, 10)} (all times UTC)`);
  lines.push("");
  lines.push(`Market: ${market.question}`);
  lines.push(`Market address: ${market.address} — evidence cutoff ${market.evidenceCutoffAt}`);
  lines.push("");
  // Key figures at the top: the judge fetches each link once and truncates long pages.
  lines.push("KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):");
  for (const f of c.figures) lines.push(`- ${f}`);
  lines.push("");
  lines.push("1) DATED FACT");
  lines.push(c.headline);
  lines.push("");
  lines.push("2) SOURCES");
  c.links.forEach((l, i) => {
    lines.push(
      `- [${i + 1}] ${l.url} — ${c.sourceDescriptions[i] ?? l.label} (${l.lang}, ${l.access}); fetched ${c.asOf}`,
    );
  });
  lines.push(
    "- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.",
  );
  lines.push("");
  lines.push("3) METHOD");
  for (const m of c.analysis.methodLines) lines.push(`- ${m}`);
  if (assumptions.length > 0) {
    lines.push("");
    lines.push("3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):");
    for (const a of assumptions) lines.push(`- ${a}`);
  }
  lines.push("");
  lines.push("4) FORECAST COMPARISON");
  lines.push(`- Market implied P(yes) at snapshot: ${marketPct}`);
  lines.push(
    `- This evidence implies P(yes) ≈ ${impliedPct} (confidence: ${c.analysis.confidence}) — it pushes the ${c.stance.toUpperCase()} side ${push}.`,
  );
  lines.push(
    `- Stance: ${c.stance.toUpperCase()} side only. No evidence is submitted for the opposite side of this market.`,
  );
  return lines.join("\n") + "\n";
}

export function writeDraft(
  c: EvidenceCandidate,
  market: CompetitionMarket,
  mode: "mock" | "live",
  runDate: string,
  assumptions: string[] = [],
): DraftPaths {
  const paths = draftDirFor(runDate, c.topic);
  mkdirSync(paths.dir, { recursive: true });
  const manifest: DraftManifest = {
    topic: c.topic,
    marketAddress: c.marketAddress,
    marketQuestion: c.marketQuestion,
    generatedAt: new Date().toISOString(),
    mode,
    asOf: c.asOf,
    stance: c.stance,
    links: c.links.map((l) => l.url),
    files: ["data.csv"],
    factSignature: c.factSignature,
    idempotencyKey: randomUUID(),
    submittedAt: null,
    submissionId: null,
  };
  writeFileSync(paths.note, composeNote(c, market, assumptions), "utf-8");
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2), "utf-8");
  return paths;
}
