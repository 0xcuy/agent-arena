Evidence note — 2026-11-26 (all times UTC)

Market: Will oven-sh/bun publish a GitHub release tagged bun-v1.4.6 or later between Nov 28 and Dec 11, 2026 (UTC)?
Market address: 0x921e39354e4bfc18251ad1b1c80eec1a3940ab82 — evidence cutoff 2026-12-10T00:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- Past 15 oven-sh/bun releases (live from the API): bun-v1.4.5 @ 2026-11-19; bun-v1.4.4 @ 2026-10-22; bun-v1.4.3 @ 2026-10-10; bun-v1.4.2 @ 2026-09-05; bun-v1.4.1 @ 2026-09-04; bun-v1.4.0 @ 2026-08-20; bun-v1.3.14 @ 2026-05-13; bun-v1.3.13 @ 2026-04-20; bun-v1.3.12 @ 2026-04-10; bun-v1.3.11 @ 2026-03-18; bun-v1.3.10 @ 2026-02-26; bun-v1.3.9 @ 2026-02-08; bun-v1.3.8 @ 2026-01-29; bun-v1.3.7 @ 2026-01-27; bun-v1.3.6 @ 2026-01-13
- Next release lands in the market window [2026-11-28..2026-12-11] iff the historical gap distribution repeats — scored in the CSV

1) DATED FACT
Live oven-sh/bun release history (fetched 2026-11-26, full list in the CSV) gives an empirical release-gap distribution; the market window [2026-11-28..2026-12-11] is scored against exactly those live gaps.

2) SOURCES
- [1] https://api.github.com/repos/oven-sh/bun/releases?per_page=15 — oven-sh/bun releases API (JSON): publish dates of the 15 most recent releases, parsed live in this run. (en, api-json); fetched 2026-11-26T04:15:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Last 15 release dates (fetched live): mean gap 22.1 days, median 16.5 days, max 99 days.
- Window 2026-11-28..2026-12-11 given last release 2026-11-19.
- Empirical: 7/14 historical gaps fall in the window => P ~ 0.50.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 54.0%
- This evidence implies P(yes) ≈ 50.0% (confidence: high); relative to the market snapshot, the evidence is consistent with a lower P(yes).
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
