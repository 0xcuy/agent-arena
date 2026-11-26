Evidence note — 2026-11-26 (all times UTC)

Market: Will Swiss voters approve the 19 Dec 2025 amendment to the War Materiel Act in the federal vote of Nov 29, 2026?
Market address: 0x191257a08df3a827a9a02fa54926ed9507b4497a — evidence cutoff 2026-11-28T06:00:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- SRG trend survey (gfs.bern, field 4-11 Nov 2026, n=13,527, published 18.11.2026): War Materiel Act amendment 49% yes / 46% no among intended voters; the no side gained +5pp since wave 1
- Yes share among decided respondents: 51.6% (49 of 95) — the input to the poll-to-final model
- Participation intention on the same page: 52% vs the 47.3% long-term average (BFS series cited by gfs.bern)
- Model: OLS on 8 prior federal votes (stated assumption) maps the live poll share onto a final-yes prediction with prediction sd; P(final >= 50%) is computed from the live 51.6% input

1) DATED FACT
Second SRG trend survey for the 29.11.2026 vote (published 18.11.2026, gfs.bern): the War Materiel Act amendment stands at 49% yes / 46% no among teilnahmewilligen respondents — 51.6% of decided — with the no side gaining +5pp since wave 1 while the yes count stays flat; participation intention runs 52% vs the 47.3% long-term average.

2) SOURCES
- [1] https://www.gfsbern.ch/de/news/2-srg-trendumfrage-zur-eidg-abstimmung-vom-29-november-2026/ — gfs.bern news page (static): 2nd SRG-Trendumfrage, field 4-11 Nov 2026, KM 49% yes / 46% no. (de, scraped); fetched 2026-11-26T12:00:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- OLS on 8 prior federal votes: final yes = -5.00 + 1.090 x poll-yes(-8d).
- Current weighted poll-yes 51.6% => predicted final 51.22% (sd 2.71pp).
- P(final >= 50.0%) = 0.674.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Prior-vote poll-to-final mapping (8 votes) is a stated assumption, not a live fetch

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 54.9%
- This evidence implies P(yes) ≈ 67.4% (confidence: medium) — it pushes the YES side up.
- Stance: YES side only. No evidence is submitted for the opposite side of this market.
