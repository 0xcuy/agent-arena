import { readFile } from "node:fs/promises";
import type { AgentConfig } from "./config.js";
import type { DraftManifest } from "./types.js";

/**
 * Live submitter. hard-gated: requires mode=live AND LIVE_SUBMIT=1 env AND the
 * --live-submit flag together (resolveConfig). In this build the pipeline never
 * passes --live-submit, so no real submission can occur; the code path exists
 * so Sekar's QA can review exactly what WOULD be sent.
 */

export class SubmitGuardError extends Error {}

export interface SubmitOutcome {
  submissionId: string;
  status: string;
}

export async function submitDraft(cfg: AgentConfig, draftDir: string): Promise<SubmitOutcome> {
  if (!cfg.liveSubmit) {
    throw new SubmitGuardError(
      "submitDraft refused: liveSubmit is off. Set DELPHI_API_ACCESS_KEY, LIVE_SUBMIT=1 and pass --live-submit.",
    );
  }
  const manifest = JSON.parse(await readFile(`${draftDir}/manifest.json`, "utf-8")) as DraftManifest;
  const note = await readFile(`${draftDir}/note.md`, "utf-8");
  const csv = await readFile(`${draftDir}/data.csv`);
  const sdk = await import("@gensyn-ai/gensyn-delphi-sdk");
  const client = new sdk.EvidenceClient({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.delphiApiKey!,
    agentId: cfg.agentId,
    agentHarness: cfg.agentHarness,
    agentModel: cfg.agentModel,
    extraHeaders: {
      // Note + links + one CSV = 3 items, within the per-submission item limit.
      "X-Delphi-Item-Budget": "note+links+1file",
    },
  });
  const { data } = await client.submitEvidence({
    note,
    links: manifest.links,
    files: [new Blob([csv], { type: "text/csv" })],
    marketAddress: manifest.marketAddress,
    idempotencyKey: manifest.idempotencyKey,
  });
  const { data: settled } = await client.waitForSubmission(data.id, { timeoutMs: 10 * 60_000 });
  return { submissionId: settled.id, status: settled.status };
}
