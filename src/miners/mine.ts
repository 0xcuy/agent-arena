import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AnalysisResult, CompetitionMarket, EvidenceCandidate, ResearchSpec } from "../types.js";
import type { FirecrawlApi } from "../firecrawl/client.js";
import { factSignature } from "../evidence-log.js";
import { MOCK_NOW } from "../delphi/fixtures.js";

const MATHGEN = fileURLToPath(new URL("../../python/mathgen.py", import.meta.url));

/** Run python/mathgen.py for one analysis; returns stats + the CSV path written. */
export function runAnalysis(spec: ResearchSpec, csvPath: string, now: string): AnalysisResult {
  mkdirSync(dirname(csvPath), { recursive: true });
  const specPath = csvPath.replace(/\.csv$/, ".spec.json");
  writeFileSync(
    specPath,
    JSON.stringify({
      kind: spec.analysis.kind,
      params: spec.analysis.params,
      meta: { topic: spec.topic, market: spec.marketAddress, asOf: now },
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
  failures: { url: string; missing: string[] }[];
  warnings: string[];
}

/** Anti-`unverifiable`: every scraped link's content must still contain the
 *  figures we paste into the note. The judge fetches cited URLs with no JS,
 *  so claims must be present in static/markdown content. */
export async function verifySources(spec: ResearchSpec, firecrawl: FirecrawlApi): Promise<VerifyOutcome> {
  const failures: { url: string; missing: string[] }[] = [];
  const warnings: string[] = [];
  for (const link of spec.links) {
    if (link.access === "static-html" || !link.expect || link.expect.length === 0) continue;
    let markdown = "";
    try {
      markdown = (await firecrawl.scrape(link.url)).markdown;
    } catch (err) {
      failures.push({ url: link.url, missing: [`scrape failed: ${(err as Error).message}`] });
      continue;
    }
    if (markdown.trim() === "") {
      // Mock fixtures cover every scraped URL; an empty scrape means the fixture
      // or the live source is unreadable -> treat as unverifiable.
      failures.push({ url: link.url, missing: ["source content empty"] });
      continue;
    }
    const missing = link.expect.filter((needle) => !markdown.includes(needle));
    if (missing.length > 0) failures.push({ url: link.url, missing });
  }
  return { ok: failures.length === 0, failures, warnings };
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

export const MOCK_AS_OF = MOCK_NOW;
