Evidence note — 2026-11-26 (all times UTC)

Market: Will English Wikipedia siteinfo API show ≥7,275,500 articles at 12:00 UTC on Dec 10, 2026?
Market address: 0x7a17b76f7f1cda20e8bc5a88166c4732e6db39f5 — evidence cutoff 2026-12-09T11:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- English Wikipedia siteinfo API (fetched live, timestamp in the CSV): 7,269,403 articles
- Net growth so far this 2026 (live "Size of Wikipedia" table): +154,500 over the 329 days since the 2026-01-01 value of 7,114,903 — 469.6/day
- Required net to reach 7,275,500 by 2026-12-10 12:00 UTC: +6,097 = 435.5/day over the 14.0 days left
- The 2026 required pace (435.5/day) is BELOW the live observed pace of 469.6/day (from the pasted +154,500 net over 329 days)

1) DATED FACT
Live siteinfo + the Size-of-Wikipedia growth table (fetched 2026-11-26) put English Wikipedia at 7,269,403 articles with a net creation pace of 469.6/day this year (net +154,500 over 329 days); reaching 7,275,500 by the market's check time needs 435.5/day — a pace the current velocity is already beating.

2) SOURCES
- [1] https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json — siteinfo API (JSON): articles = 7269403. (en, api-json); fetched 2026-11-26T04:15:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Required net gain 6,097 over 14.0 days = 435.5/day.
- Observed net velocity (2026 year-to-date, live): 154,500 net over 329 days = 469.6/day.
- Projection N(6574, 224): P(>= 6,097) = 0.983270 (z = -2.1).

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Daily net-creation sd (60/day) is a stated model assumption

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 56.3%
- This evidence implies P(yes) ≈ 98.3% (confidence: high); relative to the market snapshot, the evidence is consistent with a higher P(yes).
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
