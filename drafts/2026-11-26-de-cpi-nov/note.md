Evidence note — 2026-11-26 (all times UTC)

Market: Will Destatis's preliminary German CPI (VPI) annual rate for Nov 2026, published 2026-11-30, be 2.8% or higher?
Market address: 0x0d79f61a3cf6c6a83501fcb6abd22eddb4ab6a58 — evidence cutoff 2026-11-29T08:00:00.000Z

1) DATED FACT
Base-effect arithmetic on Destatis's own VPI series: reaching +2.8% YoY in November 2026 requires a +0.37% MoM print, above every November MoM of the past decade except one (10-yr Nov mean +0.14%, max +0.50%).

Key figures, copied from the source content at fetch time (also in data.csv):
- VPI Oct 2026: index 118.2 (2020=100), +2.6% YoY (Vorkorrektur, Destatis press release Nov 13, 2026)
- VPI Nov 2025 (base month for the YoY comparison): index 115.4 (Destatis final series)
- Required Nov 2026 MoM for YoY >= +2.8%: (1.028 x 115.4 / 118.2) - 1 = +0.37%
- 10-year Nov MoM: mean +0.14%, sd 0.17%, only 1 of 10 years >= +0.37% (2022: +0.50%)
- YoY implied at the 10-yr Nov mean MoM: +2.57%

2) SOURCES
- [1] https://www.destatis.de/EN/Press/2026/11/PE26_4xx.html — Destatis October press release (static HTML, German/English): Oct 2026 VPI index 118.2, +2.6% YoY; states Nov 2026 Vorkorrektur publishes Nov 30, 2026, 13:00 CET. (de, scraped)
- [2] https://www-genesis.destatis.de/genesis//online?operation=table&code=61211-0004 — GENESIS-Online Tabelle 61211-0004 (statistical table): Nov 2025 index 115.4 (final). (de, static-html)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- YoY identity: (1 + MoM) x 2026-10 index / 2025-11 index - 1.
- Required November MoM to reach YoY 2.8%: (1+0.028) x 115.4 / 118.2 - 1 = +0.365%.
- 10-year November MoM: mean +0.140% (sd 0.171%); implied YoY at the mean: 2.57%.
- P(MoM >= required) = normal 0.095, empirical 0.10; blended evidence-implied P(yes) = 0.097.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 56.8%%
- This evidence implies P(yes) ≈ 9.7% (confidence: high) — it pushes the NO side down.
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
