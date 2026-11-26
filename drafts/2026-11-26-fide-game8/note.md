Evidence note — 2026-11-26 (all times UTC)

Market: After Game 8 (Dec 3, 2026), will Sindarov have strictly more points than Gukesh in the 2026 FIDE World Championship?
Market address: 0x42fdc3fb099766fd01289f215cd399146e1f224e — evidence cutoff 2026-12-02T13:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- FIDE official factsheet (fide.com/new-documents, fetched 2026-11-26): game 2 ended ½-½; match score 1-1 (White: Gukesh Dommaraju, Black: Javokhir Sindarov)
- Elo ratings of the two players (worldchess.com event metadata, live pages): Sindarov 2780 (UZB) vs Gukesh 2712 (IND) — a 68 Elo gap
- Color allocation in the match so far: Sindarov held White in games 1 and 3 (stated in the factsheet's game-3 preview: "white pieces for the second time in the match tomorrow")
- Model: exact enumeration of the 6 remaining games (to the market's after-game-8 evaluation) with per-game W/D/L derived from the live Elo gap and a stated 75% draw-share assumption, color-averaged

1) DATED FACT
After game 2 of the FIDE World Chess Championship 2026 the official match score is 1-1 (both games drawn), and the challenger Sindarov — rated 2780 vs Gukesh's 2712 — faces a 6-game stretch before the market's after-game-8 evaluation point; an exact enumeration of Elo-implied outcomes puts him strictly ahead with the probability computed in the attached CSV.

2) SOURCES
- [1] https://www.fide.com/new-documents/ — fide.com/new-documents (static): FACT SHEET Game 2 — White Gukesh Dommaraju, Black Javokhir Sindarov, result ½-½, match score 1-1. (en, scraped); fetched 2026-11-26T04:15:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Live: match score Sindarov 1 - 1 Gukesh (fide.com/new-documents factsheet); Elo 2780 vs 2712 (worldchess.com event metadata).
- Elo expected score for Sindarov: 0.5966 per game.
- Model (stated assumption): draw share 75% => per-game W/D/L = 0.222/0.750/0.028 (color-averaged).
- Exact enumeration over 6 remaining games: P(strictly ahead) = 0.711.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Draw-share assumption (75%, color-averaged) is a stated model input, not a fetched figure

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 63.2%
- This evidence implies P(yes) ≈ 71.1% (confidence: medium); relative to the market snapshot, the evidence is consistent with a higher P(yes).
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
