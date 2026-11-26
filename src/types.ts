/** Shared types for the Agent Arena evidence-mining agent. */

/** Competition market as served by https://competition.delphi.fyi/markets.json */
export interface CompetitionMarket {
  address: string;
  question: string;
  delphiUrl: string;
  category: string;
  marketTier: string;
  wave: number;
  status: string;
  odds: { yes: number; no: number };
  closesAt: string;
  evidenceCutoffAt: string;
  pots: { judgement: string; settlement: string };
  resolutionCriteria: string;
  /** Wave 2+ markets may carry official source URLs (Path A mining). */
  dataSources?: { url: string; label?: string }[];
}

/** Mirrors the SDK EntryState (kept local so mock mode needs no API). */
export interface EntryState {
  canSubmit: boolean;
  reason?: string;
  remainingOnMarket: number;
  /** USDC.e base units (6 decimals) left in the judgment pot. Information only. */
  judgementPotRemainingBaseUnits: string;
  restricted?: boolean;
  rateLimit: { resetAt: string };
}

/** Mirrors the SDK EvidenceLimits. */
export interface EvidenceLimits {
  submitsLeftThisHour: number;
  hourEndsAt: string;
  dailyCapLeft: number;
  dailyCapResetAt: string;
}

export interface EvidenceTerms {
  version: string;
  url: string;
  acceptedAt: string | null;
}

export interface SubmissionRecord {
  id: string;
  createdAt: string;
  agentId: string | null;
  note: string | null;
  links: string[];
  status: string;
  markets: { marketAddress: string; bounty: { amount: string; state: string } | null }[];
}

/** Read-only client surface used by the pipeline. Same shape in mock and live mode.
 *  acceptTerms is the single write action, exposed only for the explicit CLI step. */
export interface DelphiApi {
  readonly mode: "mock" | "live";
  getLimits(): Promise<EvidenceLimits>;
  getTerms(): Promise<EvidenceTerms>;
  getEntryState(marketAddress: string): Promise<EntryState>;
  listSubmissions(query: { market?: string }): Promise<SubmissionRecord[]>;
  listCompetitionMarkets(): Promise<CompetitionMarket[]>;
  acceptTerms(version: string): Promise<{ version: string; acceptedAt: string }>;
}

/** Mining path per the build brief: 1 arithmetic, 2 machine-readable trackers, 3 non-English scraping. */
export type MiningPath = 1 | 2 | 3;

export type AnalysisKind =
  | "cpi_base_effect"
  | "cpi_required_mom"
  | "turnout_projection"
  | "turnout_threshold"
  | "poll_margin_regression"
  | "dhondt_seats"
  | "seat_threshold"
  | "ballot_flag_snapshot"
  | "markov_lead"
  | "match_lead_elo"
  | "threshold_velocity"
  | "release_gap_cdf"
  | "blocker_clearance";

export type AnalysisSpec = { kind: AnalysisKind; params: Record<string, unknown> };

export type LinkAccess = "static-html" | "api-json" | "scraped";

export interface SourceLink {
  url: string;
  label: string;
  lang: string;
  access: LinkAccess;
  /** Substrings that the fetched source content must contain for the candidate to
   *  count as verifiable (anti-`unverifiable` gate). */
  expect?: string[];
}

/** Per-market research input. The mock runs read these as fixture data; live runs
 *  re-derive `analysis.params` and `figures` from the same sources before use. */
export interface ResearchSpec {
  marketAddress: string;
  topic: string;
  miningPath: MiningPath;
  langs: string[];
  /** Dated fact headline, figures inline. Must be novel (not a priced-in headline). */
  headline: string;
  /** Key figures pasted into the note so the judge never needs JS/rendered pages. */
  figures: string[];
  /** One line per link: what the page shows at fetch time. */
  sourceDescriptions: string[];
  links: SourceLink[];
  analysis: AnalysisSpec;
}

/** Result of the Python math/CSV generator for one spec. */
export interface AnalysisResult {
  kind: AnalysisKind;
  evidenceImpliedYes: number;
  confidence: "low" | "medium" | "high";
  methodLines: string[];
  figureSummary: string;
}

/** A fully assembled submission candidate, pre-gate. */
export interface EvidenceCandidate {
  marketAddress: string;
  marketQuestion: string;
  marketImpliedYes: number;
  topic: string;
  miningPath: MiningPath;
  langs: string[];
  headline: string;
  figures: string[];
  sourceDescriptions: string[];
  links: SourceLink[];
  analysis: AnalysisResult;
  stance: "yes" | "no";
  factSignature: string;
  asOf: string;
}

export interface GateVerdict {
  pass: boolean;
  reasons: string[];
  warnings: string[];
}

export interface EvidenceLogEntry {
  ts: string;
  marketAddress: string;
  topic: string;
  stance: "yes" | "no";
  factSignature: string;
  status: "drafted" | "rejected" | "submitted";
  /** Mode tag: mock entries never block live runs and vice versa (fix 11). */
  mode?: "mock" | "live";
  draftPath: string | null;
  submissionId: string | null;
  note: string;
}

export interface SubmitOutcomeFields {
  verdict?: string;
  reason?: string;
  bounty?: string;
  zeroPayReason?: string | null;
  settlementUpTo?: string | null;
}

export interface DraftManifest {
  topic: string;
  marketAddress: string;
  marketQuestion: string;
  generatedAt: string;
  mode: "mock" | "live";
  asOf: string;
  stance: "yes" | "no";
  links: string[];
  files: string[];
  factSignature: string;
  /** Reserved for a live submit; logged BEFORE the POST and reused verbatim on retry. */
  idempotencyKey: string;
  submittedAt: string | null;
  submissionId: string | null;
  /** Surfaces from the live submission verdict (written back by submitDraft). */
  outcome?: SubmitOutcomeFields;
}

export interface RunReport {
  runTs: string;
  mode: "mock" | "live";
  marketsSeen: number;
  marketsEligible: number;
  marketsConsidered: CompetitionMarket[];
  marketSkips: { address: string; question: string; reason: string }[];
  candidatesMined: number;
  draftsWritten: string[];
  duplicatesSkipped: string[];
  gateRejects: { topic: string; reasons: string[] }[];
  /** Live/refresh mining failures (source down, parse failed, stale): the market is skipped, never guessed. */
  miningFailures: { topic: string; reason: string }[];
  draftsSkippedNoSpec: { address: string; question: string; cutoff: string }[];
  feedbackDrafts: string[];
}
