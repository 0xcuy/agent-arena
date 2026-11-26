# Consolidated Fix List — Agent Arena evidence-mining agent (26 Nov 2026)

Joint QA complete: Sekar (hands-on code + live source checks) + Fable
(plan-conformance + code-level addendum, verified vs verbatim files +
gensyn-delphi SDK). Sources: Sekar QA-FINDINGS-2026-11-26.md; Fable
findings #12–#20 (10:36 WIB); Fable Code-Level QA Addendum Bugs A–F
(10:40 WIB). Deduped and renumbered here; overlaps noted.

Verdict (both): DO NOT submit any of the 10 mock drafts. Plumbing passes;
data layer fails. Fix, re-mine live, re-QA, then submit.

## FIX — CRITICAL
1. Build the live miner (zero-hallucination invariant: no number/URL enters
   a note unless extracted/computed from a live HTTP 200 fetch in the same
   run, fetched_at < 2h). Phase 1: live Path B fetcher + Python CSV
   calculators (Wikipedia siteinfo, Bun GitHub releases, Go milestone by
   title, Node dist/index.json, IETF Datatracker). Phase 2 (wave-agnostic):
   Path A (official dataSources from markets.json → Python calculator →
   note template) + Path C (domain-scoped Firecrawl discovery + compact
   TXT/PNG attachments) so Wave 2+ markets run without hardcoded specs.
   [Sekar #1 + Fable architecture]
2. Fix the 5 dead source URLs — replace guesses with verified live URLs:
   Destatis real PE26_xxx press release, BK admin postal-voting page, SRG
   Wählbarometer, Electografia, FIDE match page. [Sekar #2]
3. Fix Go milestone: find the real Go1.27.5 milestone BY TITLE (305 is
   Go1.20.4), re-pull open/closed counts. [Sekar #3]
4. Fix Wikipedia count: re-pull live (7,269,362 as of 26 Nov 10:35 WIB),
   recompute velocity math (required net 6,138 / 438 per day, not 4,266).
   [Sekar #4]
5. Fix gate item count: `1 + links.length + files.length <= 3` — the
   hardcoded `1 + 1 + 1` never fails, so a 2-link + CSV draft (4 items)
   passes the gate then fails Delphi 400. [Fable Bug A]
6. Fix gate slot counting: use remainingOnMarket directly — it already
   nets submissions, so subtracting online + submitted counts blocks
   slots #2 and #3 falsely. [Fable Bug B — CONFIRMED by Fable 10:44 WIB
   with primary sources: gensyn-delphi-skills/reference/evidence-api.md
   defines remainingOnMarket as the server-tracked remaining submissions
   on the market (0 when cap_reached); only in-flight claims not yet
   submitted may be subtracted when batching several drafts for the same
   market.]
7. Harden submitDraft: run terms/limits/entry-state/gate checks inside it;
   refuse if manifest.submittedAt is set; write submissionId +
   idempotencyKey back to the ledger/manifest (log the key BEFORE
   submitting so a timeout retry reuses it); surface verdict/reason/
   bounty/zeroPayReason/settlementUpTo instead of discarding them;
   waitForSubmission timeout 30 min (docs) not 10 [CONFIRMED by Fable
   10:44 WIB: evidence-api.md "read the result again until it is judged,
   for at most about 30 minutes"; scripts/evidence.ts
   `Date.now() + 30 * 60_000`]; stop polling when
   status is rejected; send the CSV as File named "data.csv", not an
   unnamed Blob. [Fable Bug C + #19]
8. Terms acceptance flow: after the owner says "yes", POST
   /v1/terms/acceptance (today the pipeline only throws and asks for a
   manual POST). [Fable #12, remainder]

## FIX — HIGH
9. Fix DE CPI 118.2 vs 118,4 mismatch (verify the real Oct VPI from
   Destatis/GENESIS); extend verification to the note's pasted figures,
   not only the expect needles. [Sekar #5]
10. Add live API verification for api-json/static-html specs (Wikipedia,
    GitHub, Datatracker, CH CPI, IETF, Bun) — today they ship on trust.
    [Sekar #6]
11. Separate mock/live ledgers (or mode-tag entries): mock "drafted"
    entries currently block live drafting of the same 10 markets as
    duplicates and eat 1/3 of the per-market cap. [Sekar #12]
12. Gate additions: note length ≤ 8000, file size ≤ 10 MB, asOf freshness,
    prediction-market domain check, judge-manipulation phrase linter.
    [Fable Bug D + #20]
13. Freshness gate: source fetch/publication timestamp must be AFTER each
    market's resolutionCriteria cutoff timestamp (stale facts = $0).
    [Fable #17]
14. Judge-proof attachments: compact CSV/TXT/PNG (URL + UTC timestamp) +
    key figures at the top of the note for JS portals (judge fetches basic
    HTTP once and truncates long pages). [Fable #16]
15. Move the online-submissions check BEFORE mining (today it runs after
    the analysis step). [Fable #15, remainder]

## FIX — MEDIUM
16. Fix "56.8%%" typo in draft.ts (`${marketPct}%` → `${marketPct}`).
    [Sekar #7]
17. Fix draftsSkippedNoSpec double-count (latent; did not trigger this
    run). [Sekar #8]
18. Set a real agent identity: X_AGENT_ID = SIERA Labs identity, not the
    "agent-arena" default. [Sekar #9]
19. Normalize marketAddress to lowercase in evidence-log.ts (comparisons
    are case-sensitive today). [Fable Bug E]
20. Remove the invented X-Delphi-Item-Budget header. [Sekar #10 = Fable
    Bug F]

## FIX — LOW
21. Live SDK smoke test first: `npm run plan` in live mode (no writes)
    before any live draft/submit. [Sekar #11]

## ALREADY OK — verified, no action
- Terms checked before research in live mode (pipeline step 2). [Fable #12,
  check part]
- Limits + entry-state checked before mining. [Fable #18]
- Stance lock + dedupe in the gate (local part). [Fable #15, local part]
- submitEvidence via the SDK (not raw FormData); SDK verified to send
  links[] with brackets, map agentId/harness/model to X-Agent-* headers,
  honor Retry-After in waitForSubmission, and type EntryState.restricted.
  [Fable #13, SDK part + addendum verification]

## Next step
User picks which fixes Vibe builds. Then: Vibe fixes → Sekar + Fable
re-QA → live re-mine → first real submissions (only after QA passes).
