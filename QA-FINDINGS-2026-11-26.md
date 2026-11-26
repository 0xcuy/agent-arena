# QA Findings — Agent Arena evidence-mining agent (Vibe build, 26 Nov 2026)

QA by Sekar, hands-on: code read on the VPS copy, tests re-run by Sekar
(15/15 pass, typecheck exit 0), source URLs + API figures checked LIVE via
Firecrawl 26 Nov ~10:35 WIB. Fable is reviewing the same build against its
plan in the Slack thread; this file is Sekar's findings.

## What works (verified)
- Plumbing matches Fable's plan: limits → terms → markets/entry-state →
  filter/rank → dedupe → per-market cap → verifySources → analysis (Python) →
  gate → draft → ledger → feedback drafts.
- Triple guard on submit works (mode=live AND LIVE_SUBMIT=1 AND --live-submit
  AND key); tests 14–15 cover it; no code path calls submit in this build.
- Dedupe + stance lock work (re-run writes 0 drafts; evidence-log.jsonl has
  10 entries with distinct signatures).
- Gate logic sound (slots, stance lock, dedupe, links, ≥2 figures, banned
  content, 2.5pp edge, item budget, stance-direction sanity).
- mathgen.py math correct given inputs (DE CPI re-checked by hand: required
  MoM +0.365%, blended P(yes) ≈ 0.097).
- Market fixture is the real Wave 1 list (27 markets, real addresses/odds/
  cutoffs/pots/resolution criteria).
- README is honest about staleness ("fixture numbers are from 2026-11-26
  and go stale").

## Findings (severity order)

### CRITICAL
1. **No live mining exists.** All 10 specs are frozen Nov-26 snapshots
   (hardcoded figures/URLs/params in specs.ts + SCRAPE_FIXTURES in
   firecrawl/client.ts). Live mode only re-verifies the same hardcoded
   figures; it never fetches fresh numbers — no Firecrawl search, no API
   polling for path-2 trackers, no param refresh. Drafts go stale as days
   pass; Wave 2 markets have no specs at all. Fix: implement the live miner
   per the plan's 3 paths (Vibe builds it).
2. **5 source URLs are dead (verified live).** Destatis PE26_4xx.html → 404;
   BK admin postvoting URL → error page; SRG wahlbarometer, Electografia,
   FIDE match page → Firecrawl scrape returns nothing (unreachable). Live
   verifySources will reject those 5 drafts, so they never ship until the
   URLs are replaced with real ones.
3. **Go milestone number is wrong.** specs.ts uses
   api.github.com/repos/golang/go/milestones/305 — the live API returns
   title "Go1.20.4", NOT Go1.27.5. The "14 open / 87 closed" figures are
   not from the Go1.27.5 milestone. Fix: find the real Go1.27.5 milestone
   number, re-pull counts.
4. **Wikipedia count is wrong.** Spec says 7,271,234 (Nov 25 snapshot);
   live siteinfo API just returned 7,269,362 — 1,872 lower (counts only
   rise ~44/day, so the spec number cannot be right for Nov 25). Required
   net becomes 6,138 (438/day), not 4,266 (304/day). Stance (NO) still
   holds, but the figures are wrong. Fix: re-pull live, recompute.

### HIGH
5. **DE CPI figure/source mismatch.** Note says VPI Oct 2026 index 118.2;
   the spec's own source fixture says "Indexstand 118,4" (and the expect
   needle is 118,4). One of them is wrong; neither is verified against the
   real Destatis page. Deeper gap: verifySources checks expect needles,
   never the note's pasted figures — a figure typo slips through the gate.
   Fix: verify the real Oct VPI from Destatis/GENESIS, make note/fixture/
   needles agree, extend verification to the note's figures.
6. **api-json/static-html specs are never verified in live mode.**
   verifySources skips them, so CH CPI, IETF, Wikipedia, Bun drafts ship
   on trust with unverified figures. Fix: add live API checks for those
   (siteinfo, GitHub API, Datatracker).
7. **Mock/live ledger not separated (Fable's flag, verified by Sekar).**
   The mock run appended 10 "drafted" entries to the shared
   evidence-log.jsonl. In a live run, `hasSignature` matches them (status
   != "rejected") → all 10 markets skipped as duplicates; `draftedCount`
   counts them toward the per-market cap (1/3 used); `lockedStance`
   treats mock drafts as locking the stance. Fix: separate ledgers (or
   mode-tag entries and exclude mock ones in live mode) before the first
   live run — and re-mine from live data so signatures are fresh anyway.

### MEDIUM
7. **"56.8%%" typo in every note.** draft.ts: marketPct already ends with
   "%", then the template adds another "%". Fix: `${marketPct}%` →
   `${marketPct}`.
8. **draftsSkippedNoSpec double-count (latent).** pipeline.ts assigns
   noSpecMarkets at report init AND pushes again in the loop. Did not
   trigger this run (maxDrafts=10 broke the loop first) — fix before
   raising maxDrafts.
9. **Generic agent identity.** Defaults: agentId "agent-arena", harness
   "mistral-vibe", model "unknown". Set X_AGENT_ID to a SIERA Labs
   identity so results show under our name.

### LOW
10. **Invented X-Delphi-Item-Budget header** in submitter.ts — likely
    ignored by the API; verify or remove.
11. **Live SDK wiring is untested.** Mock tests cannot cover the real
    EvidenceClient calls. Before any live draft/submit, run `npm run plan`
    in live mode (no writes) as a smoke test.

## Verdict
Plumbing: PASS. Data layer: FAIL — do not submit any of the 10 drafts as-is.
The agent needs the live miner (fix 1) + corrected sources/figures (fixes
2–5) + verification coverage (fix 6), then a fresh live re-mine + re-QA
before the first submission.
