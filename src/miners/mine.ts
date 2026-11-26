import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalysisResult, CompetitionMarket, EvidenceCandidate, ResearchSpec, SourceLink } from "../types.js";
import { factSignature } from "../evidence-log.js";
import type { SourceApi, SourceDoc } from "./live/sources.js";

const MATHGEN = fileURLToPath(new URL("../../python/mathgen.py", import.meta.url));

/** Run python/mathgen.py for one analysis; returns stats + the CSV path written. */
export function runAnalysis(
  spec: ResearchSpec,
  csvPath: string,
  now: string,
  sourceMeta: { url: string; fetchedAt: string }[] = [],
): AnalysisResult {
  mkdirSync(dirname(csvPath), { recursive: true });
  const specPath = csvPath.replace(/\.csv$/, ".spec.json");
  writeFileSync(
    specPath,
    JSON.stringify({
      kind: spec.analysis.kind,
      params: spec.analysis.params,
      meta: { topic: spec.topic, market: spec.marketAddress, asOf: now, sources: sourceMeta },
    }),
    "utf-8",
  );
  const out = spawnSync("python3", [MATHGEN, "analyze", "--spec", specPath, "--csv", csvPath], {
    encoding: "utf-8",
  });
  if (out.error) throw out.error;
  if (out.status !== 0) {
    throw new Error(`mathgen failed for ${spec.topic} (exit ${out.status}): ${out.stderr}`);
  }
  rmSync(specPath, { force: true });
  return JSON.parse(out.stdout) as AnalysisResult;
}

export interface VerifyOutcome {
  ok: boolean;
  /** url -> the doc fetched during THIS verification run. */
  docs: Map<string, SourceDoc>;
  failures: { url: string; missing: string[] }[];
  warnings: string[];
}

/**
 * Anti-`unverifiable` verification for EVERY link (scraped, static-html AND
 * api-json — the latter used to ship on trust, fix 10), plus the note-figure
 * cross-check (fix 9): each figure pasted into the note must have at least one
 * of its numeric tokens present in the actual fetched source content
 * (decimal comma vs dot normalized), otherwise a figure typo slips through.
 * Docs already fetched in this run (by the refresher) are reused instead of
 * re-fetched, so figures that came from a second source are cross-checked too.
 */
export async function verifySources(
  spec: ResearchSpec,
  sources: SourceApi,
  noteFigures: string[],
  opts?: { live?: boolean; now?: Date; docs?: Map<string, SourceDoc> },
): Promise<VerifyOutcome> {
  const failures: { url: string; missing: string[] }[] = [];
  const warnings: string[] = [];
  const docs = new Map<string, SourceDoc>(opts?.docs ?? []);

  const fetchDoc = async (link: SourceLink): Promise<SourceDoc> => {
    const cached = docs.get(link.url);
    if (cached) return cached;
    const doc = await sources.fetch(link.url);
    docs.set(link.url, doc);
    return doc;
  };

  for (const link of spec.links) {
    let doc: SourceDoc;
    try {
      doc = await fetchDoc(link);
    } catch (err) {
      failures.push({ url: link.url, missing: [`fetch failed: ${(err as Error).message}`] });
      continue;
    }
    if (doc.status !== 200) {
      failures.push({ url: link.url, missing: [`HTTP ${doc.status} (200 required)`] });
      continue;
    }
    if (!link.expect || link.expect.length === 0) continue;
    const content = doc.json !== undefined ? JSON.stringify(doc.json) : doc.body;
    if (content.trim() === "") {
      failures.push({ url: link.url, missing: ["source content empty"] });
      continue;
    }
    const missing = link.expect.filter((needle) => !content.includes(needle));
    if (missing.length > 0) failures.push({ url: link.url, missing });
  }

  // Note-figure cross-check: at least one numeric token of each figure line must
  // appear in the fetched content (comma/period decimals normalized both ways).
  const allContent = [...docs.values()].map((d) => (d.json !== undefined ? JSON.stringify(d.json) : d.body)).join("\n");
  const norm = (s: string) => s.replace(/(\d),(?=\d{3}\b)/g, "$1").replace(/(\d),(\d)/g, "$1.$2");
  const contentNorm = norm(allContent).replace(/,/g, "");
  for (const [i, figure] of noteFigures.entries()) {
    const tokens = (figure.match(/\d+([.,]\d+)?/g) ?? []).map((t) => norm(t));
    if (tokens.length === 0) continue; // free-text figure (e.g. a statement, no number)
    if (!tokens.some((t) => contentNorm.includes(t.replace(/,/g, "")))) {
      failures.push({
        url: spec.links[0]?.url ?? "(candidate)",
        missing: [`figure #${i + 1} not found in fetched source content: "${figure.slice(0, 80)}"`],
      });
    }
  }

  if (opts?.live && spec.links.length > 0) {
    const cutoff = opts.now ?? new Date();
    for (const [url, doc] of docs) {
      const age = cutoff.getTime() - new Date(doc.fetchedAt).getTime();
      if (age > 2 * 60 * 60 * 1000) warnings.push(`source ${url} fetched_at is older than 2h (${doc.fetchedAt})`);
    }
  }

  return { ok: failures.length === 0, docs, failures, warnings };
}

/** Assemble the evidence-implied stance + signature into a candidate. */
export function assembleCandidate(
  spec: ResearchSpec,
  market: CompetitionMarket,
  analysis: AnalysisResult,
  now: string,
): EvidenceCandidate {
  const stance: "yes" | "no" = analysis.evidenceImpliedYes >= market.odds.yes ? "yes" : "no";
  return {
    marketAddress: market.address,
    marketQuestion: market.question,
    marketImpliedYes: market.odds.yes,
    topic: spec.topic,
    miningPath: spec.miningPath,
    langs: spec.langs,
    headline: spec.headline,
    figures: spec.figures,
    sourceDescriptions: spec.sourceDescriptions,
    links: spec.links.map(({ url, label, lang, access }) => ({ url, label, lang, access })),
    analysis,
    stance,
    factSignature: factSignature(market.address, spec.headline, spec.figures),
    asOf: now,
  };
}

/** For dedupe before mining: signature is computable from the spec alone. */
export function preSignature(spec: ResearchSpec): string {
  return factSignature(spec.marketAddress, spec.headline, spec.figures);
}

/** Staging CSV path helper shared with the pipeline. */
export function stagingCsvPath(topic: string): string {
  return join("staging", `${topic}-data.csv`);
}
