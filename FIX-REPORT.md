# FIX-REPORT — Agent Arena evidence-mining agent (round 2, all 21 fixes)

Build: 2026-11-26, Vibe round 2. All 21 fixes from FIX-LIST.md implemented.
Verification at the bottom; known gaps honestly listed at the end.

Headline results:

- `npm test`: **42/42 pass** (15 run-1 test intents kept passing, 27 new tests added).
- `npx tsc --noEmit`: **exit 0**.
- `npm run mock`: **10/10 Wave 1 drafts written from re-mined data, 0 gate rejects,
  0 mining failures**; an immediate re-run writes **0 new drafts** (dedupe).
- Live values recorded against the public sources in this same session (see below).
- Nothing was submitted live. No repo was created or pushed.

## Architecture change that carries the round (fix 1)

The run-1 data layer (frozen `specs.ts` figures + `SCRAPE_FIXTURES`) is gone —
deleted, replaced by a live miner:

- `src/miners/live/sources.ts` — fetch layer. Every source must return HTTP 200
  with an `fetchedAt` < 2h (enforced in live mode). Mock mode serves recorded
  snapshots (`src/miners/live/fixtures.json`) **and fails loudly on any URL
  without a fixture** — nothing can be silently invented.
- `src/miners/live/refreshers-part1.ts` / `-part2.ts` — per-topic refreshers that
  parse the live figures out of the fetched content and recompute the analysis
  params, headline, figures and expect-needles in-run.
- `src/miners/live/refreshers.ts` — seeds + registry. A seed holds only source
  URLs, market-definition constants (thresholds, windows) and **stated model
  assumptions** (seasonal MoM lists, draw shares, base rates), which are surfaced
  in the note as assumptions, never as live facts.
- `python/mathgen.py` — 4 new analysis kinds (`cpi_required_mom`,
  `turnout_threshold`, `seat_threshold`, `match_lead_elo`, the last an exact
  3^6 enumeration), generalized `threshold_velocity` and `ballot_flag_snapshot`,
  and per-CSV `source,<url>,<fetchedAt>` rows written from the run's fetches.

Zero-hallucination invariant is enforced structurally: a refresher can only
build a candidate from SourceDocs it fetched in the same run; any parse failure
raises and the pipeline records the market under `miningFailures` and skips it.
**The pipeline never falls back to frozen numbers** — if live mining fails, there
is no draft. `specs.ts` is deleted. Anyone can re-verify a figure by fetching the
recorded URL.

---

## CRITICAL

### Fix 1 — live miner (both phases)
See the architecture section above. Phase 1 (machine-readable calculators) is
implemented for Wikipedia siteinfo, Bun GitHub releases, **Go milestone by title**,
Node dist/index.json, IETF Datatracker, plus the official-series arithmetic
markets (Destatis, BFS incl. cross-base chaining) and the three non-English
primary sources. Phase 2 wave-agnosticness is delivered as: adding a Wave 2+ market
= adding a seed (URLs from markets.json `dataSources` + one of the 13 calculator
kinds) — a few lines, no frozen numbers, no page-specific spec. The market type in
`types.ts` accepts `dataSources` from markets.json; scores of markets can reuse
the same calculator kinds. Path C (`src/firecrawl/client.ts`) now provides
domain-scoped **search** (Firecrawl `/v1/search` restricted to official domains)
plus scrape-with-timestamps, compacted into TXT/CSV attachments; mock mode ships
a recorded discovery fixture. Honest gap: no Wave 2 market exists yet to exercise
the generic path A end-to-end (see Known gaps).

### Fix 2 — the 5 dead source URLs
All five were confirmed dead from this host, then replaced with URLs verified
live (HTTP 200 + expected content) during this session:

| run-1 URL (dead) | replacement (verified live) |
| --- | --- |
| `destatis.de/EN/Press/2026/11/PE26_4xx.html` (404) | `https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html` — "KORREKTUR: Inflationsrate im Oktober 2026 bei +2,8 %", PM Nr. 392, corrected 2026-11-17 |
| BK admin `postvoting-2026-11-26` (error page) | `https://www.stadt-zuerich.ch/de/aktuell/news/2026/stimmbeteiligung.html` — live postal return "beträgt derzeit 39,6 Prozent" (+ gfs.bern survey as second source, see fix list for Wählbarometer) |
| `srg-research.ch/de/wahlbarometer-2026-11-26` (DNS fail) | `https://www.gfsbern.ch/de/news/2-srg-trendumfrage-zur-eidg-abstimmung-vom-29-november-2026/` — 2nd SRG trend survey (SRG SSR commissioned, gfs.bern, published 18.11.2026, field 4–11 Nov, n=13,527): KM 49/46; Teilnahmeabsicht 52% vs 47.3% avg |
| `electografia.es/...` (DNS fail) | `https://www.electografica.com/2026/11/encuesta-data10-261123.html` — the real Electografía domain (electografica.com), Data10 26N tracking, Vox 19,1% / 64 diputados |
| `worldchampionship2026.fide.com/en/match/score/` (DNS fail) | `https://www.fide.com/new-documents/` — official FACT SHEETs ("Match score: 1–1", game colors, results) + `worldchess.com/watch/fide-world-chess-championship-2026` for machine-readable ratings/schedule |

Every URL was re-verified 200 at ~04:15 UTC 2026-11-26 (log excerpts in the
verification section).

### Fix 3 — Go milestone by title
`refreshGoRelease` walks `GET /api.github.com/repos/golang/go/mile
stones?state=all&per_page=100&page=N` until it finds the exact title `Go1.27.5`
and refuses to guess otherwise. Confirmed live: **milestone number 457** (run-1's
305 is Go1.20.4 — verified). Live counts: **14 open / 18 closed** (run-1's
"14 open / 87 closed" was fabricated). Draft
`drafts/2026-11-26-go-1-27-5/note.md` cites number 457 with the #305 bug called
out for the judge's context. Test: `live refresh: go-1-27-5`.

### Fix 4 — Wikipedia count + velocity recomputed
Live siteinfo in this session: **7,269,403 articles** (04:15 UTC;
the QA session-read 7,269,362 at ~10:35 WIB — consistent intraday drift).
Velocity is no longer the fabricated "+43.7/day": the live
`Wikipedia:Size_of_Wikipedia` table gives year-start 7,114,903 and
current-row consistency (net this year ≈ 154,500 over 329 days ≈ **469/day**),
and the refresher computes required/day = (7,275,500 − current)/(cutoff − now)
≈ **426/day**, i.e. required pace < observed pace — the recomputed stance is
**YES** (the run-1 draft's NO stance was based on wrong numbers). Both the
required net and the observed velocity are computed from same-run fetches.
Tests: `live refresh: wikipedia`.

### Fix 5 — gate item count
`gateCandidate` now counts `1 + links.length + files.length <= 3`.
The first end-to-end re-run proved the rule bites: specs carrying 2 links were
rejected (`item budget exceeded: 1 note + 2 links + 1 files = 4 > 3`), exactly the
Delphi-400 case QA feared. All drafts ship **note + exactly 1 link + data.csv**;
the second source stays fully cited (URL + fetchedAt) in the note text and the
CSV `source` rows. Test: `gate: item count`.

### Fix 6 — gate slot counting
`slots = entry.remainingOnMarket − inFlightClaims` where `inFlightClaims` are
only drafts written by the SAME run for the SAME market (tracked per-market) —
`onlineSubmissionCount` and `log.submittedCount` are no longer subtracted
(remainingOnMarket already nets them server-side). Tests:
`gate: slots use remainingOnMarket directly`.

### Fix 7 — hardened submitDraft
`src/submitter.ts` now: re-checks the triple guard; refuses a manifest with
`submittedAt` set; runs terms/limits/entry-state checks inside itself; re-runs
the item/note-size/file-size/link sanity and 2h asOf freshness on exactly what
would be sent; **appends the idempotency key to `submit-attempts.jsonl` BEFORE
the POST** (timeout retry reuses it); waits `timeoutMs: 30 * 60_000` for the
verdict and treats `rejected`/`failed`/`unmatched` as terminal; sends the CSV as
`new File([csv], "data.csv", {type: "text/csv"})`; surfaces and writes back
`verdict/reason/bounty/zeroPayReason/settlementUpTo` to the manifest and updates
the ledger entry (`drafted` → `submitted`). Tests: submitter guard,
already-submitted manifest refusal.

### Fix 8 — terms acceptance as an explicit CLI action
`npm run accept-terms` (`src/cli.ts accept-terms`): live-only, prints the terms
URL, requires the human to type the version string, then calls the SDK's
`acceptTerms(version)` via the client wrapper. In mock mode the client throws —
mock never accepts anything. The pipeline's refusal message now points at the
command instead of a manual curl. Nothing automatic ever runs inside a pipeline.

## HIGH

### Fix 9 — DE CPI figure verified live + note-figure cross-check
The real Oct 2026 VPI numbers (live): **index 126.5 (2020=100), +2.8% YoY,
−0.1% MoM** (PM Nr. 392, corrected 17.11.2026) and Nov 2025 **index 122.7**
(PM Nr. 447) — run-1's "index 118.2 / 115.4 / Indexstand 118,4" was all wrong,
including the GENESIS table number (it is 61111-0004, not 61211-0004).
Recomputed live math: reaching +2.8% YoY in Nov requires only a **−0.288% MoM
print**, i.e. prices can fall on the month and the bar still clears — stance YES
(run-1 said NO from fabricated figures). The note-figure cross-check is a new
verification stage: every pasted figure must have at least one of its numeric
tokens present in the fetched content (comma/dot normalized) or the candidate is
rejected (`figure #N not found in fetched source content`) — a figure typo can
no longer slip through. Tests: figure-typo rejection, de-cpi live figures.

### Fix 10 — api-json/static-html specs verified live too
`verifySources` previously skipped `api-json`/`static-html`; it now verifies
**every** link of the refreshed spec (200 + expect needles), reusing the docs the
refresher fetched in the same run so the shipped link and all model inputs are
cross-checked. Test: `verifySources: api-json links are verified too`.

### Fix 11 — mode-tagged ledger
`EvidenceLog` takes the run mode; every entry is tagged `mode: mock|live`, and a
log instance only ever sees entries of its own mode. Legacy untagged run-1
entries are treated as mock (they were) — they are archived in
`evidence-log-run1-archive.jsonl` and can no longer block or cap anything. Tests:
mock-never-blocks-live, live-now? (mode isolation both ways), legacy untagged =
mock.

### Fix 12 — gate additions
- note length ≤ 8000 chars (`MAX_NOTE_CHARS`),
- file size ≤ 10 MB (`MAX_FILE_BYTES`),
- asOf freshness (asOf within 2h of gate time),
- prediction-market/betting **domain denylist** (delphi.fyi, polymarket, manifold,
  metaculus, kalshi, predictit, oddschecker, betfair, bet365, ...),
- **judge-manipulation phrase linter** (bans "please judge”, "judge in favor",
  "award me", "reward this", "you should", "highest rating", "be generous",
  "deserves the bounty", bookmaker phrasing, ...).

Tests for each rule (see the new gate tests).

### Fix 13 — freshness vs the market's resolution baseline
`marketBaselineTimestamp()` parses the "published strictly after <ts>" baseline
from each market's `resolutionCriteria`. Every source fetch time must sit after
that baseline **when the baseline is already in the past** (stale facts earn $0)
and before the evidence cutoff. For future baselines (event markets like
"release published between Nov 28 and Dec 11"), the rule checks the 2h asOf
freshness instead — a hard fetchedAt > future-baseline would wrongly reject every
pre-window readout; this interpretation is deliberate and documented
(first re-run rejected the bun draft under the naive rule, which surfaced the
distinction). Test: `gate: resolution-criteria freshness`.

### Fix 14 — judge-proof attachments
Notes now open with a **KEY FIGURES** block (figures pasted at the top, before
anything else), all figures repeated inline, and every CSV carries
`source,<url>,<fetchedAt UTC>` rows for every fetched source — the judge gets the
provenance and timestamps in the attachment even though it fetches links once and
truncates long pages. Verified in each written draft (`head` shows the block;
CSV tail shows the source rows).

### Fix 15 — online-submissions check moved before mining
The pipeline calls `listSubmissions({market})` right after the local-cap check
and before any refresh/verify/analysis work; a market already at its account
cap is skipped pre-mining with an explicit report reason
(`online submissions already at account cap (N/3) before mining`).

## MEDIUM

### Fix 16 — "56.8%%" typo
`draft.ts`: `${marketPct}%` → `${marketPct}` for good. The written notes now show
"Market implied P(yes) at snapshot: 56.8%".

### Fix 17 — draftsSkippedNoSpec double-count
The list is computed once at report init from the ranked list; the loop no longer
re-pushes it. (`drafts/index.json` shows each no-spec market exactly once.)

### Fix 18 — agent identity
`resolveConfig` defaults `X-Agent-Id` to **`siera-labs-evidence-miner`**
(was `agent-arena`), reflected in `.env.example` and the feedback-draft curl
samples; override stays available via `X_AGENT_ID`. Test asserts the default.

### Fix 19 — lowercase marketAddress
All ledger comparisons (`forMarket`, `lockedStance`, `hasSignature`,
`draftedCount`, `update`) and `factSignature` normalize addresses with
`toLowerCase()`. Test: case-insensitive match across mixed-case entries.

### Fix 20 — invented header removed
`X-Delphi-Item-Budget` is gone from `submitter.ts`; the SDK client is constructed
with only `X-Agent-*` (mapped by the SDK) and the SDK-managed Idempotency-Key.

## LOW

### Fix 21 — live SDK smoke test documented
`npm run plan -- --mode=live` is the documented, no-writes, read-only smoke test:
it exercises limits → terms → markets.json → entry-state for all markets and
prints the eligibility table, before any live draft/submit is attempted. Documented
in README ("Live mode", step 1) and in the CLI usage text. Not executed in this
session for lack of a key (Known gaps).

---

## Verification evidence (commands run in this session)

1. `npm test` → **42 tests, 42 pass, 0 fail** (run-1 had 15; the 15 original test
   intents still pass, 27 new tests cover the new rules and refreshers).
2. `npx tsc --noEmit` → exit 0.
3. `npm run mock` (fresh ledger) → 27 markets seen, 23 eligible, **10 candidates
   mined, 0 mining failures, 0 gate rejects, 10 drafts written**:
   de-cpi-nov, ch-cpi-nov, ietf-mna-ioam-discuss, fide-game8, go-1-27-5,
   wikipedia-articles, bun-release, ch-vote-turnout, ch-war-materiel, es-vox-seats.
4. Immediate `npm run mock` re-run → **0 drafts written**, all 10 deduped
   (`duplicatesSkipped`), 0 gate rejects — the dedupe path works.
5. `npm run plan` (mock) → eligibility table, no writes.
6. `python3 python/mathgen.py analyze` exercised via every draft's CSV in step 3
   (13 kinds; the 4 new kinds also unit-tested, incl. the exact-3^6 enumeration
   and its Elo-mirrored symmetry).

### Live values recorded from public sources (no key needed), fetched this session

- Wikipedia siteinfo: **7,269,403 articles** (also re-read later: 7,269,406 —
  rising during the session); `Wikipedia:Size_of_Wikipedia` 2026-01-01 row:
  **7,114,903** (net YTD ≈ 154,500 ⇒ ≈469/day observed vs ≈426/day required).
- GitHub `golang/go` milestones: Go1.27.5 = **number 457** (BY TITLE), **14 open
  / 18 closed**; #305 confirmed = Go1.20.4. go.dev: go1.27.4 released
  **2026-11-10** (gaps 37/11/22 days for the 1.27.x line).
- Destatis: Oct 2026 VPI **+2.8% YoY, index 126.5 (2020=100), −0.1% MoM**
  (PM Nr. 392/KORREKTUR); Nov 2025 **+2.3% YoY, index 122.7** (PM Nr. 447).
- BFS: LIK Oct 2026 **101.7 (Dec 2025=100), +1.5% YoY, +0.2% MoM**; Nov 2025
  **107.0 (Dec 2020=100)**; Dec 2025 **106.9 (Dec 2020=100)** — chained Nov 2025
  ≈ 100.094 on the current base; required Nov MoM for ≥1.6% YoY ≈ **−0.005%**.
- Stadt Zürich: postal participation **39.6%**; gfs.bern 2nd SRG survey: KM
  **49% yes / 46% no**, Teilnahmeabsicht **52% vs 47.3%** long-term average.
- Electografía (electografica.com): Vox **19.1% / 64 seats** (Data10, 23.11).
- FIDE: official FACT SHEET game 2: **½–½, match score 1–1**; game 3 colors
  (Sindarov White, 2nd time); worldchess.com metadata: **Sindarov 2780 /
  Gukesh 2712**, 14 rounds, first-to-7.5.
- Datatracker: draft-ietf-mpls-mna-ioam-18 ballot **open, 1 Yes (Jim Guichard),
  13 No Record, 0 DISCUSS, "Needs 9 more YES or NO OBJECTION positions to pass"**.
- oven-sh/bun releases API: **bun-v1.4.5 published 2026-11-19** (gaps
  14/2/10/9/20/23/10/23/99/15/1/35/12/28 days over the live list ⇒ 7/14 window hits).
- nodejs.org/dist/index.json: latest v27.0.0-alpha.0.1.1 (2026-11-16); v26 line
  v26.13.1 (calculator exercised in tests; the Node market is outside the 30–70%
  odds band so it does not draft).
- All replacement URLs re-checked HTTP **200** at ~04:15 UTC.

## Known gaps (things not verifiable without keys or new data)

1. **`npm run plan -- --mode=live` (fix 21) not executed end-to-end** — requires
   `DELPHI_API_ACCESS_KEY`, which is not on this droplet. The code path is the
   read-only pipeline used by mock `plan` plus the SDK client; run it first when
   the key arrives.
2. **submitDraft path never POSTs** — by design (triple guard + no live submit in
   this build). The write-back/verdict-surfacing code is SDK-typed and unit-level
   tested (guards, manifest refusal) but unexercised against the real API.
3. **Firecrawl live integration** — the domain-scoped search/scrape client is
   implemented but unkeyed here (Path C drafts are not required for Wave 1; the
   current Wave 1 Path-3 sources are direct-fetchable static pages).
4. **Model assumptions remain assumptions** — the 10-year November MoM
   distributions, the intention→final offset (1.5pp, sd 2pp), the KM
   poll→final OLS history (8 prior votes), the comparable-IETF-draft base rate
   (9/12), the FIDE draw share (75%), seat-projection sd and daily-velocity sd
   are clearly labeled in every note. They are not live-fetched facts; re-QA
   should sanity-check them, replacing any with fetchable series where possible.
5. **Freshness rule interpretation** (fix 13): for markets whose resolution
   baseline is a future window-start (e.g. Bun's "between Nov 28 and Dec 11"),
   the gate enforces same-run freshness rather than fetchedAt > baseline, for the
   reasons documented under fix 13. If QA prefers the hard rule, it is a
   one-line change in `gate.ts`.
6. **Congreso.es seat apportionment link** returned 403 — dropped; the Electografía
   tracker's own seat projection is used instead.
7. Live figures are a moving target: e.g. Zürich's postal return was 27.7% earlier
   on Nov 25/26 and 39.6% at fetch time. Mock drafts pin the recorded snapshot
   (timestamps in each CSV); live runs re-pull and recompute automatically.
8. `evidence-log-run1-archive.jsonl` preserves the run-1 mock ledger for QA; the
   run-1 drafts under `drafts/` were overwritten by the re-mined round-2 drafts
   (they were QA-verdict "do not submit" anyway).
