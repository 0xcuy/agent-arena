# Build Brief — Agent Arena Evidence Mining agent (SIERA Labs)

You are the builder (Mistral Vibe CLI). Fable did the research; this brief is the full
plan from Fable's research (Slack thread, 26 Nov 2026). Sekar is reviewer + QA — post
the repo path + how to run it when done; do NOT submit anything real.

## Competition (verified)
- Gensyn Agent Arena: Evidence Mining (Delphi), DoraHacks. Mining window opened
  25 Nov 2026 17:00 UTC, closes 11 Dec 2026 17:00 UTC; winners 16 Dec.
- $7,250 USDC pool (1st $3,000 / 2nd $2,000 / 3rd $1,000 / 5x $250 feedback bounties)
  PLUS per-evidence USDC rewards (judgment within minutes, USDC.e ~24h later;
  settlement rewards when markets settle).
- Right now: 27 Wave 1 markets live, 819 entrants, #1 at $6.07, all $30/market
  settlement pots ($810+ Wave 1) still open.
- Rules: 3 submissions per agent per market, 3 files per submission. No editing or
  retracting. Judge fetches cited URLs, compares forecasts with/without the
  submission. Known facts earn nothing; repeats earn nothing; evidence for both
  sides of one market cancels out in the ranking. Prize minimum: 10+ judged
  submissions across 3+ markets. KYC/sanctions screening for prizes (Indonesia eligible).
- Submission = short dated note + links + up to 3 files on one market.
- Endpoints (from the agent guide): GET /v1/limits, markets list, entry-state,
  GET /v1/submissions, GET /v1/terms. Submit with Idempotency-Key header and
  X-Agent-* headers (agent ID, harness, model). Retry-After on polling.
- SDK: @gensyn-ai/gensyn-delphi-sdk (EvidenceClient). Starter agent + agent guide at
  https://competition.delphi.fyi/participate

## Agent design (end-to-end, $0)
- Wraps the Delphi SDK EvidenceClient + Firecrawl (web scraping) + local Python
  math/CSV generator.
- Pipeline: GET /v1/limits + markets.json + entry-state (live remaining judgment
  pot & slots) + evidence-log.jsonl dedupe → mine via 3 paths (1) official-stats
  arithmetic/base-effect math, (2) machine-readable primary trackers (GitHub,
  IETF Datatracker, Wikipedia API, parliamentary dockets), (3) local-language
  Firecrawl scraping (DE/FR/ES/JA/KO/TR) → strict quality/anti-rejection gate
  (stay Standard tier: 3 subs/market vs Restricted 1/market) → submit 4-part
  dated note + links[] + compact CSV/PNG (max 3 items total, Idempotency-Key,
  X-Agent-* headers) → poll with Retry-After → auto-draft feedback.delphi.fyi
  bug/friction reports (5x $250 pool).
- Market-picking filter: canSubmit true, cutoff > 6h, high remaining judgment pot
  (out of $20), odds 30%-70%. Prioritize (1) arithmetic on official series,
  (2) machine-readable trackers, (3) non-English primary sources, (4) fresh wave
  drops every few days.
- NEVER submit: bookmaker odds, known headlines, unattached JS/paywall links, or
  both sides of one market (settlement value nets to $0).
- Risks: Restricted-tier demotion (strict pre-submit verification gate, never spam);
  `unverifiable` on JS/bot-blocked sites (judge has no browser/JS — always attach
  compact CSV/PNG/PDF + paste key figures at top of note + links[]); empty
  judgment pot / self-hedging / duplicates (check entry-state before researching,
  lock one directional stance per market in evidence-log.jsonl, avoid headline racing).

## Credentials (NOT available yet — build for them, do not wait for them)
- DELPHI_API_ACCESS_KEY (Mainnet API key, user creates at api-access.delphi.fyi)
  and FIRECRAWL_API_KEY come from environment variables ONLY. Never hardcode,
  never commit secrets. If a key is missing, run in MOCK mode: all external calls
  stubbed, full pipeline runs locally, drafts written to disk for QA.
- Entry wallet: Gensyn Mainnet Chain ID 685689, receives USDC.e. No private key
  in this repo, ever. The agent never signs anything — API key only.

## Deliverable (definition of done)
- Working code in /root/agent-arena on this droplet (Node/TypeScript for the SDK
  client; Python for the math/CSV generator — or the cleanest split you judge,
  keep it simple).
- README: how to run mock mode, how to run live (once keys are set), how to add
  a market.
- Mock-mode end-to-end run producing the FIRST 10 draft submissions below as
  dated notes + CSVs under /root/agent-arena/drafts/, ready for Sekar to QA.
- evidence-log.jsonl dedupe + entry-state check working in mock mode.
- No real submission to Delphi in this build. No repo created yet — keep it local
  on the droplet until Sekar says to push.

## First 10 submissions (live Wave 1 markets)
1. German Nov CPI ≥ 2.8% YoY (cutoff Nov 29 08:00 UTC, 56.8%) — Destatis VPI
   base-effect MoM math + 10-yr Nov seasonal rate + CSV.
2. Swiss Vote Turnout ≥ 50.0% (Nov 28 06:00, 51.6%) — cantonal early postal-ballot
   return rates (DE/FR) vs prior votes + CSV.
3. Swiss War Materiel Act Amendment (Nov 28 06:00, 54.9%) — late cantonal/SRG
   regional wave breakdown (DE/FR).
4. Spain Election: Vox ≥ 60 Seats (Nov 28 06:00, 48.3%) — D'Hondt provincial seat
   simulation from Spanish-language tracking polls + CSV.
5. Swiss Nov CPI ≥ 1.6% YoY (Dec 1 07:00, 47.8%) — FSO index base-effect &
   Nov mortgage/rent-index math + CSV.
6. IETF draft-ietf-mpls-mna-ioam DISCUSS (Dec 2 12:00, 32.1%) — Datatracker
   ballot state & Directorate review flags snapshot.
7. FIDE Game 8: Sindarov > Gukesh (Dec 2 13:00, 63.2%) — live match score +
   White/Black color-allocation Markov model + CSV.
8. English Wikipedia ≥ 7,275,500 articles (Dec 9 11:00, 56.3%) — siteinfo API
   30d/90d net daily velocity projection + CSV.
9. oven-sh/bun bun-v1.4.6+ (Dec 10 00:00, 54.0%) — GitHub release cadence
   (last 15 tags) & unreleased commit/PR count + CSV.
10. Go 1.27.5 on go.dev by Dec 8 (Dec 7 23:59, 61.3%) — golang/go Go1.27.5
    milestone open blockers + monthly minor release schedule CSV.

## Day-by-day (for context, not your schedule)
- Nov 26: setup + build + first 10. Nov 27: calibrate from judge rationales.
  Nov 28–Dec 3: Dec 1–5 cutoffs + Wave 2 drops + first feedback entries.
  Dec 4–10: Dec 6–10 cutoffs + audit early settlements. Dec 11 17:00 UTC: final sweep.
