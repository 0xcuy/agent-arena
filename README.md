# agent-arena

Delphi Agent Arena (Evidence Mining) submission agent — **SIERA Labs** build (round 2).

Mines dated, sourced evidence for live Wave markets, runs it through a strict
anti-rejection gate, and writes QA-ready submission drafts under `drafts/`.
Mock mode runs the whole pipeline offline against recorded snapshots of real
HTTP-200 fetches. Live mode fetches the same sources fresh over the network and
recomputes every figure in-run. **This build never posts a real submission** —
drafts only (see Safety rails).

## Round-2 architecture (live miner)

Run-1 used frozen Nov-26 specs. Round 2 replaces that data layer entirely:

```
src/miners/live/sources.ts       live fetch layer: HTTP 200 required per source,
                                 fetchedAt < 2h enforced in live mode; mock mode
                                 serves recorded snapshots of real fetches
                                 (fixtures.json) and FAILS LOUDLY on any URL
                                 without a fixture — nothing is ever invented
src/miners/live/refreshers*.ts   per-topic refreshers: parse live figures,
                                 recompute analysis params, build headline +
                                 expect-needles from the fetched content
src/miners/live/refreshers.ts    seeds + registry: per market, source URLs +
                                 market constants + stated assumptions
src/miners/live/fixtures.json    recorded snapshots of real HTTP-200 fetches
                                 taken 2026-11-26 (see FIX-REPORT for provenance)
src/gate.ts                      strict pre-submit gate (item count, slots as
                                 remainingOnMarket, note length, file size,
                                 freshness, domain denylist, judge-steering linter)
src/evidence-log.ts              mode-tagged dedupe + stance-lock ledger
src/submitter.ts                 triple-guarded hardened submit (not invoked here)
src/miners/mine.ts               verifySources: EVERY link verified, plus a
                                 note-figure cross-check against fetched content
python/mathgen.py                13 analysis kinds (incl. cpi_required_mom,
                                 match_lead_elo, seat_threshold, turnout_threshold)
```

Zero-hallucination invariant: a number or URL only enters a note if it was
extracted or computed from an HTTP-200 fetch made in the SAME run, fresher than
2 hours. Model assumptions (base rates, seasonal MoM distributions, draw shares)
are labeled as stated assumptions in the note and never presented as live facts.
A mining failure (source down, page restructured, figure missing) skips the
market — the run never falls back to frozen numbers.

## Quick start (mock mode, $0, offline)

```bash
npm install
npm test        # 42/42
npm run mock
```

Output:

- `drafts/<date>-<topic>/note.md` — the exact 4-part dated note that would be submitted
- `drafts/<date>-<topic>/data.csv` — compact machine-readable series backing the note,
  with one `source,<url>,<fetchedAt UTC>` row per fetched source
- `drafts/<date>-<topic>/manifest.json` — links, files, stance, reserved idempotency key
- `drafts/index.json` — run report: every skip, mining failure and gate reject with reasons
- `drafts/feedback/` — auto-drafted entries for the feedback.delphi.fyi $250 bounty pool
- `evidence-log.jsonl` — append-only ledger: fact signatures (dedupe) + stance lock,
  mode-tagged (mock entries never block live runs and vice versa; run-1 entries are
  archived in `evidence-log-run1-archive.jsonl`)

The first `npm run mock` writes the 10 Wave 1 drafts from the recorded live
snapshots (figures as of 2026-11-26, listed in FIX-REPORT.md). Running it again
writes nothing: every candidate's fact signature is already in the ledger.

## Live mode (once the key exists)

Credentials come from environment variables only. Never hardcoded, never
committed. `.env.example` documents the names.

```bash
export DELPHI_API_ACCESS_KEY=...   # Mainnet API key from api-access.delphi.fyi
export FIRECRAWL_API_KEY=...        # for Path C discovery/scraping (optional)
export DELPHI_WALLET=0x...          # wallet the key was issued to (feedback drafts)

# 1. LIVE SDK SMOKE TEST FIRST — no writes, no mining, read-only API calls:
npm run plan -- --mode=live
#    It exercises limits -> terms -> markets.json -> entry-state for every market
#    and prints the eligibility table. If this fails, nothing else runs.

# 2. Drafts from LIVE data (still no submit):
npm run live
```

Behavior beyond mock mode:

- `GET /v1/limits` is checked first; the run aborts if the hour is exhausted.
- `GET /v1/terms`: a live run refuses to research until the account has accepted
  the current terms. Acceptance is a separate, explicit, human-in-the-loop step —
  never automatic inside a run:

  ```bash
  npm run accept-terms     # live only; prints the terms URL, asks you to type the version
  ```

- Every market with a research seed is re-mined from live HTTP-200 fetches in-run;
  the report lists any `live mining failures` with the parse/unreachable reason.
- Live submitting itself is triple-guarded (below) and is **not enabled in this
  build**; Sekar's QA gates that step.

## Safety rails

1. **No real submission**: `submitDraft()` requires `--mode=live` AND
   `LIVE_SUBMIT=1` env AND the `--live-submit` flag together, re-checks
   terms/limits/entry-state/gate inside itself, refuses a manifest whose
   `submittedAt` is set, logs the idempotency key to `submit-attempts.jsonl`
   BEFORE the POST (timeout retries reuse it), waits up to 30 minutes for the
   verdict, and writes submissionId + verdict/reason/bounty/zeroPayReason/
   settlementUpTo back to the manifest and ledger. The CSV is sent as a File
   named `data.csv`. No code path in this build passes `--live-submit`.
2. **Both-sides lock**: once a stance is logged for a market, the opposite
   stance is refused.
3. **Dedupe**: fact signatures (market + headline + figures) are logged and
   refused on re-run — no repeats, ever.
4. **Per-market cap**: `remainingOnMarket` is used directly (it already nets
   the account's submissions); only in-flight claims written by the SAME run
   may be subtracted and only when batching.
5. **Known-fact check**: evidence within 2.5pp of the market implied
   probability is presumed priced and rejected.
6. **Anti-`unverifiable`**: every link (scraped, static-html AND api-json) must
   still contain the pasted figures at run time, and every note figure must
   appear in the fetched content (decimal comma/dot normalized). All key
   figures are pasted at the TOP of the note and repeated in the CSV with each
   source URL + UTC fetch timestamp, so nothing depends on JS or bot-walled
   pages.
7. **Item budget counted exactly like the API**: `1 + links.length +
   files.length <= 3`. Every draft ships note + exactly one link + one
   `data.csv`.
8. **Banned content**: bookmaker/prediction-market domains, and
   judge-steering phrases, are refused by the gate.
9. **Note/attachment limits**: note <= 8000 chars, each file <= 10 MB.
10. **Freshness**: `asOf`/fetch times must be < 2h old; source fetches must sit
    after each market's resolution baseline when that baseline is already in
    the past (stale facts earn $0; for future-window criteria the fetch is the
    live readout the event will follow).
11. **No secrets in repo**: only env var names appear in code and docs.
12. **The agent never signs**: API key only, no private key anywhere.

## Agent identity

Submissions would carry `X-Agent-Id: siera-labs-evidence-miner` (default; override
with `X_AGENT_ID`), `X-Agent-Harness: mistral-vibe` (override `X_AGENT_HARNESS`),
and `X-Agent-Model` (override `X_AGENT_MODEL`).

## How it works

```
src/cli.ts                    run | plan | accept-terms
src/pipeline.ts               orchestration + run report (online-submission check
                              BEFORE mining; live refresh; verify; analysis; gate)
src/config.ts / env.ts        mode resolution, env passthrough
src/delphi/client.ts          SDK EvidenceClient wrapper (live) / fixtures (mock)
src/delphi/fixtures.ts        mock: markets snapshot (real Wave 1 list), entry
                              states, limits, terms + deliberate edge cases
src/filter.ts                 market picking: canSubmit, cutoff > 6h, judgment
                              pot > 0, odds 30-70%, ranking by pot then path
src/miners/live/*             the live miner (see round-2 architecture above)
src/gate.ts                   strict pre-submit gate
src/evidence-log.ts           mode-tagged dedupe + stance-lock ledger (jsonl)
src/draft.ts                  4-part dated note + manifest writer
src/feedback.ts               auto-drafted feedback.delphi.fyi entries
src/submitter.ts              triple-guarded hardened live submit (not enabled here)
src/firecrawl/client.ts       Path C: domain-scoped Firecrawl search + scrape
python/mathgen.py             the math: 13 analysis kinds, writes the CSV
                              (with per-source rows), prints derived stats as JSON
```

Mining paths (priority order, mirrored in each seed's `miningPath`):

1. **Arithmetic on official series** — base-effect YoY decompositions (Destatis VPI, BFS LIK, incl. cross-base chaining)
2. **Machine-readable trackers** — Wikipedia siteinfo, GitHub milestones/releases, go.dev, Datatracker, FIDE factsheets, worldchess event metadata, nodejs.org/dist
3. **Non-English primary sources** — DE/FR/ES scraping (Stadt Zürich, gfs.bern, Electografía) via direct fetch or Firecrawl

Each draft's note: key figures at top, the market, sources with fetchedAt, the
dated fact, method, stated assumptions, single-stance forecast comparison.

## Adding a market (seed, no frozen numbers)

1. Get the market address from `markets.json` (or `npm run plan`).
2. Add a `ResearchSeed` in `src/miners/live/refreshers.ts`:
   - `kind`: one of the registered refreshers (`de-cpi`, `ch-cpi`, `ch-turnout`,
     `ch-war-materiel`, `es-vox`, `ietf-ballot`, `fide-match`, `wikipedia`,
     `bun-releases`, `go-release`, `node-releases`) — or add a new refresher in
     `refreshers-part1/2.ts` parsing a new source shape.
   - `market`: market-definition constants only (thresholds, windows, target
     counts) — never world facts.
   - `assumptions`: stated model inputs (seasonal distributions, base rates),
     surfaced in the note as assumptions, never as live facts.
   - `sources`: the verified source URLs. Each MUST return HTTP 200 with the
     expected content; anything else fails the run for that market.
3. For mock mode, record the fixture: `src/miners/live/fixtures.json` (map of
   URL -> fetched text/JSON). Do not invent content — a missing fixture is a
   hard failure by design.
4. `npm run mock` (or `npm run live`) — the market must pass the filter and the
   candidate must pass the gate before a draft is written.

## For QA (Sekar + Fable)

- Reproduce: `npm install && npm test && npm run mock && npm run plan`.
- Everything lands in `drafts/`; `drafts/index.json` documents every skip,
  mining failure and reject reason for the run.
- Mock entry-state edge cases prove the filter: Korea budget market (cap
  reached), ARC-AGI-3 (drained judgment pot), China PPI and Node.js markets
  (odds outside 30-70%), Turkey CPI (Restricted-tier warning).
- The submit path is inert: `src/submitter.ts` refuses without all three guard
  conditions (and refuses already-submitted manifests), and no code in this
  build calls it.
- Credentials: none required for mock. Set keys only for `npm run plan -- --mode=live`
  (read-only live smoke test) and `npm run live`.
- `FIX-REPORT.md` documents all 21 round-2 fixes with verification evidence and
  known gaps.
