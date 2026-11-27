import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { DelphiApi, SubmissionRecord } from "./types.js";

/**
 * Read-only pre-submit gate CLI helpers (owner-ordered, round 2). Wraps the
 * existing DelphiApi read surface — getLimits, listSubmissions, getEntryState —
 * plus the local drafts manifests so the mining phase can check, BEFORE a run,
 * which submissions already went out on 26 Nov (de-cpi, wikipedia, ch-cpi,
 * ietf, es-vox — all judged DUPLICATE) and whether a market still accepts
 * evidence. Strictly read-only: nothing submits, nothing accepts terms,
 * nothing writes drafts. (Not to be confused with src/gate.ts, the candidate
 * quality gate inside the pipeline.)
 */

const DRAFTS_DIR = fileURLToPath(new URL("../drafts/", import.meta.url));

export interface DraftManifestSummary {
  topic: string;
  marketAddress: string;
  marketQuestion: string;
  generatedAt: string;
  mode: string;
  stance: string;
  idempotencyKey: string;
  submittedAt: string | null;
  submissionId: string | null;
  verdict: string | null;
  verdictReason: string | null;
}

export function loadDraftManifests(dir: string = DRAFTS_DIR): DraftManifestSummary[] {
  if (!existsSync(dir)) return [];
  const out: DraftManifestSummary[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const manifestPath = join(dir, entry.name, "manifest.json");
    if (!existsSync(manifestPath)) continue;
    try {
      const m = JSON.parse(readFileSync(manifestPath, "utf-8")) as Record<string, unknown>;
      const outcome = (m.outcome ?? {}) as Record<string, unknown>;
      out.push({
        topic: String(m.topic ?? entry.name),
        marketAddress: String(m.marketAddress ?? ""),
        marketQuestion: String(m.marketQuestion ?? ""),
        generatedAt: String(m.generatedAt ?? ""),
        mode: String(m.mode ?? ""),
        stance: String(m.stance ?? ""),
        idempotencyKey: String(m.idempotencyKey ?? ""),
        submittedAt: m.submittedAt ? String(m.submittedAt) : null,
        submissionId: m.submissionId ? String(m.submissionId) : null,
        verdict: outcome.verdict ? String(outcome.verdict) : null,
        verdictReason: outcome.reason ? String(outcome.reason) : null,
      });
    } catch {
      // A malformed manifest is skipped, not fatal: the gate is advisory.
    }
  }
  return out;
}

export interface EvidenceListRow {
  topic: string;
  marketAddress: string;
  stance: string;
  submittedAt: string | null;
  verdict: string | null;
}

/** Markets + facts from prior submissions: API submissions plus local draft manifests. */
export async function listEvidence(api: DelphiApi, market?: string): Promise<{ submissions: SubmissionRecord[]; drafts: EvidenceListRow[] }> {
  const submissions = await api.listSubmissions(market ? { market } : {});
  const drafts = loadDraftManifests()
    .filter((d) => !market || d.marketAddress === market)
    .map((d) => ({
      topic: d.topic,
      marketAddress: d.marketAddress,
      stance: d.stance,
      submittedAt: d.submittedAt,
      verdict: d.verdict,
    }));
  return { submissions, drafts };
}

/** Remaining quota lines from getLimits. */
export function limitsReport(l: Awaited<ReturnType<DelphiApi["getLimits"]>>): string[] {
  return [
    `submits left this hour: ${l.submitsLeftThisHour} (hour ends ${l.hourEndsAt})`,
    `daily cap left:         ${l.dailyCapLeft} (resets ${l.dailyCapResetAt})`,
  ];
}

/** Whether a market still accepts evidence and its remaining judgment pot. */
export async function entryStateReport(api: DelphiApi, address: string): Promise<string[]> {
  const s = await api.getEntryState(address);
  return [
    `market:                     ${address}`,
    `accepts evidence:           ${s.canSubmit ? "yes" : "no"}${s.reason ? ` (${s.reason})` : ""}`,
    `submissions left on market: ${s.remainingOnMarket}`,
    `judgment pot remaining:     ${s.judgementPotRemainingBaseUnits} base units`,
    `restricted tier:            ${s.restricted ? "yes" : "no"}`,
    ...(s.rateLimit?.resetAt ? [`rate limit resets:          ${s.rateLimit.resetAt}`] : []),
  ];
}
