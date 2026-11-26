Evidence note — 2026-11-26 (all times UTC)

Market: Will oven-sh/bun publish a GitHub release tagged bun-v1.4.6 or later between Nov 28 and Dec 11, 2026 (UTC)?
Market address: 0x921e39354e4bfc18251ad1b1c80eec1a3940ab82 — evidence cutoff 2026-12-10T00:00:00.000Z

1) DATED FACT
GitHub releases API (last 15 bun tags, Nov 26 snapshot): mean gap 12.4 days, only one gap > 17 days in the entire cycle (v1.3.1, audit-period freeze, 18 days). v1.4.5 published Nov 24; 13 of 14 historical gaps would put v1.4.6 inside the Nov 28 - Dec 11 window, and 68 commits are already untagged on main.

Key figures, copied from the source content at fetch time (also in data.csv):
- Last release: bun-v1.4.5, published 2026-11-24T10:00Z (GitHub releases API)
- Gap distribution, last 14 gaps: mean 12.4d, median 12.0d, max 18d (v1.3.1->v1.3.2 audit freeze), all others 10-14d
- Window: v1.4.6 or later must publish between Nov 28 and Dec 11 => next gap must be 4-17 days
- 13/14 historical gaps fall in that range; untagged commits on main since v1.4.5: 68

2) SOURCES
- [1] https://api.github.com/repos/oven-sh/bun/releases?per_page=15 — GitHub releases API (JSON): publish dates of the last 15 bun releases. (en, api-json)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- Last 15 bun release dates (GitHub releases API): mean gap 12.5 days, median 12 days, only one gap > 17 days (v1.3.1 -> v1.3.2, 18 days, an audit-period freeze).
- Window 2026-11-28..2026-12-11 given last release 2026-11-24 = gap of 4..17 days.
- Empirical: 13/14 historical gaps fall there => P ~ 0.93; 68 untagged commits on main add downward pressure on the gap.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 54.0%%
- This evidence implies P(yes) ≈ 92.9% (confidence: high) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
