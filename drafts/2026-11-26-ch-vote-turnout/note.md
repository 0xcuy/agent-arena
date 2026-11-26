Evidence note — 2026-11-26 (all times UTC)

Market: Will turnout in Switzerland's federal vote of Nov 29, 2026 be at least 50.0%, per the Federal Chancellery?
Market address: 0x94dbba7c9b44b788a701602ab6d919ff7b7fc38a — evidence cutoff 2026-11-28T06:00:00.000Z

1) DATED FACT
Cantonal postal-ballot return rates at T-8d (37.2% weighted across ZH/BE/VD/TI/SG, Federal Chancellery Nov 26 update) sit 1.6pp above the T-8d rate of the Feb 2026 vote that finished at 50.2% - the strongest early-return readout in the 6-vote comparison series. OLS mapping of T-8d returns to final turnout predicts 51.1% for Nov 29.

Key figures, copied from the source content at fetch time (also in data.csv):
- T-8d weighted postal return (Nov 26, 2026): 37.2% (ZH 38.2, BE 35.7, VD 33.1, TI 41.0, SG 36.8; prior comparable vote +0.9 to +3.4pp lower on every canton)
- Comparison series T-8d return -> final turnout (federal votes): 35.6%->50.2% (Feb 2026), 34.9->46.9 (May 2026), 34.1->47.8 (Sep 2025), 33.6->46.6 (Nov 2024), 32.2->45.1 (May 2025), 31.0->43.9 (Jan 2025)
- OLS fit on the 6-vote series: final = 7.0 + 1.18 x T-8d return; predicted final turnout Nov 29: 51.1% (pred. sd 1.3pp)
- No vote in the series finished >= 50% with a T-8d return below 35.2%; current read is 2.0pp above that bar

2) SOURCES
- [1] https://www.bk.admin.ch/ch/de/aktuell/abstimmungen/postvoting-2026-11-26 — Bundeskanzlei postal-voting dashboard (DE): cantonal return rates as of Nov 26, 2026, each with the same-stage figure of the comparable 2025 vote. (de, scraped)
- [2] https://www.bk.admin.ch/ch/fr/actualite/votations/postvoting-2026-11-26 — Chancellerie federale (FR): VD/TI/GE return components of the same snapshot. (fr, scraped)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- OLS on 6 prior federal votes: final = 7.03 + 1.183 x (T-8d postal return).
- Current weighted T-8d return 37.2% => predicted final turnout 51.05% (prediction sd 1.32pp).
- P(turnout >= 50.0%) = 0.787.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 51.6%%
- This evidence implies P(yes) ≈ 78.7% (confidence: medium) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
