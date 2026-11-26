# FIX BRIEF — Agent Arena evidence-mining agent (round 2, Vibe build)

## Context
You built the Delphi Agent Arena evidence-mining agent in /root/agent-arena
(run 1, mock mode, 10 Wave 1 drafts). Joint QA by Sekar (hands-on) and
Fable (plan-conformance + SDK verification) found 21 fixes. Your job:
implement ALL 21. Reference files on this host: FIX-LIST.md (the
consolidated list, authoritative) and QA-FINDINGS-2026-11-26.md (Sekar's
detailed findings). Read both before coding.

## Hard rules (same as round 1)
- Credentials ONLY from env vars (DELPHI_API_ACCESS_KEY, FIRECRAWL_API_KEY).
  Never hardcode or commit a secret.
- Mock mode when keys are missing; the full pipeline must run offline in mock.
- NO real submissions to Delphi in this build. The submit path stays
  triple-guarded (mode=live AND LIVE_SUBMIT=1 AND --live-submit); never
  call submitDraft from the pipeline, never enable live submit.
- No repo created or pushed until Sekar says.
- Do not break existing tests: npm test must stay 15/15 passing; ADD tests
  for every new gate rule you implement (item count, slot counting, note
  length, file size, freshness, domain check, phrase linter, lowercase
  addresses).
- TypeScript must stay clean (npx tsc --noEmit exit 0).

## The 21 fixes (FIX-LIST.md is authoritative; summary)
CRITICAL:
1. Build the live miner — zero-hallucination invariant: no number or URL
   enters a note unless extracted or computed from a live HTTP 200 fetch in
   the SAME run, fetched_at < 2 hours old. Phase 1: live Path B fetcher +
   Python CSV calculators for Wikipedia siteinfo, Bun GitHub releases, Go
   milestone (search by title, never hardcode the milestone ID), Node
   dist/index.json, IETF Datatracker. Phase 2 (wave-agnostic): Path A —
   official dataSources from markets.json → Python calculator → note
   template; Path C — domain-scoped Firecrawl discovery + compact TXT/PNG
   attachments — so Wave 2+ markets work without hardcoded specs. Live
   mining must REPLACE the frozen specs: specs.ts becomes a fallback/seed
   only; live runs fetch fresh data and recompute params.
2. Fix the 5 dead source URLs with verified live ones: Destatis real
   PE26_xxx press release URL (PE26_4xx.html is a 404), BK admin
   postal-voting page, SRG Wählbarometer, Electografia, FIDE match page.
   Verify each URL returns HTTP 200 with the expected content before
   using it.
3. Go milestone: find the real Go1.27.5 milestone BY TITLE via the GitHub
   API (milestone 305 is Go1.20.4), re-pull open/closed counts.
4. Wikipedia count: re-pull live from the siteinfo API (was 7,269,362 on
   26 Nov) and recompute the velocity math.
5. Gate item count: 1 + links.length + files.length <= 3 (replace the
   hardcoded 1+1+1).
6. Gate slots: use remainingOnMarket directly (it is the server-tracked
   remaining submissions, 0 when cap_reached; only in-flight claims not
   yet submitted may be subtracted when batching). Do NOT subtract
   onlineSubmissionCount or submittedCount from it.
7. Harden submitDraft: run terms/limits/entry-state/gate checks inside
   it; refuse if manifest.submittedAt is set; write submissionId +
   idempotencyKey back to the ledger/manifest (log the idempotency key
   BEFORE submitting so a timeout retry reuses it); surface
   verdict/reason/bounty/zeroPayReason/settlementUpTo; waitForSubmission
   timeout 30 minutes; stop polling when status is rejected; send the
   CSV as a File named "data.csv", not an unnamed Blob.
8. Terms acceptance flow: after the owner says yes, POST
   /v1/terms/acceptance (today the pipeline only throws and asks for a
   manual POST). Implement the accept step as a separate explicit CLI
   action (e.g. `npm run accept-terms`), never automatic inside a run.
HIGH:
9. Fix DE CPI 118.2 vs 118,4 mismatch — verify the real Oct 2026 VPI
   index from Destatis/GENESIS; extend verifySources to check the note's
   pasted figures against scraped content, not only the expect needles.
10. Add live API verification for api-json/static-html specs (Wikipedia
    siteinfo, GitHub API, Datatracker, CH CPI, IETF, Bun) — today they
    are never verified in live mode.
11. Separate mock/live ledgers (or mode-tag entries): mock "drafted"
    entries must not block live drafting or consume the per-market cap.
    Live mode must ignore mock entries entirely.
12. Gate additions: note length ≤ 8000 chars, file size ≤ 10 MB, asOf
    freshness check, prediction-market domain check, judge-manipulation
    phrase linter (ban judge-steering phrases + bookmaker URLs).
13. Freshness gate: source fetch/publication timestamp must be AFTER each
    market's resolutionCriteria cutoff timestamp.
14. Judge-proof attachments: compact CSV/TXT/PNG attachments (URL + UTC
    timestamp) + key figures at the top of the note (the judge fetches
    basic HTTP once and truncates long pages).
15. Move the online-submissions check (GET /v1/submissions?market=...) to
    BEFORE mining (today it runs after the analysis step).
MEDIUM:
16. Fix "56.8%%" typo in draft.ts: `${marketPct}%` → `${marketPct}`.
17. Fix draftsSkippedNoSpec double-count in pipeline.ts (report init
    assigns noSpecMarkets AND the loop pushes again).
18. Set a real agent identity: default X_AGENT_ID to a SIERA Labs
    identity (e.g. "siera-labs-evidence-miner") instead of "agent-arena".
19. Normalize marketAddress to lowercase in evidence-log.ts comparisons.
20. Remove the invented X-Delphi-Item-Budget header from submitter.ts.
LOW:
21. Live SDK smoke test: `npm run plan` in live mode (no writes) must
    work before any live draft/submit; document it in the README.

## Verification (do all of these before finishing)
- `npm install && npm test` (15/15 + new tests pass), `npx tsc --noEmit`
  clean.
- `npm run mock` end-to-end: drafts written, 0 gate rejects on valid
  specs, dedupe re-run writes 0 new drafts.
- Where no key is needed, verify corrected figures against LIVE public
  sources (Wikipedia siteinfo, GitHub API) and record the live values in
  the fix report.
- Write FIX-REPORT.md in /root/agent-arena: one section per fix # (what
  changed, files, test/verification evidence), plus known gaps (anything
  you could not verify without keys).

## Deliverable
Updated code in /root/agent-arena + FIX-REPORT.md. Do not submit anything
live. Do not create or push a repo.
