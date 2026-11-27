import { resolveConfig } from "./src/config.ts";
import { submitDraft } from "./src/submitter.ts";

// Thin operator driver: submits ONE already-mined draft dir.
// The triple guard lives in resolveConfig + submitDraft:
// mode=live AND LIVE_SUBMIT=1 env AND liveSubmit=true, plus the key.
// Usage: LIVE_SUBMIT=1 npx tsx submit-one.mts drafts/2026-11-26-de-cpi-nov
const dir = process.argv[2];
if (!dir) {
  console.error("usage: submit-one.mts <draftDir>");
  process.exit(2);
}
const cfg = resolveConfig({ mode: "live", liveSubmit: true });
const outcome = await submitDraft(cfg, dir);
console.log(JSON.stringify(outcome, null, 2));
