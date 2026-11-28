Evidence note — 2026-11-28 (all times UTC)

Market: Will turnout in Switzerland's federal vote of Nov 29, 2026 be at least 50.0%, per the Federal Chancellery?
Market address: 0x94dbba7c9b44b788a701602ab6d919ff7b7fc38a — evidence cutoff 2026-11-28T06:00:00.000Z

KEY FIGURES (the Basel-Stadt series was re-verified against the live data.bs.ch API in this run — fetch timestamp in data.csv; the gfs.bern intention, the Geneva/Zurich/Winterthur/Luzern postal readings and the Sep 2026 benchmark are stated as verified in the research dossier underlying this submission):
- Basel-Stadt postal turnout at T-2 (Fri 27 Nov 2026, official data.bs.ch open-data API, dataset 100223): 44.13% of registered voters — 40,142 envelopes cumulative, +4,418 received on the day
- Basel-Stadt daily postal intake on the final reported days (same series): +2,219 at T-4, +4,882 at T-3, +4,418 at T-2
- gfs.bern 2nd SRG trend survey (field 4-11 Nov 2026, n=13,527): 52% participation intention for the 29 Nov 2026 federal vote
- Actual postal returns in the other tracked electorates: Zurich 42.3%, Winterthur 35.1% (T-3), Geneva 33.0% (J-3), Luzern 31.77% (T-4) — all far below the 52% stated intention
- Benchmark: final national turnout of the Sep 2026 federal vote was 47.1% — below the 50% bar

1) DATED FACT
Two days before Switzerland's 29 Nov 2026 federal vote, actual postal returns lag the 52% participation intention in every tracked electorate: Basel-Stadt's official open-data tracker shows postal turnout of 44.13% of registered voters at T-2 (Friday 27 Nov 2026; 40,142 envelopes received cumulative, +4,418 on that day), Zurich 42.3%, Winterthur 35.1% at T-3, Geneva 33.0% at J-3 and Luzern 31.77% at T-4 — while the final national turnout of the most recent federal vote (September 2026) was 47.1%, below the 50% bar.

2) SOURCES
- [1] https://data.bs.ch/api/explore/v2.1/catalog/datasets/100223/records?where=datum_urnengang%3Ddate%272026-11-29%27&order_by=datum&limit=100 — data.bs.ch (Kanton Basel-Stadt open data) API JSON, dataset 100223 "Briefliche Stimmbeteiligung": full daily postal-turnout series for the 29 Nov 2026 Urnengang, T-20 through T-2; last row 27 Nov 2026: stimmbeteiligung 44.13%, eingang_kumuliert 40,142, eingang_pro_tag 4,418. (de, api-json); fetched 2026-11-28T00:22:04Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Point estimate: expected final national turnout = participation intention (52.0%) minus a stated 4.0pp intention-to-realized overshoot = 48.0%. Stated participation intention systematically overstates realized turnout in Swiss federal voting; the discount size is a stated assumption (3a), not a fetched figure.
- Cross-check (realized base rate): the most recent final national turnout — Sep 2026, 47.1% — sits 2.9pp below the 50% bar; the 48.0% point estimate credits this vote with only +0.9pp of mobilization over September.
- Cross-check (behavioral arithmetic): even the best postal reading — Basel-Stadt 44.13% at T-2 — leaves a 5.9pp gap to the 50% bar that the final-weekend inflow plus in-person voting would have to fill; the other tracked electorates sit 7.7pp (Zurich 42.3%) to 18.2pp (Luzern 31.77%) below the bar with 2-4 days remaining.
- Uncertainty: sd 2.0pp around the 48.0% point estimate (stated assumption).
- P(final turnout >= 50.0%) = normal upper tail at z = (50.0 - 48.0) / 2.0 = 1.00 -> 0.159.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- The 4.0pp intention-to-realized overshoot discount is a stated model assumption, not a fetched figure
- The 2.0pp noise sd around the final-turnout point estimate is a stated model assumption, not a fetched figure
- Using the intention-minus-overshoot estimate as the final-turnout point estimate (rather than the raw 52% intention) is a stated modeling choice

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 51.6%
- This evidence implies P(yes) ≈ 15.9% (confidence: medium); relative to the market snapshot, the evidence is consistent with a lower P(yes).
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
