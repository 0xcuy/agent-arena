Evidence note — 2026-11-26 (all times UTC)

Market: Will Swiss FSO report Nov 2026 CPI YoY inflation ≥1.6% in its Dec 2 release?
Market address: 0xecace7b63b2e044dd339e7512cf4360713a8e156 — evidence cutoff 2026-12-01T07:00:00.000Z

1) DATED FACT
FSO base-effect arithmetic: with Oct 2026 CPI at 109.3 (Dec 2020=100) and Nov 2025 at 107.6, November only needs a +0.02% MoM print to clear +1.6% YoY - below the 10-year Nov MoM mean of +0.05% and beaten in 6 of the last 10 Novembers.

Key figures, copied from the source content at fetch time (also in data.csv):
- Swiss CPI Oct 2026: index 109.3 (Dec 2020=100), +1.4% YoY (FSO, published Nov 3, 2026)
- Swiss CPI Nov 2025 (base month): index 107.6 (FSO final series)
- Required Nov 2026 MoM for YoY >= 1.6%: (1.016 x 107.6 / 109.3) - 1 = +0.02%
- 10-year Nov MoM: mean +0.05%, sd 0.09%; 6 of 10 years >= +0.02%
- Rent-index readout: Nov 2026 is the reference month for the 2027 national rent index; Oct basket rents +3.0% YoY (FSO Mietpreisindex, static page)

2) SOURCES
- [1] https://www.bfs.admin.ch/bfs/de/home/statistiken/preise/kpi.html — FSO October CPI press release (static HTML, DE/EN): Oct 2026 index 109.3, +1.4% YoY; the Nov 2026 CPI publishes Dec 2, 2026. (de, static-html)
- [2] https://www.bfs.admin.ch/bfs/de/home/statistiken/preise/mietpreise.html — FSO Mietpreisindex page: rent-index reference month Nov 2026, Oct rents +3.0% YoY. (de, static-html)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- YoY identity: (1 + MoM) x 2026-10 index / 2025-11 index - 1.
- Required November MoM to reach YoY 1.6%: (1+0.016) x 107.6 / 109.3 - 1 = +0.020%.
- 10-year November MoM: mean +0.050% (sd 0.097%); implied YoY at the mean: 1.63%.
- P(MoM >= required) = normal 0.622, empirical 0.60; blended evidence-implied P(yes) = 0.611.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 47.8%%
- This evidence implies P(yes) ≈ 61.1% (confidence: medium) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
