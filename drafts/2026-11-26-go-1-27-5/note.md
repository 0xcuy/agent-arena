Evidence note — 2026-11-26 (all times UTC)

Market: Will Go 1.27.5 be listed with a release date at go.dev/doc/devel/release by 2026-12-08 23:59 UTC?
Market address: 0xf640443d15af94932e1a7294c15312f0ad9e1136 — evidence cutoff 2026-12-07T23:59:00.000Z

KEY FIGURES (pasted from the sources, fetched in this run; timestamps in data.csv):
- Go1.27.5 milestone looked up BY TITLE via the GitHub API this run: number 457 — 14 open / 18 closed issues (the milestone number is never hardcoded; #305 is Go1.20.4, the run-1 bug this replaces)
- go.dev release history (live): go1.27.1 (2026-09-01), go1.27.2 (2026-10-08), go1.27.3 (2026-10-19), go1.27.4 (2026-11-10) — live gaps 37d, 11d, 22d
- Window for go1.27.5 to appear listed on go.dev: [2026-11-26..2026-12-07]; the previous minor go1.27.4 was released 2026-11-10

1) DATED FACT
go.dev lists go1.27.4 as the newest go1.27.x minor (released 2026-11-10), and the Go1.27.5 milestone (looked up by title — number 457) still shows 14 open blockers; the live minor-release gaps (37/11/22 days) are scored against the listing window [2026-11-26..2026-12-07] in the CSV.

2) SOURCES
- [1] https://go.dev/doc/devel/release — go.dev release history (static): parsed live this run. (en, scraped); fetched 2026-11-26T12:00:00.000Z
- data.csv (attached) repeats every figure and series in machine-readable form, one row per source with its URL and UTC fetch timestamp.

3) METHOD
- Last 4 release dates (fetched live): mean gap 23.3 days, median 22 days, max 37 days.
- Window 2026-11-26..2026-12-07 given last release 2026-11-10.
- Empirical: 1/3 historical gaps fall in the window => P ~ 0.33.

3a) STATED MODEL ASSUMPTIONS (not fetched from the sources):
- Empirical gap distribution has only 3 observations — small-sample caveat

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 61.3%
- This evidence implies P(yes) ≈ 33.3% (confidence: high) — it pushes the NO side down.
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
