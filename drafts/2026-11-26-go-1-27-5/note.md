Evidence note — 2026-11-26 (all times UTC)

Market: Will Go 1.27.5 be listed with a release date at go.dev/doc/devel/release by 2026-12-08 23:59 UTC?
Market address: 0xf640443d15af94932e1a7294c15312f0ad9e1136 — evidence cutoff 2026-12-07T23:59:00.000Z

1) DATED FACT
Go1.27.5 milestone has 14 open blockers (GitHub API, Nov 26) and go.dev lists minors on a strict 28-day cadence (1.27.1 Aug 20 -> 1.27.2 Sep 17 -> 1.27.3 Oct 15 -> 1.27.4 Nov 12) - already 14 days overdue. Comparable minors cleared 22 blockers in 18d, 28 in 23d, 16 in 15d, 21 in 22d; predicted listing for 14 blockers: Dec 8-9, right at the deadline.

Key figures, copied from the source content at fetch time (also in data.csv):
- Go1.27.5 milestone: 14 open / 87 closed blockers (GitHub API snapshot Nov 26, 2026)
- go.dev release history: go1.27.4 listed Nov 12, 1.27.3 Oct 15, 1.27.2 Sep 17, 1.27.1 Aug 20 - 28-day cadence
- Comparable clearance: 1.27.4: 22 blockers/18d (1.22/day); 1.27.3: 28/23d (1.22/day); 1.27.2: 16/15d (1.07/day); 1.27.1: 21/22d (0.95/day)
- Deadline Dec 8 23:59 UTC = 12.5 days from snapshot; predicted snapshot-to-listing: 12.7 +/- 3.0 days

2) SOURCES
- [1] https://api.github.com/repos/golang/go/milestones/305 — GitHub milestones API (JSON): Go1.27.5 milestone open/closed blocker counts. (en, api-json)
- [2] https://go.dev/doc/devel/release — go.dev release history (static HTML): listing dates of go1.27.x minors. (en, scraped)
- data.csv (attached) holds the full series/derivation table in machine-readable form; every figure above also appears inline so nothing depends on JS or bot-walled pages.

3) METHOD
- Go1.27.5 milestone: 14 open blockers (GitHub API snapshot).
- Comparable minors: 1.27.4 22 blockers/18d (1.22/day); 1.27.3 28 blockers/23d (1.22/day); 1.27.2 16 blockers/15d (1.07/day); 1.27.1 21 blockers/22d (0.95/day).
- Predicted snapshot-to-listing duration for 14 blockers: 12.7 days (sd 3.0, floored) vs 12.5 days to the Dec 8 deadline.
- P(listed by deadline) = 0.525. Minor cadence is 28 days (1.27.1-1.27.4, already overdue), but the blocker queue, not the cadence, gates the tag.

4) FORECAST COMPARISON
- Market implied P(yes) at snapshot: 61.3%%
- This evidence implies P(yes) ≈ 52.5% (confidence: medium) — it pushes the NO side down.
- Stance: NO side only. No evidence is submitted for the opposite side of this market.
