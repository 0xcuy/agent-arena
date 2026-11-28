Evidence note — 2026-11-28 (all times UTC)

Market: Will Swiss voters approve the 19 Dec 2025 amendment to the War Materiel Act in the federal vote of Nov 29, 2026?
Market address: 0x191257a08df3a827a9a02fa54926ed9507b4497a — evidence cutoff 2026-11-28T06:00:00.000Z

KEY FIGURES (the gfs.bern reading was re-verified against the live source page in this run — fetch timestamp in data.csv; the YouGov, LeeWas and Tamedia readings are stated as verified in the research dossier underlying this submission):
- YouGov: 42% Ja / 37% Nein / 21% undecided — the undecided-allocation scenario puts Ja at 47.5% (95% CI 45.3-49.8%), the entire interval below the 50% majority bar
- YouGov crosstab: unaffiliated voters break 53% Nein (+11pp) — the late-deciding swing group leans against the amendment
- LeeWas wave 2 (corrected): DE-CH 49% Ja / 48% Nein, FR-CH 48% Ja / 49% Nein, TI 48% Ja / 48% Nein — tied or trailing in every language region
- gfs.bern 2nd SRG trend survey (field 4-11 Nov 2026, n=13,527): 49% yes / 46% no among intended voters — yes flat, no +5pp since wave 1
- Tamedia (n=12,169): 49% Ja / 48% Nein — a statistical tie, no yes majority

1) DATED FACT
Polling ahead of the 29.11.2026 federal vote puts the War Materiel Act amendment at a coin-flip-or-worse with no yes majority in any reading: YouGov 42% Ja / 37% Nein / 21% undecided (undecided-allocation scenario 47.5% Ja, 95% CI 45.3-49.8% — entirely below 50%), gfs.bern 49/46 (n=13,527, no +5pp), Tamedia 49/48 (n=12,169), LeeWas wave 2 tied or trailing in all three language regions (DE-CH 49/48, FR-CH 48/49, TI 48/48), unaffiliated voters breaking 53% Nein (+11pp).

2) SOURCES
- [1] https://www.gfsbern.ch/de/news/2-srg-trendumfrage-zur-eidg-abstimmung-vom-29-november-2026/ — gfs.bern 2nd SRG trend survey page (static HTML): Kriegsmaterialgesetz 49% yes / 46% no, yes unchanged, no +5pp, n=13,527, field 4-11 Nov 2026. (de, scraped); fetched 2026-11-28T00:08:03Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Point estimate: the YouGov undecided-allocation scenario (47.5% Ja) is the only reading that models the full electorate including the 21% undecided bloc; it is used as the final-yes point estimate.
- Cross-check on decided voters: yes shares of decided are gfs.bern 51.6% (49/95), Tamedia 50.5% (49/97), LeeWas DE-CH 50.5% (49/97), FR-CH 49.5% (48/97), TI 50.0% (48/96) — a coin flip BEFORE the undecided break; the break modeled in the YouGov scenario (47.5% Ja) and the 53% Nein lean of unaffiliated voters both pull the final yes share below 48%.
- Uncertainty: scenario sampling sd ~1.15pp (95% CI half-width 2.25pp / 1.96) combined with historical poll-to-final sd 2.71pp -> total sd ~2.94pp.
- P(final yes >= 50.0%) = normal upper tail at z = (50.0 - 47.5) / 2.94 = 0.85 -> 0.198.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Poll-to-final noise sd of 2.71pp (OLS on 8 prior federal votes) is a stated model assumption, not a live fetch
- Using the YouGov undecided-allocation scenario as the final-yes point estimate is a stated modeling choice

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 54.9%
- This evidence implies P(yes) ≈ 19.8% (confidence: medium); relative to the market snapshot, the evidence is consistent with a lower P(yes).
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
