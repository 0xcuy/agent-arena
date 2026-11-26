# POLISH REPORT — Agent Arena evidence-mining agent, polish run 3 (26 Nov 2026)

Vibe run 3 on top of run 2 (commit cbedac9). Scope: the 9 QA items only —
no live submission, no credential handling, no new features. Verification at
the bottom. One line per item as required.

## Sekar's 5 minor defects (QA pass 2)

1. **CH CPI note garble — FIXED.** `refreshers-part1.ts` (refreshChCpi) rendered
   `+0,${momNewRaw}%` with the raw German-decimal group, producing "+0,0,2%".
   Both occurrences (KEY FIGURES line + source description) now use the parsed
   number: `+${momNew.toFixed(1)}%` → "+0.2%". Verified: `npm run mock` re-mine;
   `drafts/2026-11-26-ch-cpi-nov/note.md` KEY FIGURES now reads "+0.2% MoM".
   Test: `polish 1`.
2. **Wikipedia velocity — FIXED.** `daysElapsed` now counts whole days since
   Jan 1 (floor), so both KEY FIGURES and the CSV/method line (mathgen) derive
   from the same day count: +154,500 over 329 days = 469.6/day (mean). The
   headline and required-pace lines match at one decimal (435.5/day required).
   Verified: note shows 469.6/day and 329 days in *both* places; stance YES
   unchanged (469.6 > 435.5). Test: `polish 2`.
3. **FIDE player-color garble — FIXED.** The White/Black captures were unbounded
   across the one-line scraped factsheet table; each is now bounded by the next
   label (`... White: <name>\s+Black:` / `Black: <name>\s+Result:`). The figure
   line reads as a plain result: "game 2 ended ½-½; match score 1-1 (White:
   Gukesh Dommaraju, Black: Javokhir Sindarov)". Verified in the re-mined note.
   Test: `polish 3`.
4. **Bun median — FIXED (with a number caveat).** mathgen's `release_gap_cdf`
   used `sorted(gaps)[n//2]` (upper median). It now uses a standard `median()`
   helper (mean of the two middle values for even n). **Caveat:** the standard
   median of the current 14 fixture gaps is **16.5 days** (middle pair 15 and 18),
   not 17 — QA's "17" is 16.5 rounded to a whole day. The note now prints the
   exact standard median "median 16.5 days" rather than the old upper median 18.
   Test: `polish 4` (asserts the formula, not QA's rounded value).
5. **Mock timestamps — FIXED (with a precision caveat).** New sidecar
   `src/miners/live/fixtures-meta.json` records each fixture's fetchedAt;
   `createSources` (mock) serves that recorded time and **fails loudly** if a
   fixture has no recorded time (the unused `mockNow` override — the exact
   mechanism QA flagged — was removed). Notes/CSVs now stamp
   2026-11-26T04:15:00.000Z instead of the 12:00 mock clock. Two caveats:
   (a) per-URL second-level fetch times were never recorded in run 2 — the
   recorded fact is the fetch session (03:50–04:30 UTC; all 22 URLs re-verified
   HTTP 200 at ~04:15 UTC per FIX-REPORT), so each fixture records that session
   time; if per-URL precision matters, fixtures must be re-recorded with a
   fetch-time logger. (b) `composeNote` used to stamp the shipped link line with
   `asOf` (the run clock); it now takes the link's actual fetch time
   (`linkFetchedAt`), so the note's SOURCES lines match the CSV source rows.
   Verified: every `source,...,fetchedAt` CSV row and every note SOURCES line
   shows 2026-11-26T04:15:00.000Z; the only remaining 12:00:00.000Z strings are
   market evidence-cutoff timestamps. Test: `polish 5`.

## Fable's 4 additions (QA pass 2, 11:28 WIB)

6. **evidence-log update() mode-scoped — FIXED.** The lookup now runs over
   `visible()` (the instance's own mode), so a live submission write-back can
   never patch a mock row (signature+market collisions across modes are
   impossible by construction now). Test:
   `evidence-log: update() is mode-scoped`.
7. **Immediate "rejected" — FIXED.** `submitDraft` checks the submitEvidence
   response status: an HTTP-200 `rejected` is terminal on arrival, so it skips
   `waitForSubmission` entirely (no 30-minute poll) and writes the ledger entry
   to status `rejected` immediately — rejected entries do not lock a stance
   (`lockedStance` already filtered them), so the market can be re-mined with
   better evidence. The manifest gets `submittedAt`/`submissionId`/`outcome`
   (reason surfaced) in the same write-back. A test seam
   (`SubmitDeps.createClient`) injects a fake SDK client without touching the
   production path. Test: `polish 7` (asserts waitForSubmission is NOT called,
   ledger row flips to rejected + id, stance lock released, manifest written).
8. **Gate edge cases — FIXED.** (a) The evidence-cutoff check no longer requires
   a parsed "strictly after" baseline: `fetchedAt < evidenceCutoffAt` is enforced
   for every market, Wave 2 criteria without the regex included (a future
   window-start baseline is still not a freshness floor — see the comment in
   gate.ts). (b) The 10 MB cap is now enforced as a TOTAL across all attached
   files (`MAX_TOTAL_FILE_BYTES`) in gate.ts AND submitter.ts, alongside the
   per-file check. Tests: `gate: evidence cutoff enforced even without a
   'strictly after' baseline`, `gate: the 10 MB file cap is TOTAL across all
   attached files`.
9. **Note phrasing — FIXED.** DE CPI headline: "Vorkorrektur" → "Vorläufiges
   Ergebnis (preliminary result)". The FORECAST COMPARISON block (draft.ts) is
   now neutral: the number is stated and its implication given without urging a
   side — "This evidence implies P(yes) ≈ 99.6% (confidence: high); relative to
   the market snapshot, the evidence is consistent with a higher P(yes)." (lower
   P(yes) for NO-side candidates). "pushes the YES side up/down" is gone from
   every note; it was the only advocacy phrasing in draft.ts/refreshers (other
   constructions like "the bar still clears" state arithmetic results, not
   recommendations). Test: `composeNote: neutral forecast-comparison phrasing`.

## Verification (all hold)

- `npm test` — **52/52 pass, 0 fail** (42 carried over + 10 new: polish 1–5,
  polish 7, evidence-log update mode-scoping, gate Wave-2 cutoff, gate 10 MB
  total, composeNote phrasing).
- `npx tsc --noEmit` — **exit 0**.
- `npm run mock` (fresh ledger, see below) — **10 candidates mined, 10 drafts
  written, 0 gate rejects, 0 mining failures**; ch-cpi "+0.2% MoM", Wikipedia
  469.6/day over 329 days in both places, FIDE plain-result line, Bun "median
  16.5 days", and every mock CSV/note fetchedAt = 2026-11-26T04:15:00.000Z
  (recorded fixture time) all confirmed in the re-mined drafts.
- Immediate `npm run mock` re-run — **0 new drafts, 10 duplicates skipped,
  0 rejects** (dedupe path intact; ledger holds exactly 10 entries).
- No live submission, no credential handling, no new features; commit is local
  only.

## Items NOT fixed / deviations

- Item 4 value: implemented the standard-median formula; the resulting figure
  is 16.5 days, not QA's "17" (see item 4 above — 17 is 16.5 rounded).
- Item 5 precision: per-URL second-level fetch times were never recorded in
  run 2, so each fixture records the documented session fetch time (~04:15 UTC)
  rather than an invented per-URL time (see item 5 above).
- Ledger housekeeping (not a defect fix, needed for a clean re-mine): the run-2
  mock ledger was archived to `evidence-log-run2-mock-archive.jsonl` (same
  convention as `evidence-log-run1-archive.jsonl`) because its drafted entries
  legitimately block re-mining those 10 markets — the fact signatures changed
  with the fixed figures, so QA re-validation needs the fresh-ledger drafts.
