# agent-arena

Delphi Agent Arena (Evidence Mining) submission agent — **SIERA Labs** build.

Mines dated, sourced evidence for live Wave markets, runs it through a strict
anti-rejection gate, and writes QA-ready submission drafts under `drafts/`.
Mock mode runs the whole pipeline offline with fixtures. Live mode talks to the
real Delphi API with the official SDK. **This build never posts a real
submission** — drafts only (see Safety rails).

## Quick start (mock mode, $0, offline)

```bash
npm install
npm run mock
```

Output:

- `drafts/<date>-<topic>/note.md` — the exact 4-part dated note that would be submitted
- `drafts/<date>-<topic>/data.csv` — compact machine-readable series backing the note
- `drafts/<date>-<topic>/manifest.json` — links, files, stance, reserved idempotency key
- `drafts/index.json` — run report: which markets passed/failed the filter and why
- `drafts/feedback/` — auto-drafted entries for the feedback.delphi.fyi $250 bounty pool
- `evidence-log.jsonl` — append-only ledger: fact signatures (dedupe) + stance lock

The first `npm run mock` writes the 10 Wave 1 drafts. Running it again writes
nothing: every candidate's fact signature is already in `evidence-log.jsonl`
(repeats earn nothing, so they are refused).

```bash
npm test           # unit tests: filter, gate, dedupe, stance lock, submit guard
npm run plan       # no writes: eligibility + ranking table for all markets
```

## Live mode (once keys exist)

Credentials come from environment variables only. Never hardcoded, never
committed. `.env.example` documents the names.

```bash
export DELPHI_API_ACCESS_KEY=...   # Mainnet API key from api-access.delphi.fyi
export FIRECRAWL_API_KEY=...        # for scraping local-language sources
export DELPHI_WALLET=0x...           # wallet the key was issued to (feedback drafts)
npm run live                        # drafts only, from live data
```

Behavior beyond mock mode:

- `GET /v1/limits` is checked first; the run aborts if the hour is exhausted.
- `GET /v1/terms`: in live mode the run refuses to research until the account
  has accepted the current terms version (accept manually via
  `POST /v1/terms/acceptance` after reading them — the agent never accepts for you).
- Entry state, markets list and odds come from the live API; mock fixture data
  in specs is refreshed before use (see Adding a market).
- Live submitting itself is triple-guarded (below) and is **not enabled in this
  build**; Sekar's QA gates that step.

## Safety rails

1. **No real submission**: `submitDraft()` requires `--mode=live` AND
   `LIVE_SUBMIT=1` env AND `--live-submit` flag together. Mock runs never hold
   a key. The pipeline in this build never passes `--live-submit`.
2. **Both-sides lock**: settlement value nets to $0 per person per market, so
   once a stance is logged for a market, the opposite stance is refused.
3. **Dedupe**: fact signatures (market + headline + figures) are logged in
   `evidence-log.jsonl` and refused on re-run — no repeats, ever.
4. **Per-market cap**: max 3 drafts per market (1 if the entry state reports
   Restricted tier), enforced locally before researching.
5. **Known-fact check**: evidence within 2.5pp of the market implied probability
   is presumed priced and rejected ("repeats/known facts earn nothing").
6. **Anti-`unverifiable`**: every scraped link must still contain the pasted
   figures at run time; all key figures are copied inline into the note and a
   CSV is attached, so nothing depends on JS-rendered or bot-walled pages.
7. **Banned content**: bookmaker odds, opinion and betting-market references
   are refused by the gate.
8. **No secrets in repo**: only env var names appear in code and docs.
9. **The agent never signs**: API key only, no private key anywhere. The entry
   wallet (Gensyn Mainnet, Chain ID 685689) only receives USDC.e.

## Item budget per submission

Per the competition guide, a submission holds up to 3 items in total: a note,
links, and files. Each draft is exactly: **note (1) + links (1) + data.csv (1)**.
If the API turns out to count links individually, drop the second link in the
manifest before live submit; the note's inline figures make either link
sufficient.

## How it works

```
src/cli.ts                    run | plan
src/pipeline.ts               orchestration + run report
src/config.ts / env.ts        mode resolution, env passthrough
src/delphi/client.ts          SDK EvidenceClient wrapper (live) / fixtures (mock)
src/delphi/fixtures.ts        mock: markets snapshot (real Wave 1 list), entry
                              states, limits, terms + deliberate edge cases
src/filter.ts                 market picking: canSubmit, cutoff > 6h, judgment
                              pot > 0, odds 30-70%, ranking by pot then path
src/miners/specs.ts           research spec per market (the 10 first drafts)
src/miners/mine.ts            source verification + python bridge
src/gate.ts                   strict pre-submit gate
src/evidence-log.ts           dedupe + stance-lock ledger (jsonl)
src/draft.ts                  4-part dated note + manifest writer
src/feedback.ts               auto-drafted feedback.delphi.fyi entries
src/submitter.ts              triple-guarded live submit (not enabled here)
python/mathgen.py             the math: 9 analysis kinds, writes the CSV,
                              prints derived stats as JSON
```

Mining paths (priority order, mirrored in `miningPath` on each spec):

1. **Arithmetic on official series** — base-effect YoY decompositions (Destatis VPI, FSO CPI)
2. **Machine-readable trackers** — Wikipedia API, GitHub, IETF Datatracker, FIDE, go.dev
3. **Non-English primary sources** — DE/FR/ES scraping via Firecrawl (BK.admin, SSR, Electografia)

Each draft's note is exactly four parts, dated: (1) the dated fact with pasted
figures, (2) sources and how they verify, (3) method/derivation, (4) forecast
comparison versus the market's implied probability, single stance.

## Adding a market

1. Get the market address from `markets.json` (or `npm run plan`).
2. Add a `ResearchSpec` in `src/miners/specs.ts`:
   - `topic`, `miningPath` (1|2|3), `langs`
   - `headline`: the dated fact, figures inline — must NOT be a priced-in headline
   - `figures`: >= 2 key figures, pasted verbatim from the source
   - `links`: 1-2 links; for scraped links add `expect`: substrings the fetched
     content must contain (the anti-unverifiable check)
   - `analysis`: one of the 9 kinds in `python/mathgen.py` (`cpi_base_effect`,
     `turnout_projection`, `poll_margin_regression`, `dhondt_seats`,
     `ballot_flag_snapshot`, `markov_lead`, `threshold_velocity`,
     `release_gap_cdf`, `blocker_clearance`) with fresh `params` from the
     current sources. If live, replace the snapshot values in `params` —
     fixture numbers are from 2026-11-26 and go stale.
3. For mock mode, add the page content to `SCRAPE_FIXTURES` in
   `src/firecrawl/client.ts` (deterministic QA); for a new analysis kind, add
   the function to `python/mathgen.py` and its union member in `src/types.ts`.
4. `npm run mock` (or `npm run live`) — the market must pass the filter and the
   candidate must pass the gate before a draft is written.

## For QA (Sekar)

- Reproduce: `npm install && npm run mock`.
- Everything lands in `drafts/`; `drafts/index.json` documents every skip and
  reject reason for the run.
- Mock entry-state edge cases prove the filter: Korea budget market (cap
  reached), ARC-AGI-3 (drained judgment pot), China PPI and Node.js markets
  (odds outside 30-70%), Turkey CPI (Restricted-tier warning).
- The submit path is inert: `src/submitter.ts` refuses without all three guard
  conditions, and no code in this build calls it.
- Credentials: none required for mock. Set keys only for `npm run live`.
