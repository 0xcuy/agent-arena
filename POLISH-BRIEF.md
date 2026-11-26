# POLISH BRIEF — Agent Arena evidence-mining agent (run 3)

Context: Vibe run 2 fixed all 21 consolidated items. Sekar QA pass 2
verified them (42/42 tests, tsc clean, all figures re-checked live) with
verdict PASS WITH MINOR POLISH. Fable QA pass 2 (11:28 WIB) CONFIRMED the
pass and added 4 small items. This run applies the 9 polish items below
— nothing else. No live submission in this run (no credentials yet, by
design); mock mode only. Workdir is /root/agent-arena (run-2 state,
commit cbedac9). Read QA-FINDINGS-RUN2-2026-11-26.md first.

## Sekar's 5 minor defects (from QA pass 2)

1. CH CPI note garble: `drafts/2026-11-26-ch-cpi-nov/note.md` KEY FIGURES
   says "+0,0,2% MoM" (should be "+0.2%"). Root cause in
   `src/miners/live/refreshers-part1.ts` (~line 231): figure template
   `` `+0,${momNewRaw}%` `` where momNewRaw is already "0,2" (German
   decimal). Fix the template so it renders "+0.2%". Re-mine the ch-cpi
   draft and confirm the note reads correctly.
2. Wikipedia velocity: the note shows ~468.9/day (KEY FIGURES) vs
   468.2/day (METHOD, 330 days). Correct is 154,500 / 329 days =
   469.6/day. Use ONE consistent number (469.6/day, 329 days) in both
   places. Stance (YES) is unchanged.
3. FIDE note garbled player-color phrasing in KEY FIGURES ("Gukesh
   Dommaraju Black (White) vs Javokhir Sindarov Result (Black)") —
   table-scrape artifact. Clean the parse so the line reads as a plain
   result (½-½, match score 1–1).
4. Bun median: note says median gap 18 days; standard median of the 14
   gaps is 17 (18 is the upper median). Use the standard median.
5. Mock timestamps: mock-mode notes/CSVs record fetchedAt = MOCK_NOW
   (2026-11-26T12:00:00.000Z) because sources.ts overrides fixture
   fetchedAt with mockNow. In mock mode, use each fixture's recorded
   fetchedAt (the real fetch time) instead, so CSVs never misrepresent
   when a source was fetched. Live runs already use real timestamps.

## Fable's 4 additions (QA pass 2, 11:28 WIB)

6. evidence-log.ts update() [MEDIUM]: the search finds an entry by
   marketAddress + factSignature across ALL modes — a live update could
   patch a mock row. Filter the lookup to the instance's own mode
   (visible entries only).
7. submitter.ts [MEDIUM]: if a submission comes back "rejected"
   immediately (HTTP 200 with rejected status, no judging to wait for),
   do NOT poll for 30 minutes. Write "rejected" to the ledger right
   away so the stance lock is released (rejected entries do not lock a
   stance) and the market can be re-mined with better evidence.
8. gate.ts, two edge cases [LOW–MEDIUM]:
   (a) Remove the `baseline &&` guard on the cutoff check, so
   fetchedAt < evidenceCutoffAt is enforced even when a market's
   resolution criteria has no "strictly after" regex (Wave 2 markets).
   (b) The Delphi 10 MB cap is TOTAL across all attached files, not
   per file. Enforce sum(fileSizes) <= 10 MB in the gate (and the same
   total check in submitter.ts), keeping the per-file check as well.
9. Note phrasing [LOW–MEDIUM]: in the DE CPI note, "Vorkorrektur" is
   the wrong word — use "Vorläufiges Ergebnis" (preliminary result).
   Across all notes, soften advocacy phrasing into neutral framing:
   "pushes the YES side up" / "P(yes) ≈ 99.6%" reads as steering to
   the judge. State the number and what it implies, without urging a
   side (e.g. "the evidence is consistent with a higher P(yes)").
   Apply wherever the template (draft.ts) or refreshers emit such
   phrasing.

## Verification (must all hold before finishing)

- `npm test` — all tests pass (42 in run 2; add tests for items 6, 7, 8
  where they change behavior).
- `npx tsc --noEmit` — exit 0.
- `npm run mock` — re-mines cleanly; confirm the ch-cpi note, the
  Wikipedia number, the FIDE line and the Bun median in the new drafts,
  and that mock CSV fetchedAt values are the fixtures' real fetch times.
- Write POLISH-REPORT.md: one line per item (fixed + how verified),
  plus any item you could NOT fix and why. No live submission, no
  credential handling, no new features. Commit locally only.
