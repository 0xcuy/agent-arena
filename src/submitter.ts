import { readFile, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import type { AgentConfig } from "./config.js";
import type { DraftManifest, EntryState, SubmitOutcomeFields } from "./types.js";
import { EvidenceLog } from "./evidence-log.js";
import { ITEM_BUDGET, MAX_NOTE_CHARS, MAX_FILE_BYTES, MAX_TOTAL_FILE_BYTES } from "./gate.js";
import type { EvidenceClient, Submission } from "@gensyn-ai/gensyn-delphi-sdk";

/**
 * Live submitter, hard-gated: requires mode=live AND LIVE_SUBMIT=1 env AND the
 * --live-submit flag together (resolveConfig). No code path in this build passes
 * --live-submit, so no real submission can occur; the hardened path exists so
 * Sekar's QA can review exactly what WOULD be sent and how a submit is retried.
 *
 * Hardening (fix 7): the guard is checked here again; terms/limits/entry-state/gate
 * checks run inside submitDraft; a draft that was already submitted is refused;
 * the idempotency key is logged BEFORE the POST (a timeout retry reuses it);
 * a submission that comes back already "rejected" (HTTP 200, no judging to wait
 * for) is written to the ledger immediately so the stance lock is released —
 * rejected entries do not lock a stance and the market can be re-mined with
 * better evidence; otherwise waitForSubmission runs 30 minutes and stops when
 * the status is terminal; the CSV is sent as a File NAMED "data.csv" (an unnamed
 * Blob is unreadable client-side on some servers).
 */

export class SubmitGuardError extends Error {}

export interface SubmitOutcome {
  submissionId: string;
  status: string;
  outcome: SubmitOutcomeFields;
}

export interface SubmitDeps {
  /** Test seam: builds the SDK client submitDraft talks through. */
  createClient?: (cfg: AgentConfig) => Promise<EvidenceClient>;
}

/** Sidecar log: idempotency keys are appended BEFORE the POST so a timeout retry reuses the same key. */
export const SUBMIT_ATTEMPTS_LOG = "submit-attempts.jsonl";

function outcomeFor(sub: Submission, marketAddress: string): SubmitOutcomeFields {
  const marketVerdict = sub.markets.find((m) => m.marketAddress.toLowerCase() === marketAddress.toLowerCase());
  return {
    verdict: marketVerdict?.verdict ?? undefined,
    reason: marketVerdict?.reason ?? undefined,
    bounty: marketVerdict?.bounty?.amount,
    zeroPayReason: marketVerdict?.zeroPayReason ?? null,
    settlementUpTo: marketVerdict?.settlementUpTo ?? null,
  };
}

export async function submitDraft(cfg: AgentConfig, draftDir: string, deps: SubmitDeps = {}): Promise<SubmitOutcome> {
  if (!cfg.liveSubmit) {
    throw new SubmitGuardError(
      "submitDraft refused: liveSubmit is off. Set DELPHI_API_ACCESS_KEY, LIVE_SUBMIT=1 and pass --live-submit.",
    );
  }

  const manifest = JSON.parse(await readFile(`${draftDir}/manifest.json`, "utf-8")) as DraftManifest;
  if (manifest.submittedAt) {
    throw new SubmitGuardError(
      `submitDraft refused: ${draftDir} was already submitted at ${manifest.submittedAt} (submissionId ${manifest.submissionId}). No resubmission — submissions cannot be edited or retracted.`,
    );
  }

  const note = await readFile(`${draftDir}/note.md`, "utf-8");
  const csv = await readFile(`${draftDir}/data.csv`);

  const createClient =
    deps.createClient ??
    (async () => {
      const sdk = await import("@gensyn-ai/gensyn-delphi-sdk");
      return new sdk.EvidenceClient({
        baseUrl: cfg.baseUrl,
        apiKey: cfg.delphiApiKey!,
        agentId: cfg.agentId,
        agentHarness: cfg.agentHarness,
        agentModel: cfg.agentModel,
        // No invented headers: only X-Agent-* above (mapped by the SDK) and the SDK's Idempotency-Key.
      });
    });
  const client = await createClient(cfg);

  // --- re-run the mandatory account checks inside the submitter, not just in the pipeline.
  const terms = (await client.getTerms()).data;
  if (!terms.acceptedAt) {
    throw new SubmitGuardError(
      `terms not accepted (${terms.url}). Run \`npm run accept-terms\`; submitDraft never accepts for you.`,
    );
  }
  const limits = (await client.getLimits()).data;
  if (limits.submitsLeftThisHour <= 0) {
    throw new SubmitGuardError(`hourly submit budget exhausted until ${limits.hourEndsAt}`);
  }
  const entryData = (await client.getEntryState(manifest.marketAddress)).data as unknown as EntryState;
  if (!entryData.canSubmit) {
    throw new SubmitGuardError(
      `entry state canSubmit=false (${entryData.reason ?? "no reason"}) for ${manifest.marketAddress}`,
    );
  }

  // --- structural gate re-run on exactly what would be sent.
  const items = 1 + manifest.links.length + manifest.files.length;
  if (items > ITEM_BUDGET) {
    throw new SubmitGuardError(`item budget exceeded: ${items} > ${ITEM_BUDGET} (note + links + files)`);
  }
  if (note.length > MAX_NOTE_CHARS) {
    throw new SubmitGuardError(`note too long: ${note.length} > ${MAX_NOTE_CHARS}`);
  }
  // The attachments exactly as they will be POSTed: one file, data.csv.
  const files = [new File([csv], "data.csv", { type: "text/csv" })];
  // Per-file cap AND the total cap, matching the gate (the API's 10 MB is a total).
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) {
      throw new SubmitGuardError(`attached file ${f.name} too large: ${f.size} bytes > ${MAX_FILE_BYTES}`);
    }
  }
  const totalBytes = files.reduce((a, f) => a + f.size, 0);
  if (totalBytes > MAX_TOTAL_FILE_BYTES) {
    throw new SubmitGuardError(`attached files total ${totalBytes} bytes > ${MAX_TOTAL_FILE_BYTES} (10 MB TOTAL across all files)`);
  }
  for (const link of manifest.links) {
    try {
      const u = new URL(link);
      if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error("not http(s)");
    } catch {
      throw new SubmitGuardError(`malformed link in manifest: ${link}`);
    }
  }

  // Freshness: the draft asOf must be younger than 2h (an overnight draft is stale evidence).
  const asOfAge = Date.now() - new Date(manifest.asOf).getTime();
  if (asOfAge > 2 * 60 * 60 * 1000) {
    throw new SubmitGuardError(
      `draft asOf ${manifest.asOf} is ${(asOfAge / 3_600_000).toFixed(1)}h old (>2h) — re-mine a fresh draft instead of submitting stale evidence`,
    );
  }

  // --- log the idempotency key BEFORE submitting, so a timeout+retry reuses the same key server-side.
  appendFileSync(
    SUBMIT_ATTEMPTS_LOG,
    JSON.stringify({ ts: new Date().toISOString(), draftDir, marketAddress: manifest.marketAddress, idempotencyKey: manifest.idempotencyKey, phase: "pre-submit" }) + "\n",
    "utf-8",
  );

  const { data: submitted } = await client.submitEvidence({
    note,
    links: manifest.links,
    files,
    marketAddress: manifest.marketAddress,
    idempotencyKey: manifest.idempotencyKey,
  });

  // An HTTP-200 "rejected" is already terminal on arrival: there is no judging to
  // wait for (polled wait would burn 30 minutes for nothing), so it is written
  // back right away — status "rejected" in the ledger RELEASES the stance lock
  // (rejected entries do not lock a stance) and the market can be re-mined.
  if (submitted.status === "rejected") {
    manifest.submittedAt = new Date().toISOString();
    manifest.submissionId = submitted.id;
    manifest.outcome = outcomeFor(submitted, manifest.marketAddress);
    await writeFile(`${draftDir}/manifest.json`, JSON.stringify(manifest, null, 2), "utf-8");
    const rejectedLedger = new EvidenceLog("evidence-log.jsonl", "live");
    try {
      rejectedLedger.update(manifest.marketAddress, manifest.factSignature, {
        status: "rejected",
        submissionId: submitted.id,
      });
    } catch {
      appendFileSync(
        SUBMIT_ATTEMPTS_LOG,
        JSON.stringify({ ts: new Date().toISOString(), draftDir, submissionId: submitted.id, phase: "ledger-update-miss", factSignature: manifest.factSignature }) + "\n",
        "utf-8",
      );
    }
    return { submissionId: submitted.id, status: "rejected", outcome: manifest.outcome };
  }

  // Wait for judgment: docs allow "about 30 minutes"; stop polling once terminal (rejected included).
  const { data: settled } = await client.waitForSubmission(submitted.id, { timeoutMs: 30 * 60_000 });
  const terminal = new Set(["judged", "rejected", "failed", "unmatched"]);
  const status = terminal.has(settled.status) ? settled.status : "judging";
  const outcome = outcomeFor(settled, manifest.marketAddress);

  // --- write submissionId + idempotencyKey + outcome back to the manifest and the ledger.
  manifest.submittedAt = new Date().toISOString();
  manifest.submissionId = settled.id;
  manifest.outcome = outcome;
  await writeFile(`${draftDir}/manifest.json`, JSON.stringify(manifest, null, 2), "utf-8");

  const ledger = new EvidenceLog("evidence-log.jsonl", "live");
  try {
    ledger.update(manifest.marketAddress, manifest.factSignature, {
      status: "submitted",
      submissionId: settled.id,
    });
  } catch {
    appendFileSync(
      SUBMIT_ATTEMPTS_LOG,
      JSON.stringify({ ts: new Date().toISOString(), draftDir, submissionId: settled.id, phase: "ledger-update-miss", factSignature: manifest.factSignature }) + "\n",
      "utf-8",
    );
  }

  return { submissionId: settled.id, status, outcome };
}

