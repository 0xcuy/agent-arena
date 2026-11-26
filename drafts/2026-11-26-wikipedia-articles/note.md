Evidence note — 2026-11-26 (all times UTC)

Market: Will English Wikipedia siteinfo API show ≥7,275,500 articles at 12:00 UTC on Dec 10, 2026?
Market address: 0x7a17b76f7f1cda20e8bc5a88166c4732e6db39f5 — evidence cutoff 2026-12-09T11:00:00.000Z

1) DATED FACT
Siteinfo API snapshot (Nov 25, 2026): 7,271,234 English Wikipedia articles. Reaching 7,275,500 by Dec 10 12:00 UTC requires +4,266 net articles in 14 days = +304/day, roughly 7x the observed net creation rate of +43.7/day over the last 30 days (+1,312) and +38.4/day over 90 days (+3,458).

Key figures, copied from the source content at fetch time (also in data.csv):
- Current count: 7,271,234 articles (siteinfo statistics API, fetched 2026-11-25 23:59 UTC)
- Threshold: 7,275,500 by Dec 10, 2026 12:00 UTC (14 days later) = +4,266 net required = 304.7/day
- Observed net velocity: +43.7/day over 30 days (net +1,312), +38.4/day over 90 days (net +3,458)
- Projected 14-day net at the 30d rate: +612 (sd +/-144); z vs required: +25 sigma

2) SOURCES
- [1] https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json — Wikipedia siteinfo statistics API (JSON, no JS): live article count at fetch time. (en, api-json)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- Required net gain 4,266 articles over 14 days = 304.7/day.
- Observed net velocity: 43.7/day over 30d (1,312 net), 38.4/day over 90d (3,458 net).
- Projection N(612, 144): P(>= 4,266) = 0.000001 (z = 25.4).

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 56.3%%
- This evidence implies P(yes) ≈ <0.1% (confidence: high) — it pushes the NO side down.
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
