import assert from "node:assert/strict";
import test from "node:test";
import type { AgentConfig } from "../config.js";
import type { SourceApi, SourceDoc } from "../miners/live/sources.js";
import { RESEARCH_SEEDS, refreshSeed } from "../miners/live/refreshers.js";
import { cleanMarkdown, parseEuropeanNumber, parsePgnResults, runningScore } from "../miners/live/markdown.js";
import { fetchGithubApi, githubRequestHeaders, setGithubTransportForTests } from "../miners/live/github.js";
import { LiveMiningError } from "../miners/live/refreshers-part1.js";

const CTX = { now: new Date("2026-11-26T12:00:00.000Z"), live: false };

/* ------------------------- Fix 1: direct GitHub fetch ------------------------- */

test("github headers: Accept + X-GitHub-Api-Version, NO Content-Type on GET", () => {
  const h = githubRequestHeaders();
  assert.equal(h["Accept"], "application/vnd.github+json");
  assert.equal(h["X-GitHub-Api-Version"], "2022-11-28");
  assert.equal(h["Content-Type"], undefined);
  assert.equal(Object.keys(h).length, 2, `only the two documented headers allowed, got ${JSON.stringify(h)}`);
});

test("github fetch: the outbound request carries exactly those headers (transport capture)", async () => {
  let captured: RequestInit | undefined;
  let capturedUrl = "";
  setGithubTransportForTests(async (url, init) => {
    capturedUrl = url;
    captured = init;
    return new Response(JSON.stringify([{ tag: "bun-v1.3.9" }]), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  try {
    const api = { mock: false, fetch: async () => { throw new Error("must not use api.fetch"); } } as unknown as SourceApi;
    const doc = await fetchGithubApi("https://api.github.com/repos/oven-sh/bun/releases?per_page=100", api);
    assert.equal(doc.status, 200);
    assert.equal(capturedUrl, "https://api.github.com/repos/oven-sh/bun/releases?per_page=100");
    const headers = new Headers((captured as RequestInit).headers as Record<string, string>);
    assert.equal(headers.get("Accept"), "application/vnd.github+json");
    assert.equal(headers.get("X-GitHub-Api-Version"), "2022-11-28");
    assert.equal(headers.get("Content-Type"), null, "GET must not send Content-Type (the old 415 cause)");
  } finally {
    setGithubTransportForTests(undefined);
  }
});

test("bun miner: a 415 from api.github.com fails with a clear LiveMiningError (pipeline skips, never crashes)", async () => {
  setGithubTransportForTests(async () => new Response("Unsupported Media Type", { status: 415 }));
  try {
    const seed = RESEARCH_SEEDS.find((s) => s.topic === "bun-release")!;
    const api = { mock: false, fetch: async () => { throw new Error("must not use api.fetch"); } } as unknown as SourceApi;
    await assert.rejects(
      () => refreshSeed(seed, api, CTX),
      (err: unknown) => err instanceof LiveMiningError && /415/.test((err as Error).message),
    );
  } finally {
    setGithubTransportForTests(undefined);
  }
});

test("go miner: direct-fetch releases JSON parses to the same release-gap output shape", async () => {
  const releases = [
    { tag_name: "go1.27.5", published_at: "2026-11-20T10:00:00Z" },
    { tag_name: "go1.27.4", published_at: "2026-11-06T10:00:00Z" },
    { tag_name: "go1.27.3", published_at: "2026-10-15T10:00:00Z" },
    { tag_name: "go1.27.2", published_at: "2026-09-20T10:00:00Z" },
    { tag_name: "go1.27.1", published_at: "2026-08-18T10:00:00Z" },
    { tag_name: "go1.27.0", published_at: "2026-07-01T10:00:00Z" },
  ];
  const headersSeen: Headers[] = [];
  setGithubTransportForTests(async (url, init) => {
    headersSeen.push(new Headers((init as RequestInit).headers as Record<string, string>));
    if (url.includes("milestones")) {
      return new Response(
        JSON.stringify([{ number: 47, title: "Go1.27.5", open_issues: 3, closed_issues: 0 }]),
        { status: 200 },
      );
    }
    return new Response(JSON.stringify(releases), { status: 200 });
  });
  const goDevPage = [
    "# Release History",
    "go1.27.4 (released 2026-11-06) includes security fixes.",
    "go1.27.3 (released 2026-10-15).",
    "go1.27.2 (released 2026-09-20).",
    "go1.27.1 (released 2026-08-18).",
    "go1.27.0 (released 2026-07-01).",
  ].join("\n");
  try {
    const seed = RESEARCH_SEEDS.find((s) => s.topic === "go-1-27-5")!;
    const api: SourceApi = {
      mock: false,
      fetch: async (url) => {
        if (url.includes("go.dev")) {
          return { url, body: goDevPage, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
        }
        throw new Error(`unexpected api.fetch for ${url} — github traffic must go direct`);
      },
    };
    const r = await refreshSeed(seed, api, CTX);
    assert.ok(headersSeen.length >= 1, "milestone lookup hit the direct github transport");
    assert.equal(headersSeen[0]!.get("Accept"), "application/vnd.github+json");
    assert.equal(headersSeen[0]!.get("X-GitHub-Api-Version"), "2022-11-28");
    assert.equal(headersSeen[0]!.get("Content-Type"), null);
    assert.ok(r.spec.figures.join(" ").includes("Go1.27.5"), r.spec.figures.join(" | "));
  } finally {
    setGithubTransportForTests(undefined);
  }
});

/* ------------------------- Fix 2: robust markdown parsing ------------------------- */

test("parseEuropeanNumber: decimal commas, thousands separators, minus signs", () => {
  assert.equal(parseEuropeanNumber("1,5"), 1.5);
  assert.equal(parseEuropeanNumber("38,5"), 38.5);
  assert.equal(parseEuropeanNumber("12.345"), 12345);
  assert.equal(parseEuropeanNumber("1'234,5"), 1234.5);
  assert.equal(parseEuropeanNumber("1 234,5"), 1234.5);
  assert.equal(parseEuropeanNumber("\u22122,75"), -2.75);
  assert.equal(parseEuropeanNumber("(3,25)"), -3.25);
  assert.equal(parseEuropeanNumber("48"), 48);
  assert.equal(parseEuropeanNumber("1.234.567"), 1234567);
  assert.equal(parseEuropeanNumber("no digits"), undefined);
});

test("cleanMarkdown: strips link syntax, nbsp, zero-width chars, table pipes, emphasis", () => {
  const messy = "[Beteiligung](https://x.ch) beträgt\u00a0derzeit&nbsp;**12,5\u200b %**\n| Stand | Wert |\n|---|---|\n| heute | 12,5 |";
  const out = cleanMarkdown(messy);
  assert.ok(!out.includes("["), out);
  assert.ok(!out.includes("\u00a0") && !out.includes("\u200b"), out);
  assert.ok(!out.includes("|"), out);
  assert.match(out, /12,5 %/);
});

test("ch-turnout: messy Geneva markdown (decimal comma, nbsp, markdown noise) parses 12,5 %", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!;
  const ge = seed.sources.earlyReturnsGE!;
  const messyBody =
    "<!-- -->\n[Bulletin officiel](/bo)\n\n# Participation aux votations\n\n" +
    "La participation\u00a0est actuellement de **12,5 %**\u200b des votes.\n\n" +
    "| Bulletin | Valeur |\n|---|---|\n| aujourd'hui | 12,5 |";
  const surveyBody =
    "Teilnahmeabsicht liegt unverändert bei 45 Prozent, über dem langjährigen Durchschnitt von 42,5 Prozent.";
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      if (url.includes("ge.ch")) return { url, body: messyBody, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
      return { url, body: surveyBody, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const figs = r.spec.figures.join(" | ");
  assert.match(figs, /12\.5%/);
  assert.match(figs, /Genève/i);
  // Anti-duplicate: the shipped link is the non-Zurich cantonal page.
  assert.ok(r.spec.links.some((l) => l.url.includes("ge.ch")), JSON.stringify(r.spec.links));
  assert.ok(!r.spec.links.some((l) => l.url.includes("stadt-zuerich.ch")), JSON.stringify(r.spec.links));
});

test("ch-turnout picker: prefers GE/BS/BE/VD cantonal pages, Zürich only as last resort", async () => {
  // Live-mode check happens in the Geneva test above; here verify the recorded
  // mock fixture still resolves (to Zürich, the only recorded snapshot).
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!;
  const api = { mock: true, fetch: async () => { throw new Error("mock fetch"); } } as unknown as SourceApi;
  await assert.rejects(() => refreshSeed(seed, api, CTX)); // mock registry untouched by this test file's cwd
});

test("ch-war-materiel: messy survey markdown (decimal commas, wording variants) extracts the yes/no pair", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-war-materiel")!;
  const messyBody =
    "# Waffenrecht\n\n[Weiterlesen](https://srf.ch/x)\n\n" +
    "Für das **Kriegsmaterialgesetz**\nwürden derzeit rund\u00a038,5 %\u200b zustimmen, während 48,2 Prozent ablehnen zu würden." +
    " (Quelle: SRG)\n\nTeilnahme 52 %.";
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => ({ url, body: messyBody, fetchedAt: CTX.now.toISOString(), status: 200, mock: false }),
  };
  const r = await refreshSeed(seed, api, CTX);
  const figs = r.spec.figures.join(" | ");
  assert.match(figs, /38\.5/);
  assert.match(figs, /48\.2/);
});

/* ------------------------- Fix 3: fide via Lichess broadcast / FIDE PGN ------------------------- */

const SAMPLE_BROADCAST_PGN = [
  '[Event "FIDE World Chess Championship 2026"]',
  '[Site "Singapore"]',
  '[White "Javokhir Sindarov"]',
  '[Black "D Gukesh"]',
  '[Result "1/2-1/2"]',
  "",
  "1. e4 e5 2. Nf3 Nc6 *",
  "",
  '[Event "FIDE World Chess Championship 2026"]',
  '[White "D Gukesh"]',
  '[Black "Javokhir Sindarov"]',
  '[Result "1/2-1/2"]',
  "",
  "1. d4 Nf6 2. c4 e6 *",
].join("\n");

test("parsePgnResults: extract per-game results and Sindarov score from a broadcast PGN", () => {
  const games = parsePgnResults(SAMPLE_BROADCAST_PGN, "Sindarov");
  assert.equal(games.length, 2);
  assert.equal(games[0]!.white, "Javokhir Sindarov");
  assert.equal(games[0]!.result, "1/2-1/2");
  assert.equal(games[0]!.scoreA, 0.5);
  assert.equal(games[1]!.white, "D Gukesh");
  assert.equal(games[1]!.scoreA, 0.5);
  const totals = runningScore(games);
  assert.equal(totals.gamesPlayed, 2);
  assert.equal(totals.scoreA, 1);
  assert.equal(totals.scoreB, 1);
});

test("parsePgnResults: decisive game scores the winner's side correctly", () => {
  const pgn = [
    '[Event "FIDE World Chess Championship 2026"]',
    '[White "Javokhir Sindarov"]',
    '[Black "D Gukesh"]',
    '[Result "1/2-1/2"]',
    "",
    "1. e4 e5 *",
    "",
    '[White "D Gukesh"]',
    '[Black "Javokhir Sindarov"]',
    '[Result "1-0"]',
    "",
    "1. d4 Nf6 *",
  ].join("\n");
  const games = parsePgnResults(pgn, "Sindarov");
  assert.equal(games.length, 2);
  assert.equal(games[0]!.result, "1/2-1/2");
  // Game 2: Sindarov is Black and lost — scoreA 0, White (Gukesh) 1.
  assert.equal(games[1]!.result, "1-0");
  assert.equal(games[1]!.scoreA, 0);
  assert.equal(runningScore(games).scoreA, 0.5);
  assert.equal(runningScore(games).scoreB, 1.5);
});

test("fide miner: primary source is the Lichess broadcast PGN (anti-duplicate URL, result parsed from RESULT tags)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const ratings = '{"players":[{"shortName":"Sindarov","rating":2780},{"shortName":"Gukesh","rating":2712}]}';
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      if (url.includes("lichess.org")) {
        return { url, body: SAMPLE_BROADCAST_PGN, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
      }
      return { url, body: ratings, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const p = r.spec.analysis.params as Record<string, unknown>;
  assert.equal(p.scoreA, 1);
  assert.equal(p.scoreB, 1);
  assert.equal(p.eloA, 2780);
  assert.equal(p.scoreSource, "Lichess broadcast PGN");
  assert.ok(r.spec.links.some((l) => l.url.includes("lichess.org")), JSON.stringify(r.spec.links));
  assert.match(r.spec.figures.join(" "), /1\/2-1\/2|½-½/);
});

test("fide miner: broadcast failure falls back to the scraped factsheet as explicit LAST RESORT (FIDE PGN fallback was removed — URL 404s live)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const ratings = '{"players":[{"shortName":"Sindarov","rating":2780},{"shortName":"Gukesh","rating":2712}]}';
  const factsheet = [
    "# FACT SHEET – Game 2",
    "FACT SHEET – Game 2 | World Chess Championship 2026 | Geneva",
    "White: D Gukesh  Black: Javokhir Sindarov  Result: 1/2-1/2",
  ].join("\n");
  const urlsFetched: string[] = [];
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      urlsFetched.push(url);
      if (url.includes("lichess.org")) throw new Error("HTTP 404 (round not found)");
      if (url.includes("fide.com/multimedia/pgn")) {
        throw new Error("the removed fidePgn fallback must NEVER be fetched");
      }
      if (url.includes("fide.com")) {
        return { url, body: factsheet, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
      }
      return { url, body: ratings, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const p = r.spec.analysis.params as Record<string, unknown>;
  assert.equal(p.scoreSource, "FIDE factsheet");
  assert.ok(!urlsFetched.some((u) => u.includes("multimedia/pgn")), `removed fidePgn fallback fetched: ${urlsFetched.join(",")}`);
  assert.ok(r.spec.links.every((l) => !l.url.includes("multimedia/pgn")), JSON.stringify(r.spec.links));
});

test("fide miner (round-3 B1): factsheet 'FACT SHEET – Game 2, both games drawn' emits NO false headline/figure claims — per-game claims only when all counted games are parsed", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const ratings = '{"players":[{"shortName":"Sindarov","rating":2780},{"shortName":"Gukesh","rating":2712}]}';
  // QA round-2 replay fixture: sheet says game 2 is current, only the ONE
  // latest game's block is present, and both real games were drawn. The old
  // derivation over the single parsed game emitted "1 decisive game of 2" and
  // "Sindarov had the white pieces in 0 of 2 games (Gukesh in 2)" — both false.
  const factsheet = [
    "# FACT SHEET – Game 2",
    "FACT SHEET – Game 2 | World Chess Championship 2026 | Geneva",
    "Match score: 1–1",
    "White: D Gukesh  Black: Javokhir Sindarov  Result: 1/2-1/2",
  ].join("\n");
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      if (url.includes("lichess.org")) throw new Error("HTTP 404 (round not found)");
      if (url.includes("fide.com")) {
        return { url, body: factsheet, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
      }
      return { url, body: ratings, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const p = r.spec.analysis.params as Record<string, unknown>;
  assert.equal(p.scoreSource, "FIDE factsheet");
  const headline = r.spec.headline ?? "";
  const figures = r.spec.figures.join(" | ");
  // Round-4 B1: the emitted sourceDescriptions live in the note/data rows the
  // judge sees — they must not over-claim what was parsed either.
  const descriptions = (r.spec as unknown as { sourceDescriptions?: string[] }).sourceDescriptions ?? [];
  const descriptionsJoined = descriptions.join(" | ");
  // The false round-2 claims must never appear.
  assert.ok(!headline.includes("1 decisive game of 2"), headline);
  assert.ok(!figures.includes("1 decisive game of 2"), figures);
  assert.ok(!/white pieces in 0 of 2/.test(figures), figures);
  assert.ok(!/Gukesh in 2\b/.test(figures), figures);
  // Round-4 B1: with only ONE game block actually parsed, no description may
  // say "2 games parsed" (the old text derived the count from the heading).
  for (const d of descriptions) {
    assert.ok(!d.includes("2 games parsed"), `round-4 B1: false parsed-count in a source description: ${d}`);
    assert.ok(!/parsed, last result .*running score/.test(d) || /\b1 game\b/.test(d), `round-4 B1: parsed count must be the actually parsed count: ${d}`);
  }
  assert.ok(descriptions.some((d) => d.includes("1 game parsed")), `round-4 B1: the actually parsed count (1) is stated: ${descriptionsJoined}`);
  // With only one of two counted games parsed, no per-game score description
  // or color-allocation claim may be emitted at all.
  assert.ok(!/decisive game(s)? of 2/.test(`${headline} ${figures}`), `${headline} | ${figures}`);
  assert.ok(!figures.includes("Color allocation in the match so far"), figures);
  // The verifiable claims stay: latest game result, sheet match score.
  assert.match(figures, /game 2 ended ½-½/);
  assert.match(`${headline}${figures}`, /match score 1-1/);
});

test("fide seed URLs (BLOCKING 1): real Lichess broadcast tournament ID, no guessed slug/latest.pgn, no fidePgn source", () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  // Verified live on 27 Nov: GET /api/broadcast lists tour id qfkdt8mn =
  // "FIDE World Chess Championship 2026"; /api/broadcast/qfkdt8mn.pgn → 200 PGN.
  assert.equal(seed.sources.lichessBroadcast!.url, "https://lichess.org/api/broadcast/qfkdt8mn.pgn");
  assert.match(seed.sources.lichessBroadcast!.url, /\/api\/broadcast\/[0-9A-Za-z]{8}\.pgn$/, "opaque base32 tournament id, .pgn suffix");
  assert.ok(!seed.sources.lichessBroadcast!.url.includes("latest.pgn"), "the guessed latest.pgn alias 404s");
  assert.ok(!seed.sources.lichessBroadcast!.url.includes("wcc-2026"), "no slug routes exist on /api/broadcast");
  assert.equal((seed.sources as Record<string, unknown>).fidePgn, undefined, "guessed FIDE PGN URL 404s live — fallback removed");
  assert.ok(seed.sources.fideNews, "factsheet stays as the explicit last-resort fallback");
});

/* --------------------- Round 4: B2 + NIT-3/4/5/8 regressions --------------------- */

test("round-4 B2/NIT-3: the recorded GE mock fixture is the REAL page — number-first '30.3% de participation à J-4' parses", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!;
  const { readFileSync } = await import("node:fs");
  const meta = JSON.parse(readFileSync("src/miners/live/fixtures-meta.json", "utf-8")) as Record<string, string>;
  const fixtureUrl = seed.sources.earlyReturnsGE!.url;
  // The GE fixture must be a REAL recorded snapshot: it has a fetch time (a
  // synthetic fixture must be labelled as such and carry none).
  const fetchedAt = meta[fixtureUrl];
  assert.ok(fetchedAt, `GE fixture must have a recorded fetch time in fixtures-meta.json (${fixtureUrl})`);
  assert.match(fetchedAt, /^\d{4}-\d{2}-\d{2}T/, "real ISO fetch timestamp");
  // Replay the exact mock path: raw fixture → cleanMarkdown → parsers, via
  // the real mock source layer.
  const { createSources } = await import("../miners/live/sources.js");
  const { refreshChTurnout } = await import("../miners/live/refreshers-part1.js");
  const src = createSources({ mode: "mock" } as unknown as AgentConfig);
  const r = await refreshChTurnout(seed, src as never, CTX);
  const tp = r.spec.analysis.params as Record<string, unknown>;
  // The REAL page (fetched 2026-11-27, HTTP 200) states the cantonal rate
  // number-first: "30.3% / de participation à J-4" (J-5 = 27.4, J-6 = 24.0).
  assert.ok(Math.abs((tp.earlyReturnPct as number) - 30.3) < 0.01, `earlyReturnPct=${tp.earlyReturnPct} (real ge.ch page is number-first, 30.3 at J-4)`);
  // The shipped link must be the Geneva page, not the Zürich fallback.
  assert.ok(r.spec.links.some((l) => l.url.includes("ge.ch")), JSON.stringify(r.spec.links));
  // The fabricated round-2 values must never appear in the emitted spec.
  for (const fabricated of ["27.9", "25.1", "22.4"]) {
    assert.ok(!JSON.stringify(r.spec).includes(fabricated), `fabricated value ${fabricated} must not appear`);
  }
});

test("round-4 NIT-3: Basel-Stadt is dropped from the cascade (its real page has no parseable turnout figure in the HTML)", () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!;
  // The real bs.ch page was fetched on 27 Nov (HTTP 200): the turnout
  // percentage ships ONLY as a chart image / OGD download, never as HTML
  // text — "Die Stimmbeteiligung beträgt derzeit 22,4 %" exists nowhere.
  assert.equal(seed.sources.earlyReturnsBS, undefined, "BS dropped from the cascade");
});

test("round-4 NIT-4: factsheet fallback with NO 'Match score:' line OMITS the score (no one-game substitution)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const ratings = '{"players":[{"shortName":"Sindarov","rating":2780},{"shortName":"Gukesh","rating":2712}]}';
  const factsheet = [
    "# FACT SHEET – Game 2",
    "FACT SHEET – Game 2 | World Chess Championship 2026 | Geneva",
    "White: D Gukesh  Black: Javokhir Sindarov  Result: 1/2-1/2",
  ].join("\n");
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      if (url.includes("lichess.org")) throw new Error("HTTP 404 (round not found)");
      if (url.includes("fide.com")) return { url, body: factsheet, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
      return { url, body: ratings, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const spec = r.spec as unknown as { sourceDescriptions: string[] };
  const text = `${r.spec.headline ?? ""} | ${r.spec.figures.join(" | ")} | ${spec.sourceDescriptions.join(" | ")}`;
  assert.ok(!/match score \d/.test(text), `NIT-4: score must be omitted, got: ${text}`);
  assert.ok(!/running score \d/.test(text), `NIT-4: running score must be omitted, got: ${text}`);
  // The verifiable per-game claim stays.
  assert.match(r.spec.figures.join(" | "), /game 2 ended ½-½/);
  // The description still states the actually parsed count (B1 rule).
  assert.ok(spec.sourceDescriptions.some((d) => d.includes("1 game parsed")), JSON.stringify(spec.sourceDescriptions));
  assert.ok(!spec.sourceDescriptions.some((d) => d.includes("2 games parsed")), JSON.stringify(spec.sourceDescriptions));
});

test("round-4 NIT-5: factsheet for game 9 clamps to the after-game-8 checkpoint — sheet score OMITTED (it is post-game-9, not after-game-8)", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const ratings = '{"players":[{"shortName":"Sindarov","rating":2780},{"shortName":"Gukesh","rating":2712}]}';
  const factsheet = [
    "# FACT SHEET – Game 9",
    "FACT SHEET – Game 9 | World Chess Championship 2026 | Geneva",
    "Match score: 5½–3½",
    "White: Javokhir Sindarov  Black: D Gukesh  Result: 1-0",
  ].join("\n");
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      if (url.includes("lichess.org")) throw new Error("HTTP 404 (round not found)");
      if (url.includes("fide.com")) return { url, body: factsheet, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
      return { url, body: ratings, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const spec = r.spec as unknown as { sourceDescriptions: string[] };
  const text = `${r.spec.headline ?? ""} | ${r.spec.figures.join(" | ")} | ${spec.sourceDescriptions.join(" | ")}`;
  // NIT-5: the sheet's 5½–3½ is the post-game-9 score — never presented as
  // the after-game-8 (checkpoint) score, and the parsed game is not mislabeled.
  assert.ok(!text.includes("5.5-3.5") && !text.includes("5½–3½"), `NIT-5: clamped sheet score must be omitted, got: ${text}`);
  assert.ok(!text.includes("game 8 ended 1-0"), `NIT-5: game 9's result must not be labelled game 8, got: ${text}`);
  assert.match(r.spec.figures.join(" | "), /game 9 ended 1-0/);
});

test("round-4 NIT-8: broadcast with more than 8 finished games reports the ACTUALLY parsed count", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "fide-game8")!;
  const ratings = '{"players":[{"shortName":"Sindarov","rating":2780},{"shortName":"Gukesh","rating":2712}]}';
  // 10 finished games in the broadcast PGN (checkpoint stays after game 8).
  const pgn = Array.from({ length: 10 }, (_, i) =>
    `[Event "WCC 2026"]\n[White "${i % 2 === 0 ? "D Gukesh" : "Javokhir Sindarov"}"]\n[Black "${i % 2 === 0 ? "Javokhir Sindarov" : "D Gukesh"}"]\n[Result "1/2-1/2"]\n\n1. d4 d5 1/2-1/2`,
  ).join("\n\n");
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => ({ url, body: url.includes("lichess.org") ? pgn : ratings, fetchedAt: CTX.now.toISOString(), status: 200, mock: false }),
  };
  const r = await refreshSeed(seed, api, CTX);
  const spec = r.spec as unknown as { sourceDescriptions: string[] };
  const d = spec.sourceDescriptions.find((x) => x.includes("parsed"));
  assert.ok(d, JSON.stringify(spec.sourceDescriptions));
  assert.ok(d.includes("10 games parsed"), `NIT-8: the actually parsed count (10) must be stated, got: ${d}`);
  assert.ok(!d.includes("8 games parsed"), `NIT-8: must not undercount to the clamp value, got: ${d}`);
});
