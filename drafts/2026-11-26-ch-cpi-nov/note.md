Evidence note — 2026-11-26 (all times UTC)

Market: Will Swiss FSO report Nov 2026 CPI YoY inflation ≥1.6% in its Dec 2 release?
Market address: 0xecace7b63b2e044dd339e7512cf4360713a8e156 — evidence cutoff 2026-12-01T07:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- Swiss LIK Oct 2026: index 101.7 (Dec 2025 = 100), +0.2% MoM, YoY Teuerung +1.5% (BFS, published 3 Nov 2026)
- Swiss LIK Nov 2025: 107.0 (Dec 2020 = 100), -0.2% MoM (BFS, 3 Dec 2025); LIK Dec 2025: 106.9 (Dec 2020 = 100, BFS, 8 Jan 2026) — chaining puts Nov 2025 at 100.094 on the current Dec 2025 = 100 base
- Required Nov 2026 index for YoY >= 1.6%: 1.016 x 100.094 = 101.695; required MoM vs Oct's 101.7: -0.005%
- Nov 2026 LIK publishes on 2 Dec 2026 (BFS release calendar), inside the market's resolution window

1) DATED FACT
Chained BFS base-effect arithmetic (live fetch 2026-11-26): Nov 2026 YoY already runs at +1.5% and the LIK only needs a -0.005% MoM print — against Oct's 101.7 on the Dec-2025=100 base, chained from the BFS Nov/Dec 2025 news (Nov 2025 = 100.094) — to clear +1.6% YoY.

2) SOURCES
- [1] https://www.admin.ch/de/newnsb/UA8hylpLYO6i — BFS Oct 2026 news (static): LIK +0.2% MoM to 101,7 points (Dec 2025=100); YoY Teuerung +1.5%. (de, scraped); fetched 2026-11-26T04:15:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- YoY identity: Nov YoY = (1 + MoM) x 2026-10 index (101.7) / 2025-11 index (100.094) - 1 (both index levels fetched live, base Dec 2025=100 (chained from Dec 2020=100 via Dec 2025 = 106.9)).
- Required MoM to reach YoY >= 1.6%: (1+0.0160) x 100.094 / 101.7 - 1 = -0.004%.
- 10y target-month MoM (stated assumption): mean +0.00% (sd 0.12%); YoY at the mean MoM: 1.60%.
- P(MoM >= required) = normal 0.514, empirical 0.60; blended P(yes) = 0.557.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Swiss November MoM 10y distribution (stated assumption) supplies only the P(MoM >= required) judgement

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 47.8%
- This evidence implies P(yes) ≈ 55.7% (confidence: medium); relative to the market snapshot, the evidence is consistent with a higher P(yes).
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
