Evidence note — 2026-11-26 (all times UTC)

Market: Will Swiss voters approve the 19 Dec 2025 amendment to the War Materiel Act in the federal vote of Nov 29, 2026?
Market address: 0x191257a08df3a827a9a02fa54926ed9507b4497a — evidence cutoff 2026-11-28T06:00:00.000Z

1) DATED FACT
SRG Waelbarometer Nov 21-25 field (n=24,118): YES support 55.8% DE-Switzerland, 48.9% FR-Switzerland, 45.2% Ticino - electorate-weighted 53.6% YES. OLS on 8 prior federal votes maps -8d polls to finals with no systematic slip; predicted final: 53.5% YES.

Key figures, copied from the source content at fetch time (also in data.csv):
- SRG poll yes-share: DE-Schweiz 55.8%, FR-Suisse 48.9%, TI 45.2% (field Nov 21-25, 2026, n=24,118)
- Electorate-weighted poll yes: 53.6% (DE 72.0% of electorate, FR 21.5%, IT 6.5%)
- Regression on 8 prior votes (poll-yes at -8d vs final): slope 1.09, residual sd 2.5pp; predicted final: 53.5%
- Party-spline support: SVP voters 71% yes, FDP 63% (unusual for the two largest blocs to stack on one side)

2) SOURCES
- [1] https://www.srg-research.ch/de/wahlbarometer-2026-11-26 — SSR Research Waehlbarometer (DE): regional yes-shares and party-bloc support for the Nov 29 vote, published Nov 26. (de, scraped)
- [2] https://www.bk.admin.ch/ch/d/pors/va/2026-11-29 — Federal Chancellery vote dossier (DE) (de, static-html)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- OLS on 8 prior federal votes: final yes = -5.00 + 1.090 x poll-yes(-8d).
- Current weighted poll-yes 53.6% => predicted final 53.42% (sd 2.83pp).
- P(final >= 50.0%) = 0.887.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 54.9%%
- This evidence implies P(yes) ≈ 88.7% (confidence: medium) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
