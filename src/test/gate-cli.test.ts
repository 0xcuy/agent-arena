import assert from "node:assert/strict";
import test from "node:test";
import type { SourceApi } from "../miners/live/sources.js";
import { RESEARCH_SEEDS, refreshSeed } from "../miners/live/refreshers.js";
import { LiveMiningError, parseDerzeitTurnoutPct, parseFrenchTurnoutPct, parseTrailingTurnoutPct } from "../miners/live/refreshers-part1.js";
import { parsePgnResults } from "../miners/live/markdown.js";
import { loadDraftManifests, listEvidence, limitsReport, entryStateReport } from "../gate-cli.js";
import { createDelphiApi } from "../delphi/client.js";
import { resolveConfig } from "../config.js";

const CTX = { now: new Date("2026-11-27T12:00:00.000Z"), live: false };

function apiReturning(bodies: Record<string, string | Error>): SourceApi {
  return {
    mock: false,
    fetch: async (url) => {
      for (const [needle, body] of Object.entries(bodies)) {
        if (url.includes(needle)) {
          if (body instanceof Error) throw body;
          return { url, body, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
        }
      }
      throw new Error(`unexpected fetch ${url}`);
    },
  } as SourceApi;
}

/* ---------------- BLOCKING 2: KM parser throws on an unanchored page ---------------- */

test("KM parser (BLOCKING 2): throws instead of guessing when neither anchor is on the page", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-war-materiel")!;
  // A gfs.bern-style page WITHOUT the Kriegsmaterialgesetz heading and WITHOUT
  // "enges Rennen" — but with another proposal's share pair first (the exact
  // silent-wrong-answer scenario from QA): the parser must throw, never emit.
  const unanchored =
    "# SRG Trendumfrage\n\n" +
    "Bei der AHV-Reform würden derzeit 61,3 % zustimmen, 35,1 Prozent ablehnen.\n\n" +
    "Die Stimmabgabe per Post läuft.";
  const api = apiReturning({ "gfsbern.ch": unanchored });
  await assert.rejects(
    () => refreshSeed(seed, api, CTX),
    (err: unknown) =>
      err instanceof LiveMiningError &&
      /KM poll section not found/.test((err as Error).message) &&
      /refusing to guess/.test((err as Error).message),
  );
});

test("KM parser: still extracts the anchored Ja/Nein pair", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-war-materiel")!;
  const anchored =
    "# SRG Trendumfrage\n\n" +
    "## Kriegsmaterialgesetz\n" +
    "Ein enges Rennen mit leichtem Ja-Vorteil: 38,5 % würden zustimmen, 48,2 Prozent ablehnen.\n\n" +
    "Teilnahmeabsicht 52 %.";
  const api = apiReturning({ "gfsbern.ch": anchored });
  const r = await refreshSeed(seed, api, CTX);
  const figs = r.spec.figures.join(" | ");
  assert.match(figs, /38\.5/);
  assert.match(figs, /48\.2/);
});

/* ---------------- NIT 5: tightened `derzeit` turnout regex ---------------- */

test("NIT 5: 'derzeit' turnout regex requires adjacent %/Prozent + turnout wording", () => {
  // Match: unit adjacent, turnout wording in window.
  assert.equal(parseDerzeitTurnoutPct("Die Stimmbeteiligung beträgt derzeit 12,5 %."), "12,5");
  assert.equal(parseDerzeitTurnoutPct("derzeit 30 Prozent briefliche Stimmabgabe"), "30");
  // No match: a number+percent with NO turnout wording anywhere near.
  assert.equal(parseDerzeitTurnoutPct("Derzeit liegen 80 % der Antworten vor."), undefined);
  // No match: "derzeit" far from any percentage-like turnout number (no adjacent unit).
  assert.equal(parseDerzeitTurnoutPct("Die Stimmbeteiligung liegt derzeit etwa drei Prozentpunkte über dem Stand der Vorlage vom letzten Jahr"), undefined);
  // French path: unit adjacent + participation wording.
  assert.equal(parseFrenchTurnoutPct("La participation est actuellement de 30,3 %"), "30,3");
  assert.equal(parseFrenchTurnoutPct("La participation est actuellement de 30,3 points"), undefined);
  // Trailing wording path.
  assert.equal(parseTrailingTurnoutPct("Bislang 39,27 % briefliche Stimmabgaben eingegangen"), "39,27");
  assert.equal(parseTrailingTurnoutPct("39,27 % der Bevölkerung wohnhaft"), undefined);
});

/* ---------------- NIT 4: fetch-time canton cascade ---------------- */

test("NIT 4: turnout cascade tries Geneva first, then Basel-Stadt, then Bern — first canton that parses wins", async () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!;
  const fetched: string[] = [];
  const geBody = "La participation aux votations est actuellement de 30,3 % des suffrages.";
  const bsBody = "Die Stimmbeteiligung beträgt derzeit 39,27 % (briefliche Stimmabgaben).";
  const beBody = "Die Stimmbeteiligung beträgt derzeit 41,1 % (briefliche Stimmabgaben).";
  const gfsBody = "Die Teilnahmeabsicht liegt unverändert bei 52 %. Der langjährigen Durchschnitt von 46,5 % wird übertroffen.";
  const api: SourceApi = {
    mock: false,
    fetch: async (url) => {
      fetched.push(url);
      const body =
        url.includes("gfsbern") ? gfsBody
        : url.includes("ge.ch") ? (fetched.filter((u) => u.includes("ge.ch")).length === 1 ? new Error("HTTP 503") as unknown as string : geBody)
        : url.includes("bs.ch") ? bsBody
        : url.includes("bern.ch") ? beBody
        : new Error(`unexpected ${url}`) as unknown as string;
      if (typeof body !== "string") throw body;
      return { url, body, fetchedAt: CTX.now.toISOString(), status: 200, mock: false };
    },
  };
  const r = await refreshSeed(seed, api, CTX);
  const figs = r.spec.figures.join(" | ");
  // Geneva fetch failed once → moved on; the FIRST canton that parses is Basel-Stadt 39,27 % (rendered 39.3%).
  assert.ok(fetched.some((u) => u.includes("ge.ch")), "Geneva tried first");
  assert.ok(fetched.filter((u) => u.includes("ge.ch")).length === 1, "Geneva is not retried after its failure");
  assert.ok(fetched.some((u) => u.includes("bs.ch")), "Basel-Stadt is next in the cascade");
  assert.match(figs, /Basel-Stadt[^|]*39\.3%/, JSON.stringify(figs));
  assert.ok(!figs.includes("41.1"), "cascade must stop at the first parsing canton (Bern never wins)");
});

/* ---------------- NIT 8: parsePgnResults game-boundary splitting ---------------- */

test("NIT 8: a game without a Result tag is skipped, not bound to the next game's Result", () => {
  const pgn = [
    '[Event "WCC"]',
    '[White "Javokhir Sindarov"]',
    '[Black "D Gukesh"]',
    "", // NO [Result] tag in game 1 — the old lazy regex would bind game 2's result here
    "1. e4 e5 2. Nf3 *",
    "",
    '[Event "WCC"]',
    '[White "D Gukesh"]',
    '[Black "Javokhir Sindarov"]',
    '[Result "0-1"]',
    "",
    "1. d4 Nf6 *",
  ].join("\n");
  const games = parsePgnResults(pgn, "Sindarov");
  assert.equal(games.length, 1, `only the tagged game parses, got ${games.length}`);
  assert.equal(games[0]!.white, "D Gukesh");
  assert.equal(games[0]!.result, "0-1");
  assert.equal(games[0]!.scoreA, 1, "Sindarov is Black and won");
});

/* ---------------- NIT 6: strengthen the ch-turnout picker test ---------------- */

test("NIT 6: the turnout picker's shipped source is a live cantonal chancery page, Zürich only as last resort", () => {
  const seed = RESEARCH_SEEDS.find((s) => s.topic === "ch-vote-turnout")!;
  const order = ["earlyReturnsGE", "earlyReturnsBS", "earlyReturnsBE", "earlyReturnsVD", "earlyReturnsZH", "earlyReturns"] as const;
  for (const key of order) {
    const link = seed.sources[key];
    assert.ok(link, `seed source ${key} must exist (cascade order NIT 4)`);
  }
  // The non-Zürich cantons must NOT be the legacy stadt-zuerich URL.
  for (const key of ["earlyReturnsGE", "earlyReturnsBS", "earlyReturnsBE", "earlyReturnsVD"] as const) {
    assert.ok(!seed.sources[key]!.url.includes("stadt-zuerich.ch"), `${key} must be a non-Zürich chancery page`);
  }
  assert.ok(seed.sources.earlyReturnsGE!.url.includes("ge.ch"), "Geneva leads the cascade");
});

/* ---------------- Gate CLI (owner order): read-only mock-mode outputs ---------------- */

test("gate CLI: evidence --limits (mock) reports submits-left and daily-cap fields", async () => {
  const cfg = resolveConfig({ mode: "mock" });
  const api = await createDelphiApi(cfg);
  const lines = limitsReport(await api.getLimits());
  const text = lines.join("\n");
  assert.match(text, /submits left this hour/);
  assert.match(text, /daily cap left/);
  assert.match(text, /hour ends /);
  assert.match(text, /resets /);
});

test("gate CLI: evidence --list (mock) lists draft manifests with verdicts and flags the 5 duplicates", async () => {
  const cfg = resolveConfig({ mode: "mock" });
  const api = await createDelphiApi(cfg);
  const { submissions, drafts } = await listEvidence(api);
  assert.ok(Array.isArray(submissions), "submissions list resolves in mock mode");
  assert.equal(drafts.length, 10, "all 10 draft manifests are visible");
  const topics = new Set(drafts.map((d) => d.topic));
  for (const dup of ["de-cpi-nov", "wikipedia-articles", "ch-cpi-nov", "ietf-mna-ioam-discuss", "es-vox-seats"]) {
    assert.ok(topics.has(dup), `26 Nov duplicate topic ${dup} is listed`);
  }
  const judged = drafts.filter((d) => d.verdict === "duplicate").map((d) => d.topic).sort();
  assert.deepEqual(judged, ["ch-cpi-nov", "de-cpi-nov", "es-vox-seats", "ietf-mna-ioam-discuss", "wikipedia-articles"]);
  const de = drafts.find((d) => d.topic === "de-cpi-nov")!;
  assert.match(de.marketAddress, /^0x[0-9a-f]{40}$/);
  assert.ok(de.submittedAt, "de-cpi-nov was submitted on 26 Nov");
  // market filter returns only that market's drafts
  const only = await listEvidence(api, de.marketAddress);
  assert.ok(only.drafts.every((d) => d.marketAddress === de.marketAddress));
  assert.ok(only.drafts.length >= 1);
});

test("gate CLI: entry-state (mock) reports canSubmit and judgementPotRemainingBaseUnits", async () => {
  const cfg = resolveConfig({ mode: "mock" });
  const api = await createDelphiApi(cfg);
  const address = RESEARCH_SEEDS[0]!.marketAddress;
  const lines = await entryStateReport(api, address);
  const text = lines.join("\n");
  assert.match(text, new RegExp(address.replace(/0x/g, "0x")));
  assert.match(text, /accepts evidence:\s+(yes|no)/);
  assert.match(text, /judgment pot remaining:\s+\d+ base units/);
  assert.match(text, /submissions left on market:/);
});

test("gate CLI: loadDraftManifests never fabricates — manifest fields flow through verbatim", () => {
  const drafts = loadDraftManifests();
  assert.ok(drafts.length >= 10);
  for (const d of drafts) {
    assert.match(d.marketAddress, /^0x[0-9a-f]{40}$/);
    assert.ok(d.topic.length > 0);
    assert.ok(d.submittedAt === null || !Number.isNaN(Date.parse(d.submittedAt)));
  }
});
