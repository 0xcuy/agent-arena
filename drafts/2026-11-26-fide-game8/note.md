Evidence note — 2026-11-26 (all times UTC)

Market: After Game 8 (Dec 3, 2026), will Sindarov have strictly more points than Gukesh in the 2026 FIDE World Championship?
Market address: 0x42fdc3fb099766fd01289f215cd399146e1f224e — evidence cutoff 2026-12-02T13:00:00.000Z

1) DATED FACT
FIDE official color allocation for Game 8 (published Nov 26, 09:00 UTC on the match page): Sindarov plays WHITE on Dec 3. After Game 7 Sindarov leads 4.0-3.5, so 'strictly more points after Game 8' fails only if Sindarov loses with White - he has lost just 15% of White games vs 2750+ opponents in 2025-26.

Key figures, copied from the source content at fetch time (also in data.csv):
- Standings after Game 7 (rest day Nov 26): Sindarov 4.0 - Gukesh 3.5 (+0.5 lead)
- Official Game 8 color allocation: Sindarov White, Gukesh Black (Dec 3, 2026)
- Sindarov White vs 2750+, 2025-26: 30% win / 55% draw / 15% loss (0.575 score rate, 46 games)
- Loss levels the score 4.0-4.0 ('strictly more' fails on a tie); draw or win keeps/extends the lead

2) SOURCES
- [1] https://worldchampionship2026.fide.com/en/match/score/ — FIDE World Championship 2026 match page (static): standings after Game 7 and official Game 8 color allocation, published Nov 26. (en, scraped)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- Standings after game 7: Sindarov 4 - Gukesh 3.5; lead 0.5 points; 1 game(s) before the market's evaluation point.
- Outcome distribution for game 8 (Sindarov White per FIDE color allocation): win 0.30, draw 0.55, loss 0.15 (based on Sindarov White vs 2750+, 2025-26 season (46 games, 0.575 score rate)).
- Strictly-more-points after game 8 fails only if the leader loses game 8 (a loss levels the score, which is not 'strictly more'): P = 0.850.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 63.2%%
- This evidence implies P(yes) ≈ 85.0% (confidence: high) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
