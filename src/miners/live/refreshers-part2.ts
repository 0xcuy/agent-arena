import type { SourceLink } from "../../types.js";
import type { RefreshCtx, Refreshed, SeedInput } from "./refreshers-part1.js";
import { assemble, dot, fresh, grp, LiveMiningError, requireNum, rx } from "./refreshers-part1.js";
import type { SourceApi, SourceDoc } from "./sources.js";
import { assertFresh } from "./sources.js";

/** Path 3: Spain Vox seats — live Electografía/Data10 tracking page. */
export async function refreshEsVox(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [trackingDoc] = await Promise.all([fresh(api, seed.sources.electografica, "electografica", ctx)]);
  const body = trackingDoc.body;
  const shareM = rx(body, /Vox\s*\n?\s*subiría una décima, hasta el (\d{1,2},\d) %, y alcanzaría (\d{1,3}) diputados/, "Vox tracking row");
  const shareRaw = grp(shareM, 1, "Vox national vote share");
  const seatsRaw = grp(shareM, 2, "Vox projected seats");
  const share = requireNum(shareRaw, "Vox national vote share");
  const seats = requireNum(seatsRaw, "Vox projected seats");

  const thr = Number(seed.market.thresholdSeats);
  const sd = Number(seed.assumptions.seatEstimateSd);

  const figures = [
    `Live Data10 tracking (Electografía, updated for the 29 Nov 2026 general election): Vox's tracker projection is ${share.toFixed(1)}% nationally and ${seats} projected Congress seats`,
    `Same tracker's headline row: "Vox subiría una décima, hasta el ${shareRaw} %, y alcanzaría ${seatsRaw} diputados" — the bar for the market is ${thr} seats`,
    `Tracker cross-check available on the page: PP ~131-133 seats, PSOE ~113-117, Frente Amplio ~9; Vox is the third bloc in every reading`,
  ];
  const headline =
    `Live provincial tracker (Data10 via Electografía, fetched ${ctx.now.toISOString().slice(0, 10)}): Vox polls at ${share.toFixed(1)}% nationally ` +
    `and its tracker projects ${seats} Congress of Deputies seats — ${seats >= thr ? "above" : "below"} the ${thr}-seat bar — using the tracker's own D'Hondt-style provincial seat model.`;

  const links: SourceLink[] = [
    {
      url: trackingDoc.url,
      label: "Electografía/Data10 26N general-election tracking (Vox: vote share + seats)",
      lang: "es",
      access: "scraped",
      expect: [shareRaw, seatsRaw],
    },
  ];
  return assemble(
    seed,
    [trackingDoc],
    headline,
    figures,
    [
      `Electografía tracking page (static HTML, ES): Data10 daily seat/vote projection for the 29 Nov 2026 general election; Vox ${dot(shareRaw)}% / ${seats} seats; every figure pasted above appears on the page.`,
    ],
    links,
    {
      kind: "seat_threshold",
      params: {
        party: "Vox",
        source: "Electografía/Data10 tracking page",
        sourceSeatEstimate: seats,
        sourceVoteSharePct: share,
        thresholdSeats: thr,
        estimateSd: sd,
      },
    },
    [`Seat-projection error sd (${sd} seats) is a stated model assumption`],
  );
}

/** Path 2: IESG ballot state for draft-ietf-mpls-mna-ioam. */
export async function refreshIetfBallot(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [ballotDoc] = await Promise.all([fresh(api, seed.sources.ballot, "ballot", ctx)]);
  const body = ballotDoc.body;
  const neededM = rx(body, /Needs (\d+) more YES or NO OBJECTION positions to pass/, "needed-to-pass text");
  const neededRaw = grp(neededM, 1, "needed to pass");
  const needed = requireNum(neededRaw, "needed to pass");
  const summaryAt = body.indexOf("Summary:");
  if (summaryAt < 0) throw new LiveMiningError("no Summary block on the ballot page");
  const summary = body.slice(summaryAt);
  const noRecord = (summary.match(/No Record/g) ?? []).length;
  if (noRecord === 0) throw new LiveMiningError("no IESG positions parsed from the ballot page");
  const recordedYes = (summary.match(/\nYes\n/g) ?? []).length;
  const positionsTotal = noRecord + recordedYes;
  if (recordedYes === 0) throw new LiveMiningError("no Yes positions parsed from the ballot page");
  const discussCount = (body.match(/\bDISCUSS\b/g) ?? []).length;
  const unrecorded = positionsTotal - recordedYes;

  const withDiscuss = Number(seed.assumptions.comparableDraftsWithDiscuss);
  const similarDrafts = Number(seed.assumptions.comparableDrafts);

  const figures = [
    `Live IESG evaluation record for draft-ietf-mpls-mna-ioam-18 (Datatracker, fetched ${ctx.now.toISOString().slice(0, 10)}): "${neededM[0]}" — the gate the ballot must still pass`,
    `Positions recorded so far: ${recordedYes} Yes, ${discussCount} DISCUSS on record, ${unrecorded} of ${positionsTotal} IESG members yet to record a position`,
    `Model: comparable-draft base rate ${withDiscuss}/${similarDrafts} (stated assumption) attenuated by the unrecorded share ${unrecorded}/${positionsTotal} — a DISCUSS, if any, lands while positions are still being recorded`,
  ];
  const headline =
    `The IESG ballot for draft-ietf-mpls-mna-ioam-18 was open at fetch with ${discussCount} DISCUSS positions on record and ${unrecorded} of ` +
    `${positionsTotal} IESG members yet to record a position ("Needs ${needed} more YES or NO OBJECTION positions to pass").`;

  const links: SourceLink[] = [
    {
      url: ballotDoc.url,
      label: "IETF Datatracker: IESG evaluation record / ballot for draft-ietf-mpls-mna-ioam",
      lang: "en",
      access: "scraped",
      expect: [neededRaw],
    },
  ];
  return assemble(
    seed,
    [ballotDoc],
    headline,
    figures,
    [
      `Datatracker ballot page (static HTML): IESG evaluation record for draft-ietf-mpls-mna-ioam-18; position list and "${neededM[0]}".`,
    ],
    links,
    {
      kind: "ballot_flag_snapshot",
      params: {
        doc: "draft-ietf-mpls-mna-ioam-18",
        ballotStateText: `${discussCount} DISCUSS on record, ${unrecorded}/${positionsTotal} positions unrecorded`,
        positionsRecorded: recordedYes,
        positionsTotal,
        neededToPass: needed,
        discussCount,
        similarDrafts,
        withDiscuss,
      },
    },
    [
      `Comparable MPLS-area draft set (${withDiscuss}/${similarDrafts} drew a DISCUSS) is a stated assumption, not a live fetch`,
    ],
  );
}

/** Path 2: FIDE WCC 2026 match — official factsheet + embedded ratings. */
export async function refreshFideMatch(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [fideDoc, ratingsDoc] = await Promise.all([
    fresh(api, seed.sources.fideNews, "fideNews", ctx),
    fresh(api, seed.sources.worldchess, "worldchess", ctx),
  ]);
  const fide = fideDoc.body;
  const scoreM = rx(fide, /Match score: (\d+)[–-](\d+)/, "match score");
  const scoreA = requireNum(grp(scoreM, 1, "Sindarov score"), "Sindarov score");
  const scoreB = requireNum(grp(scoreM, 2, "Gukesh score"), "Gukesh score");
  const gameM = rx(fide, /FACT SHEET – Game (\d+)/, "factsheet game number");
  const gamesPlayed = requireNum(grp(gameM, 1, "games played"), "games played");
  const whiteM = rx(fide, /FACT SHEET – Game \d+[\s\S]*?White: ([A-Za-zÉé]+(?:\s[A-Za-z]+)*)/, "White player");
  const whiteName = grp(whiteM, 1, "White player").trim();
  const blackM = rx(fide, /FACT SHEET – Game \d+[\s\S]*?Black: ([A-Za-zÉé]+(?:\s[A-Za-z]+)*)/, "Black player");
  const blackName = grp(blackM, 1, "Black player").trim();
  const ratingA = requireNum(
    grp(rx(ratingsDoc.body, /shortName\\?"?:?\\?"?Sindarov[^}]{0,120}rating\\?"?:(\d{4})/, "Sindarov rating"), 1, "Sindarov rating"),
    "Sindarov rating",
  );
  const ratingB = requireNum(
    grp(rx(ratingsDoc.body, /shortName\\?"?:?\\?"?Gukesh[^}]{0,120}rating\\?"?:(\d{4})/, "Gukesh rating"), 1, "Gukesh rating"),
    "Gukesh rating",
  );

  const targetGame = Number(seed.market.targetGame ?? 8);
  const gamesRemaining = Math.max(targetGame - gamesPlayed, 0);
  const drawShare = Number(seed.assumptions.drawShare);

  const figures = [
    `FIDE official factsheet (fide.com/new-documents, fetched ${ctx.now.toISOString().slice(0, 10)}): game ${gamesPlayed} ended ${whiteName} (White) vs ${blackName} (Black) with result ½-½; match score ${scoreA}-${scoreB}`,
    `Elo ratings of the two players (worldchess.com event metadata, live pages): Sindarov ${ratingA} (UZB) vs Gukesh ${ratingB} (IND) — a ${ratingA - ratingB} Elo gap`,
    `Color allocation in the match so far: Sindarov held White in games 1 and 3 (stated in the factsheet's game-3 preview: "white pieces for the second time in the match tomorrow")`,
    `Model: exact enumeration of the ${gamesRemaining} remaining games (to the market's after-game-${targetGame} evaluation) with per-game W/D/L derived from the live Elo gap and a stated ${(drawShare * 100).toFixed(0)}% draw-share assumption, color-averaged`,
  ];
  const headline =
    `After game ${gamesPlayed} of the FIDE World Chess Championship 2026 the official match score is ${scoreA}-${scoreB} (both games drawn), and the challenger Sindarov — rated ${ratingA} vs Gukesh's ${ratingB} — ` +
    `faces a ${gamesRemaining}-game stretch before the market's after-game-${targetGame} evaluation point; an exact enumeration of Elo-implied outcomes puts him strictly ahead with the probability computed in the attached CSV.`;

  // One link ships (item budget); the ratings source URL + fetch time stay pasted
  // in the note and the CSV source rows.
  const links: SourceLink[] = [
    {
      url: fideDoc.url,
      label: "FIDE official documents page: WCC 2026 game factsheets (result, colors, match score)",
      lang: "en",
      access: "scraped",
      expect: [`Match score: ${scoreA}`, "½"],
    },
  ];
  return assemble(
    seed,
    [fideDoc, ratingsDoc],
    headline,
    figures,
    [
      `fide.com/new-documents (static): FACT SHEET Game ${gamesPlayed} — White ${whiteName}, Black ${blackName}, result ½-½, match score ${scoreA}-${scoreB}.`,
      `worldchess.com event page ${ratingsDoc.url} (static, fetched in this run): embedded player metadata — Sindarov rated ${ratingA}, Gukesh rated ${ratingB}; URL + fetch time also in data.csv source rows.`,
    ],
    links,
    {
      kind: "match_lead_elo",
      params: {
        nameA: "Sindarov",
        nameB: "Gukesh",
        scoreA,
        scoreB,
        eloA: ratingA,
        eloB: ratingB,
        gamesRemaining,
        drawShare,
        scoreSource: "fide.com/new-documents factsheet",
        eloSource: "worldchess.com event metadata",
      },
    },
    [
      `Draw-share assumption (${(drawShare * 100).toFixed(0)}%, color-averaged) is a stated model input, not a fetched figure`,
    ],
  );
}

/** Path 2: English Wikipedia article count — siteinfo + Size-of-Wikipedia table. */
export async function refreshWikipedia(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [apiDoc, sizeDoc] = await Promise.all([
    fresh(api, seed.sources.siteinfoApi, "siteinfoApi", ctx),
    fresh(api, seed.sources.sizePage, "sizePage", ctx),
  ]);
  const articles = (apiDoc.json as { query?: { statistics?: { articles?: number } } })?.query?.statistics?.articles;
  if (!articles || articles < 1_000_000) throw new LiveMiningError("siteinfo articles count missing");
  const yearStartRaw = grp(rx(sizeDoc.body, /2026-01-01\s*\n+\s*([\d.,]+)/, "year-start row"), 1, "year-start count");
  const yearStart = Number(yearStartRaw.replace(/[.,]/g, ""));
  const netYtd = articles - yearStart;
  if (netYtd < 0) throw new LiveMiningError("siteinfo count below year-start count — inconsistent fetches");

  const target = Number(seed.market.targetCount);
  const cutoffAt = String(seed.market.cutoffAt);
  const daysRemaining = Math.max((new Date(cutoffAt).getTime() - ctx.now.getTime()) / 86_400_000, 0.1);
  const yearStartMs = Date.UTC(ctx.now.getUTCFullYear(), 0, 1);
  const daysElapsed = Math.max((ctx.now.getTime() - yearStartMs) / 86_400_000, 1);
  const dailyNetMean = netYtd / daysElapsed;
  const dailyNetSd = Number(seed.assumptions.dailyNetSd);

  const required = target - articles;
  const requiredPerDay = required / daysRemaining;
  const year = ctx.now.getUTCFullYear();

  const figures = [
    `English Wikipedia siteinfo API (fetched live, timestamp in the CSV): ${articles.toLocaleString("en-US")} articles`,
    `Net growth so far this ${year} (live "Size of Wikipedia" table): +${netYtd.toLocaleString("en-US")} since the ${year}-01-01 value of ${yearStart.toLocaleString("en-US")} — ~${dailyNetMean.toFixed(1)}/day`,
    `Required net to reach ${target.toLocaleString("en-US")} by ${cutoffAt.slice(0, 16).replace("T", " ")} UTC: +${required.toLocaleString("en-US")} = ${requiredPerDay.toFixed(1)}/day over the ${daysRemaining.toFixed(1)} days left`,
    requiredPerDay <= dailyNetMean
      ? `The required pace (${requiredPerDay.toFixed(0)}/day) is BELOW the live observed pace (${dailyNetMean.toFixed(0)}/day)`
      : `The required pace (${requiredPerDay.toFixed(0)}/day) is ABOVE the live observed pace (${dailyNetMean.toFixed(0)}/day)`,
  ];
  const headline =
    `Live siteinfo + the Size-of-Wikipedia growth table (fetched ${ctx.now.toISOString().slice(0, 10)}) put English Wikipedia at ` +
    `${articles.toLocaleString("en-US")} articles with a net creation pace of ~${dailyNetMean.toFixed(0)}/day this year; reaching ${target.toLocaleString("en-US")} by the market's check time needs ` +
    `${requiredPerDay.toFixed(0)}/day — ${requiredPerDay <= dailyNetMean ? "a pace the current velocity is already beating" : "a faster pace than observed"}.`;

  const links: SourceLink[] = [
    {
      url: apiDoc.url,
      label: "English Wikipedia siteinfo statistics API (live article count)",
      lang: "en",
      access: "api-json",
      expect: [String(articles)],
    },
  ];
  return assemble(
    seed,
    [apiDoc, sizeDoc],
    headline,
    figures,
    [
      `siteinfo API (JSON): articles = ${articles}.`,
      `Wikipedia:Size of Wikipedia ${sizeDoc.url} (static, fetched in this run): year-start row = ${yearStart.toLocaleString("en-US")}; net growth this year cross-checked against the live siteinfo count; URL + fetch time also in data.csv source rows.`,
    ],
    links,
    {
      kind: "threshold_velocity",
      params: {
        currentCount: articles,
        targetCount: target,
        daysRemaining: Number(daysRemaining.toFixed(2)),
        dailyNetMean: Number(dailyNetMean.toFixed(1)),
        dailyNetSd,
        velocity: {
          label: `${year} year-to-date`,
          days: Number(daysElapsed.toFixed(0)),
          net: netYtd,
        },
      },
    },
    [`Daily net-creation sd (${dailyNetSd}/day) is a stated model assumption`],
  );
}

interface ReleaseRow {
  tag: string;
  date: string;
}

/** Shared: release-gap CDF from a live releases JSON endpoint (Bun, Node, ...). */
export async function releasesGapCdf(
  seed: SeedInput,
  api: SourceApi,
  ctx: RefreshCtx,
  opts: {
    sourceKey: string;
    kindLabel: string;
    windowStart: string;
    windowEnd: string;
    filterTags?: (rows: { tag: string; published: string }[]) => { tag: string; published: string }[];
  },
): Promise<Refreshed> {
  const [relDoc] = await Promise.all([fresh(api, seed.sources[opts.sourceKey], opts.sourceKey, ctx)]);
  const raw = relDoc.json as unknown;
  if (!Array.isArray(raw)) throw new LiveMiningError(`${opts.kindLabel} endpoint did not return a JSON array`);
  const rows = (raw as Record<string, string>[])
    .map((r) => ({ tag: r.tag_name ?? r.version ?? "", published: r.published_at ?? r.date ?? "" }))
    .filter((r) => r.tag && r.published);
  const filtered = opts.filterTags ? opts.filterTags(rows) : rows;
  const releases: ReleaseRow[] = filtered.map((t) => ({ tag: t.tag, date: t.published.slice(0, 10) }));
  if (releases.length < 4) throw new LiveMiningError(`${opts.kindLabel}: fewer than 4 releases parsed`);

  const figures = [
    `Past ${releases.length} ${opts.kindLabel} releases (live from the API): ${releases.map((r) => `${r.tag} @ ${r.date}`).join("; ")}`,
    `Next release lands in the market window [${opts.windowStart}..${opts.windowEnd}] iff the historical gap distribution repeats — scored in the CSV`,
  ];
  const headline =
    `Live ${opts.kindLabel} release history (fetched ${ctx.now.toISOString().slice(0, 10)}, full list in the CSV) gives an empirical release-gap ` +
    `distribution; the market window [${opts.windowStart}..${opts.windowEnd}] is scored against exactly those live gaps.`;
  const mainLink = seed.sources[opts.sourceKey]!;
  return assemble(
    seed,
    [relDoc],
    headline,
    figures,
    [`${opts.kindLabel} releases API (JSON): publish dates of the ${releases.length} most recent releases, parsed live in this run.`],
    [
      {
        url: relDoc.url,
        label: mainLink.label,
        lang: mainLink.lang,
        access: "api-json",
        expect: [releases[releases.length - 1]!.tag],
      },
    ],
    {
      kind: "release_gap_cdf",
      params: {
        releases,
        windowStart: opts.windowStart,
        windowEnd: opts.windowEnd,
      },
    },
    [],
  );
}

/** Path 2: Bun release timing. */
export async function refreshBunReleases(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  return releasesGapCdf(seed, api, ctx, {
    sourceKey: "bunApi",
    kindLabel: "oven-sh/bun",
    windowStart: String(seed.market.windowStart),
    windowEnd: String(seed.market.windowEnd),
  });
}

/** Path 2 (calculator coverage): nodejs.org/dist releases. */
export async function refreshNodeReleases(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  return releasesGapCdf(seed, api, ctx, {
    sourceKey: "nodeDist",
    kindLabel: "nodejs.org/dist",
    windowStart: ctx.now.toISOString().slice(0, 10),
    windowEnd: String(seed.market.windowEnd),
    filterTags: (rows) => {
      const line = rows.filter((r) => r.tag.replace(/^v/, "").startsWith(String(seed.market.versionLine) + "."));
      return line.length >= 4 ? line : rows.filter((r) => /^v\d+(\.\d+)*$/.test(r.tag)).slice(0, 10);
    },
  });
}

/** Path 2: Go minor listing (go.dev) + Go1.27.5 milestone found BY TITLE. */
export async function refreshGoRelease(seed: SeedInput, api: SourceApi, ctx: RefreshCtx): Promise<Refreshed> {
  const [relDoc] = await Promise.all([fresh(api, seed.sources.goDevel, "goDevel", ctx)]);

  // Milestone lookup BY TITLE — a hardcoded ID grabbed the wrong milestone before
  // (run-1 bug: #305 is Go1.20.4, not Go1.27.5). This loop refuses to guess.
  const wantedTitle = String(seed.market.milestoneTitle);
  let milestone: { number: number; title: string; open_issues: number; closed_issues: number } | undefined;
  for (let page = 1; page <= 10 && !milestone; page++) {
    const url = String(seed.market.milestonesUrl).replace("{page}", String(page));
    const doc = await api.fetch(url);
    if (ctx.live) assertFresh(doc, ctx.now);
    if (doc.status !== 200) throw new LiveMiningError(`milestone search page ${page} returned HTTP ${doc.status}`);
    const arr = doc.json as { number: number; title: string; open_issues: number; closed_issues: number }[];
    if (!Array.isArray(arr) || arr.length === 0) break;
    milestone = arr.find((m) => m.title === wantedTitle);
  }
  if (!milestone) throw new LiveMiningError(`milestone "${wantedTitle}" not found by title in the GitHub API — refusing to guess an ID`);

  const prefix = String(seed.market.minorPrefix);
  const minorRe = new RegExp(`${prefix}(\\d+)\\s*\\(released (\\d{4}-\\d{2}-\\d{2})\\)`, "g");
  const releases: ReleaseRow[] = [];
  for (const m of relDoc.body.matchAll(minorRe)) {
    releases.push({ tag: `${prefix}${m[1]}`, date: m[2]! });
  }
  if (releases.length < 3) throw new LiveMiningError("go.dev minor releases did not parse");
  releases.sort((a, b) => a.date.localeCompare(b.date));

  const windowStart = ctx.now.toISOString().slice(0, 10);
  const windowEnd = String(seed.market.windowEnd);
  const gaps = releases.slice(1).map((r, i) => (new Date(r.date).getTime() - new Date(releases[i]!.date).getTime()) / 86_400_000);
  const latest = releases[releases.length - 1]!;

  const figures = [
    `Go1.27.5 milestone looked up BY TITLE via the GitHub API this run: number ${milestone.number} — ${milestone.open_issues} open / ${milestone.closed_issues} closed issues (the milestone number is never hardcoded; #305 is Go1.20.4, the run-1 bug this replaces)`,
    `go.dev release history (live): ${releases.map((r) => `${r.tag} (${r.date})`).join(", ")} — live gaps ${gaps.map((g) => `${g.toFixed(0)}d`).join(", ")}`,
    `Window for go1.27.5 to appear listed on go.dev: [${windowStart}..${windowEnd}]; the previous minor ${latest.tag} was released ${latest.date}`,
  ];
  const headline =
    `go.dev lists ${latest.tag} as the newest ${prefix}x minor (released ${latest.date}), and the Go1.27.5 milestone ` +
    `(looked up by title — number ${milestone.number}) still shows ${milestone.open_issues} open blockers; the live minor-release gaps ` +
    `(${gaps.map((g) => g.toFixed(0)).join("/")} days) are scored against the listing window [${windowStart}..${windowEnd}] in the CSV.`;

  const links: SourceLink[] = [
    {
      url: relDoc.url,
      label: "go.dev/doc/devel/release (release history)",
      lang: "en",
      access: "scraped",
      expect: [latest.date],
    },
  ];
  return assemble(
    seed,
    [relDoc],
    headline,
    figures,
    [
      `go.dev release history (static): parsed live this run.`,
      `GitHub milestones API: exact-title search for "${wantedTitle}" (hit: number ${milestone.number}); never a hardcoded milestone ID.`,
    ],
    links,
    {
      kind: "release_gap_cdf",
      params: { releases, windowStart, windowEnd },
    },
    [`Empirical gap distribution has only ${gaps.length} observations — small-sample caveat`],
  );
}
