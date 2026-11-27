import { LiveMiningError } from "./refreshers-part1.js";

/**
 * Firecrawl-markdown parsing helpers (Delphi fix 2).
 *
 * The ch-vote-turnout and ch-war-materiel miners parse scraped markdown and
 * died on the live pages: the scraped bodies carry markdown artifacts
 * (emphasis runs, link brackets, zero-width chars, `&nbsp;`, table pipes)
 * and Swiss/European decimal commas that the old `(\d+,\d)` captures either
 * truncated ("1,5" -> 1,5 was fine but "1.234,5" thousands broke) or missed
 * through extra whitespace inside the phrase. Every helper here normalises
 * first, then matches a flexible pattern.
 */

/**
 * Clean Firecrawl markdown noise so regexes see plain text:
 * - strip markdown link syntax `[text](url)` -> text (and bare `[text]`)
 * - strip emphasis/bold markers and inline-code backticks
 * - drop table pipe rows, image/embed syntax and HTML comments
 * - strip zero-width + BOM characters
 * - decode the HTML entities htmlToText leaves behind and nbsp variants
 * - collapse whitespace (incl. `\u00a0`) to single spaces
 */
export function cleanMarkdown(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/<!\[CDATA\[|\]\]>/g, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/\[([^\]]+)\]/g, "$1")
    .replace(/<https?:\/\/[^>]+>/g, " ")
    .replace(/\|\s*\n/g, "\n")
    .replace(/^\s*\|.*\|\s*$/gm, " ")
    .replace(/\|/g, " ")
    .replace(/[*_]{1,3}([^*_\n]{1,400}?)[*_]{1,3}/g, "$1")
    .replace(/`{1,3}([^`]{1,400}?)`{1,3}/g, "$1")
    .replace(/~~/g, "")
    .replace(/[\u200b\u200c\u200d\u200e\u200f\uFEFF]/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[\u00a0\u202f\u2007\u2009]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

/**
 * Parse a European- or English-formatted number: decimal comma or dot,
 * optional dot/apostrophe/narrow-space thousands separators, optional
 * percent/minus/typographic-minus context. "1,5" -> 1.5, "12.345" -> 12345,
 * "1'234,5" -> 1234.5, "−2,75" -> -2.75.
 */
export function parseEuropeanNumber(token: string): number | undefined {
  let t = token.trim().replace(/[\u2212\u2013\u2014]/g, "-");
  if (!t) return undefined;
  let neg = false;
  if (t.startsWith("-") || (t.startsWith("(") && t.endsWith(")"))) neg = true;
  t = t.replace(/^[-+(]+|[-+)]+$/g, "");
  if (!/\d/.test(t)) return undefined;
  // Apostrophes, spaces and narrow spaces are always thousands separators.
  t = t.replace(/['\u2019\u00a0\u202f\u2009 ]/g, "");
  const dotSep = t.includes(".");
  const commaSep = t.includes(",");
  let out: string;
  if (dotSep && commaSep) {
    // The rightmost separator is the decimal one.
    const lastDot = t.lastIndexOf(".");
    const lastComma = t.lastIndexOf(",");
    if (lastDot > lastComma) out = t.replace(/,/g, "");
    else out = t.replace(/\./g, "").replace(",", ".");
  } else if (commaSep) {
    out = /,\d{1,2}$/.test(t) ? t.replace(",", ".") : t.replace(/,/g, "");
  } else if (dotSep) {
    // "12.5" is a decimal; "12.345" with a 3-digit tail and no other dots is thousands.
    out = /^\d{1,3}(\.\d{3})+$/.test(t) && !/^\d{1,3}\.\d$/.test(t) && !/\.\d{2}$/.test(t)
      ? t.replace(/\./g, "")
      : t;
  } else {
    out = t;
  }
  const n = Number(out);
  return Number.isFinite(n) ? (neg ? -n : n) : undefined;
}

/**
 * Match `labelRe` (which must capture the number token in group 1) anywhere in
 * the cleaned body and return the parsed number. Tolerates the number being
 * separated from the label by markdown junk, nbsp or a wide gap.
 */
export function extractNumber(body: string, labelRe: RegExp, label: string): number {
  const cleaned = cleanMarkdown(body);
  const m = cleaned.match(labelRe);
  if (!m) throw new LiveMiningError(`did not parse ${label}`);
  const n = parseEuropeanNumber(m[1] ?? "");
  if (n === undefined) throw new LiveMiningError(`cannot parse live figure ${label} from "${m[0]}"`);
  return n;
}

/** Raw (unparsed) capture of the number token, for `expect` fields on links. */
export function extractToken(body: string, labelRe: RegExp, label: string): string {
  const cleaned = cleanMarkdown(body);
  const m = cleaned.match(labelRe);
  if (!m) throw new LiveMiningError(`did not parse ${label}`);
  return (m[1] ?? "").trim();
}

/* ------------------------- FIDE / Lichess PGN (fix 3) ------------------------- */

export interface PgnGameResult {
  white: string;
  black: string;
  /** "1-0", "0-1" or "1/2-1/2". */
  result: string;
  /** Result scored by Sindarov (the market's player A): 1, 0 or 0.5. */
  scoreA: number;
  scoreB: number;
}

/**
 * Map a PGN `Result` tag value to the points scored by White and Black.
 * General parser: each side of the dash is "1", "0", "1/2" or "½"; any other
 * token (e.g. "*", "?") yields undefined so callers can skip the game.
 */
export function pgnResultToScores(result: string): [number, number] | undefined {
  const sides = result.trim().split(/[-–—]/);
  if (sides.length !== 2) return undefined;
  const side = (s: string): number | undefined => {
    const t = s.trim();
    if (t === "1/2" || t === "½") return 0.5;
    const n = Number(t);
    return Number.isFinite(n) ? n : undefined;
  };
  const w = side(sides[0]!);
  const b = side(sides[1]!);
  return w === undefined || b === undefined ? undefined : [w, b];
}

/**
 * Parse every game's RESULT tag out of a multi-game PGN (Lichess broadcast
 * round export or the official FIDE PGN, same format). Player A = the side
 * named first in `playerA` (Sindarov): White/Black colour is read per game.
 */
export function parsePgnResults(pgn: string, playerA: string): PgnGameResult[] {
  const games: PgnGameResult[] = [];
  const re = /\[White\s+"([^"]+)"\]\s*\n\[Black\s+"([^"]+)"\][\s\S]*?\[Result\s+"([^"]+)"\]/g;
  for (const m of pgn.matchAll(re)) {
    const white = m[1]!.trim();
    const black = m[2]!.trim();
    const scores = pgnResultToScores(m[3]!);
    if (!scores) continue;
    const [w, b] = scores;
    const aIsWhite = white.toLowerCase().includes(playerA.toLowerCase());
    games.push({ white, black, result: m[3]!.trim(), scoreA: aIsWhite ? w : b, scoreB: aIsWhite ? b : w });
  }
  return games;
}

/** Parse "Match score: 1–1" / "1-1" style running totals after result parsing. */
export function runningScore(games: PgnGameResult[]): { scoreA: number; scoreB: number; gamesPlayed: number } {
  let scoreA = 0;
  let scoreB = 0;
  for (const g of games) {
    scoreA += g.scoreA;
    scoreB += g.scoreB;
  }
  return { scoreA, scoreB, gamesPlayed: games.length };
}
