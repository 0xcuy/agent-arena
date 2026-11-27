# DRAFT — Delphi feedback reports (27 Nov 2026)

**DRAFT — DO NOT SUBMIT.** These are pre-written feedback reports for
feedback.delphi.fyi covering the five failed minings of the 26 Nov live run.
Nothing here has been or should be submitted automatically; an owner reviews
and posts each report by hand. No secrets, tokens or credentials appear in
this file. Where the exact error could not be reconstructed from the repo, it
is marked "unknown — needs live repro" rather than invented.

Evidence sources used: `git show main:src/...` (the code that actually ran on
26 Nov), `submit-attempts.jsonl`, `evidence-log.jsonl`, and the drafts
manifests under `drafts/2026-11-26-*/`.

---

## 1. go-1-27-5 — GitHub API 415 (Unsupported Media Type)

**What failed.** The go-release miner's milestone lookup for `Go1.27.5` paged
through `https://api.github.com/repos/golang/go/milestones?state=all&per_page=100&page={page}`
and every page request failed, so the market produced no evidence.

**Exact error.** HTTP **415 Unsupported Media Type** from api.github.com. The
surfaced message (reconstructed from main's code paths:
`src/miners/live/sources.ts` `fetch()` throws on non-200; the milestone loop
wraps it as shown below) was:

```
source fetch for https://api.github.com/repos/golang/go/milestones?state=all&per_page=100&page=1 returned HTTP 415 (200 required)
```

**Root cause (verified on main).** The call was `await api.fetch(url)` with no
`kind` argument (`git show main:src/miners/live/refreshers-part2.ts`, the
milestone loop in `refreshGoRelease`). `fetch(url, kind?)` defaults `kind` to
undefined and sends `Accept: text/html`
(`headers: { "User-Agent": UA, Accept: kind === "json" ? "application/json" : "text/html" }`).
GitHub's REST API does not serve `text/html` and answers 415. It was NOT
routed through Firecrawl — the request went out via native `fetch` with the
wrong Accept header. `src/firecrawl/client.ts` exists but is imported nowhere.

**Minimal repro.**
`curl -s -o /dev/null -w "%{http_code}" -H "Accept: text/html" https://api.github.com/repos/golang/go/milestones?state=all&per_page=1` → 415;
the same URL with `-H "Accept: application/vnd.github+json"` → 200.

**Suggested fix (shipped this round).** Dedicated GitHub API transport
(`src/miners/live/github.ts`) sending `Accept: application/vnd.github+json`,
`X-GitHub-Api-Version: 2022-11-28`, no Content-Type on GET; non-GitHub URLs
never pass through it.

---

## 2. bun-release — GitHub API 415 (Unsupported Media Type)

**What failed.** The bun release-gap miner fetched
`https://api.github.com/repos/oven-sh/bun/releases?per_page=15` via the same
shared `api.fetch()` transport and failed identically before parsing any
releases.

**Exact error.** HTTP **415 Unsupported Media Type**:

```
source fetch for https://api.github.com/repos/oven-sh/bun/releases?per_page=15 returned HTTP 415 (200 required)
```

**Root cause.** Same as go-1-27-5 above: `releasesGapCdf` on main called
`fresh(api, seed.sources[opts.sourceKey], ...)` → `api.fetch(url)` with no
`kind`, so `Accept: text/html` went to api.github.com. Direct native fetch,
not Firecrawl.

**Minimal repro.** As above with the bun releases URL.

**Suggested fix.** Same GitHub transport; additionally (this round) the
nodejs.org `dist/index.json` source was found routed through the GitHub
header path and now uses the plain transport instead (NIT 2).

---

## 3. ch-vote-turnout — parse failure on the Zürich turnout page

**What failed.** The turnout miner fetched the Zürich postal-return page but
the required German phrase was not on it in the exact form the regex demands,
so the miner threw before producing evidence.

**Exact error.**

```
LiveMiningError: did not parse Zürich postal return
```

(thrown by main's `rx()` helper when `body.match(/beträgt derzeit (\d+,\d) Prozent/)`
finds nothing — `git show main:src/miners/live/refreshers-part1.ts`,
`refreshChTurnout`, line 284).

**Root cause.** Single-source hard dependency: only the stadt-zuerich.ch page
was consulted, with a rigid phrase regex `beträgt derzeit X,X Prozent`. The
live page phrased the figure differently (and fresh cantonal data existed for
Geneva and Basel-Stadt), but there was no fetch-time cascade and no fallback
wording.

**Minimal repro.** Fetch the live stadt-zuerich "Stand Stimmbeteiligung" page
on a day the sentence is reworded; run `body.match(/beträgt derzeit (\d+,\d) Prozent/)`
→ null → throw.

**Suggested fix (shipped this round).** Fetch-time canton cascade (Geneva →
Basel-Stadt → Zürich) plus a tightened contextual turnout parser
(`parseDerzeitTurnoutPct` etc. in `refreshers-part1.ts`) that requires the
unit adjacent to the number and turnout wording in the sentence window. Every
cascade URL was verified with an actual HTTP GET returning 200 plus live
participation content (GE: `https://www.ge.ch/votations/20261129/`, BS: the
Staatskanzlei "Wahlen und Abstimmungen" page); Bern and Vaud were dropped from
the cascade because no page of theirs carrying a parseable turnout figure
could be verified — the originally drafted `be.ch`/`vd.ch` candidates return
404 and must not ship.

**Clarification (round 4).** A re-fetch of the real pages showed Basel-Stadt's
percentage ships only as a chart image / OGD download — its HTML carries no
parseable turnout figure at all — so BS was dropped from the cascade too,
which now runs Geneva (real page, number-first "30.3% de participation à
J-4", handled by the parser) with Zürich as the fallback; nothing about the
cascade invents or substitutes a figure.

---

## 4. ch-war-materiel — parse failure on the gfs.bern survey page

**What failed.** The War Materiel Act miner could not anchor the KM poll
section on the gfs.bern page, and the share regex then failed on the
unanchored full page.

**Exact error.**

```
LiveMiningError: did not parse KM poll shares
```

(thrown by main's `rx()` when
`/Aktuell würden (\d+) Prozent[\s\S]*?zustimmen[\s\S]*?während (\d+) Prozent[\s\S]*?ablehnen/`
does not match — `git show main:src/miners/live/refreshers-part1.ts`,
`refreshChWarMateriel`, lines 353-360).

**Root cause.** When neither anchor (`"Kriegsmaterialgesetz\n"` heading /
"enges Rennen mit leichtem Ja-Vorteil" phrase) is found, main silently used
the WHOLE survey page as the segment instead of failing. On the live page the
share sentence wording differed, the regex missed, and the miner died. Note:
the same "use the whole page" fallback could in other circumstances have
matched ANOTHER proposal's percentages (e.g. the AHV pair) and submitted them
confidently — a wrong submission is worse than a failure.

**Minimal repro.** Fetch the gfs.bern survey page; if the KM section heading
is reworded, run the anchor search → miss; then the share regex on the full
page → null → throw.

**Suggested fix (shipped this round).** Throw a clear
`LiveMiningError("KM poll section not found … refusing to guess")` when no
anchor is found — the market is skipped rather than guessed; segment parsing
only ever runs on the anchored slice.

---

## 5. fide-game8 — data failure on the FIDE factsheet page

**What failed.** The factsheet-only miner fetched
`https://www.fide.com/new-documents/` and none of its required patterns were
present on the scraped page: no `Match score: \d+–\d+`, no
`FACT SHEET – Game \d+` block with `White:/Black:/Result:` lines. The scraped
page carried no completed-game data block, so the miner produced no evidence.

**Exact error.** The first missing pattern on main was the match score, so the
surfaced message was:

```
LiveMiningError: did not parse match score
```

(`git show main:src/miners/live/refreshers-part2.ts`, `refreshFideMatch`, line
~136: `rx(fide, /Match score: (\d+)[–-](\d+)/, "match score")`.) If the page
had carried a score line, the next failure would have been `did not parse
factsheet game number` / `did not parse White player` — the run log does not
record which single line fired; the parse-failure family is certain, the exact
first line is **unknown — needs live repro** against the 26 Nov page snapshot.

**Root cause.** Single-source dependency on a scraped static documents page
that does not reliably embed per-game factsheet data (result, colors, running
score). No PGN source existed.

**Minimal repro.** Scrape fide.com/new-documents → run main's regex chain →
`Match score:` pattern not found → throw.

**Suggested fix (shipped this round).** Primary source is now the real Lichess
broadcast PGN (`GET /api/broadcast/qfkdt8mn.pgn`, tournament "FIDE World Chess
Championship 2026", verified live 27 Nov with HTTP 200 and per-game `[Result]`
tags); the factsheet scrape remains only an explicit, warned, last-resort
fallback. The previously guessed `fide.com/multimedia/pgn/wcc-2026.pgn`
fallback was verified to 404 and removed.

---

### Status of the five markets (from drafts manifests + submit-attempts.jsonl)

| topic | submitted 26 Nov | outcome.verdict |
|---|---|---|
| go-1-27-5 | no (mining failed) | — |
| bun-release | no (mining failed) | — |
| ch-vote-turnout | no (mining failed) | — |
| ch-war-materiel | no (mining failed) | — |
| fide-game8 | no (mining failed) | — |

For contrast, the five submissions that DID go out on 26 Nov (all judged
DUPLICATE — do not re-mine without a materially new catalyst): de-cpi-nov,
wikipedia-articles, ch-cpi-nov, ietf-mna-ioam-discuss, es-vox-seats.

**DRAFT — DO NOT SUBMIT.**
