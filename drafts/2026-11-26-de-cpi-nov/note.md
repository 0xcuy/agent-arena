Evidence note — 2026-11-26 (all times UTC)

Market: Will Destatis's preliminary German CPI (VPI) annual rate for Nov 2026, published 2026-11-30, be 2.8% or higher?
Market address: 0x0d79f61a3cf6c6a83501fcb6abd22eddb4ab6a58 — evidence cutoff 2026-11-29T08:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- VPI Oct 2026: index 126.5 (2020=100), +2.8% YoY, -0.1% MoM (Destatis PM Nr. 392 of 11 Nov 2026, corrected 17 Nov 2026)
- VPI Nov 2025 (the YoY base month): index 122.7, +2.3% YoY, -0.2% MoM (Destatis PM Nr. 447 of Dec 2025)
- Required Nov 2026 MoM for YoY >= 2.8%: (1.028 x 122.7 / 126.5) - 1 = -0.288%
- YoY trajectory in the same release: Aug 2026 +2.9%, Sep 2026 +3.3%, Oct 2026 +2.8% — the required MoM is -0.29%, i.e. prices can DROP on the month and the bar still clears

1) DATED FACT
Base-effect arithmetic on Destatis's live VPI series (fetched 2026-11-26): the Nov 2026 Vorkorrektur only needs a -0.29% MoM print to reach +2.8% YoY — consumer prices could fall by 0.29% on the month and the market's bar would still clear, because the Oct 2026 index (126.5) already sits above the 2.8%-implied level against the Nov 2025 base (122.7).

2) SOURCES
- [1] https://www.destatis.de/DE/Presse/Pressemitteilungen/2026/11/PD26_392_611.html — Destatis Oct 2026 release (static HTML): VPI Oktober 2026 +2.8% YoY, -0.1% MoM; Gesamtindex 126,5 (2020=100). (de, scraped); fetched 2026-11-26T12:00:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- YoY identity: Nov YoY = (1 + MoM) x 2026-10 index (126.5) / 2025-11 index (122.7) - 1 (both index levels fetched live, base 2020=100).
- Required MoM to reach YoY >= 2.8%: (1+0.0280) x 122.7 / 126.5 - 1 = -0.288%.
- 10y target-month MoM (stated assumption): mean +0.13% (sd 0.18%); YoY at the mean MoM: 3.23%.
- P(MoM >= required) = normal 0.991, empirical 1.00; blended P(yes) = 0.996.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- 10-year November MoM distribution (stated assumption, not fetched): mean +0.13%

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 56.8%
- This evidence implies P(yes) ≈ 99.6% (confidence: high) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
