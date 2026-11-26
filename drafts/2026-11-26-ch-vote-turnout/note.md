Evidence note — 2026-11-26 (all times UTC)

Market: Will turnout in Switzerland's federal vote of Nov 29, 2026 be at least 50.0%, per the Federal Chancellery?
Market address: 0x94dbba7c9b44b788a701602ab6d919ff7b7fc38a — evidence cutoff 2026-11-28T06:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- Stadt Zürich postal-return rate: 39.6% of voting materials returned already (stadt-zuerich.ch "Stand Stimmbeteiligung", live page, fetch 2026-11-26)
- Participation intention for the 29 Nov 2026 federal vote: 52% (gfs.bern 2nd SRG trend survey, field 4-11 Nov 2026, n=13,527, published 18.11.2026)
- Long-term average the survey cites: 47.3% (Feb 2011 - Sep 2026, BFS series) — intention sits 4.7pp above it
- Model: expected final turnout = 52% - stated offset 1.5pp = 50.5% (sd 2.0pp); P(final >= 50%) computed from these live inputs

1) DATED FACT
Live early-turnout evidence for Switzerland's 29 Nov 2026 federal vote: Zürich — the largest electorate — reports 39.6% of voting materials already returned, and the SRG trend survey's participation intention of 52% runs 4.7pp above the 47.3% long-term average (gfs.bern/BFS), the strongest mobilisation marker of this vote cycle.

2) SOURCES
- [1] https://www.stadt-zuerich.ch/de/aktuell/news/2026/stimmbeteiligung.html — Stadt Zürich (static page, updated continuously): briefliche Stimmabgabe currently 39,6%. (de, scraped); fetched 2026-11-26T04:15:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Live: Stadt Zürich postal return shows 39.6% postal returns at as of the fetch date.
- Live: participation intention 52.0% vs long-term average 47.3% (gfs.bern 2nd SRG trend survey).
- Model (stated assumption): expected final turnout 50.5% (sd 2.0pp).
- P(final turnout >= 50.0%) = 0.599.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Intention-to-final offset (1.5pp) and sd (2pp) are stated model assumptions, not fetched figures

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 51.6%
- This evidence implies P(yes) ≈ 59.9% (confidence: medium); relative to the market snapshot, the evidence is consistent with a higher P(yes).
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
