import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { CompetitionMarket, DraftManifest, EvidenceCandidate } from "./types.js";

/**
 * Draft writer. One directory per submission under drafts/:
 *   note.md      — the exact 4-part dated note text that would be submitted
 *   data.csv     — compact machine-readable series backing section 3 (written by mathgen)
 *   manifest.json — links, files, stance, idempotency key, submission state
 * The note is a 4-part dated note per the competition guide: dated fact,
 * sources, method, forecast comparison. All key figures are pasted inline so
 * the judge never needs JS rendering (anti-`unverifiable`).
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

export function composeNote(c: EvidenceCandidate, market: CompetitionMarket): string {
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
  lines.push("1) DATED FACT");
  lines.push(c.headline);
  lines.push("");
  lines.push("Key figures, copied from the source content at fetch time (also in data.csv):");
  for (const f of c.figures) lines.push(`- ${f}`);
  lines.push("");
  lines.push("2) SOURCES");
  c.links.forEach((l, i) => {
    lines.push(`- [${i + 1}] ${l.url} — ${c.sourceDescriptions[i] ?? l.label} (${l.lang}, ${l.access})`);
  });
  lines.push(
    "- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.",
  );
  lines.push("");
  lines.push("3) METHOD");
  for (const m of c.analysis.methodLines) lines.push(`- ${m}`);
  lines.push("");
  lines.push("4) FORECAST COMPARISON");
  lines.push(`- Market implied P(yes) at snapshot: ${marketPct}%`);
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
  writeFileSync(paths.note, composeNote(c, market), "utf-8");
  writeFileSync(paths.manifest, JSON.stringify(manifest, null, 2), "utf-8");
  return paths;
}
