Evidence note — 2026-11-26 (all times UTC)

Market: Will English Wikipedia siteinfo API show ≥7,275,500 articles at 12:00 UTC on Dec 10, 2026?
Market address: 0x7a17b76f7f1cda20e8bc5a88166c4732e6db39f5 — evidence cutoff 2026-12-09T11:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- English Wikipedia siteinfo API (fetched live, timestamp in the CSV): 7,269,470 articles
- Net growth so far this 2026 (live "Size of Wikipedia" table): +154,567 over the 329 days since the 2026-01-01 value of 7,114,903 — 469.8/day
- Required net to reach 7,275,500 by 2026-12-10 12:00 UTC: +6,030 = 427.7/day over the 14.1 days left
- The 2026 required pace (427.7/day) is BELOW the live observed pace of 469.8/day (from the pasted +154,567 net over 329 days)

1) DATED FACT
Live siteinfo + the Size-of-Wikipedia growth table (fetched 2026-11-26) put English Wikipedia at 7,269,470 articles with a net creation pace of 469.8/day this year (net +154,567 over 329 days); reaching 7,275,500 by the market's check time needs 427.7/day — a pace the current velocity is already beating.

2) SOURCES
- [1] https://en.wikipedia.org/w/api.php?action=query&meta=siteinfo&siprop=statistics&format=json — siteinfo API (JSON): articles = 7269470. (en, api-json); fetched 2026-11-26T09:37:54.435Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Required net gain 6,030 over 14.1 days = 427.7/day.
- Observed net velocity (2026 year-to-date, live): 154,567 net over 329 days = 469.8/day.
- Projection N(6624, 225): P(>= 6,030) = 0.995821 (z = -2.6).

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Daily net-creation sd (60/day) is a stated model assumption

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 62.4%
- This evidence implies P(yes) ≈ 99.6% (confidence: high); relative to the market snapshot, the evidence is consistent with a higher P(yes).
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
