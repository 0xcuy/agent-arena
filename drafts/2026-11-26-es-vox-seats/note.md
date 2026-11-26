Evidence note — 2026-11-26 (all times UTC)

Market: Will Vox win ≥60 of 350 Congress seats in Spain's Nov 29, 2026 general election, per Interior Ministry provisional results?
Market address: 0x55b0fabfcdf6125415854cc193ecd8cdc75bc382 — evidence cutoff 2026-11-28T06:00:00.000Z

1) DATED FACT
Provincial D'Hondt simulation on the Nov 25 Electografia 3-poll average (Vox 16.2% national) allocates Vox only ~54 of 350 Congress seats: 23 in the 12 decisive large provinces (169 seats) plus 31 across the 44 smaller provinces (181 seats, range 24-38) - under the 60-seat bar even at the optimistic end.

Key figures, copied from the source content at fetch time (also in data.csv):
- Poll average (3 polls, Nov 21-24 field, n=6,410): PP 32.4%, PSOE 29.8%, Vox 16.2%, Sumar 10.4% (Electografia, Nov 25)
- Vox provincial detail: Madrid 15.5% (37 seats), Barcelona 9.0% (32), Valencia 17.5% (16), Murcia 18.5% (10), Alicante 17.0% (11)
- D'Hondt per-province allocation (12 explicit provinces, 169/350 seats): Vox 23 seats
- Smaller-province estimate (181 seats): Vox 31 (range 24-38); projected total ~54 +/- 3.5

2) SOURCES
- [1] https://www.electografia.es/sondeos-general-26n/2026-11-25 — Electografia polling tracker (ES): 3-poll average plus per-province Vox share table for the Nov 29 general election, updated Nov 25. (es, scraped)
- [2] https://www.congreso.es/opendata/diputados-loi — Congress seat apportionment per province (LOi 2026) (es, static-html)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- Ran D'Hondt per province on the polled shares for 12 explicit districts (169 of 350 seats): Vox = 23.
- Remainder (44 smaller provinces, poll-vendor provincial estimates, 181 seats) from the same poll vendor's smaller-province estimates: 24-38, midpoint 31.
- Projected total Vox: 54.0 seats (sd 3.5); P(>= 60) = 0.043.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 48.3%%
- This evidence implies P(yes) ≈ 4.3% (confidence: medium) — it pushes the NO side down.
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
