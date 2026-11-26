import { config as env } from "./env.js";

export interface AgentConfig {
  mode: "mock" | "live";
  /** When true, drafts may be POSTed to the live API. Requires mode=live AND env LIVE_SUBMIT=1 AND --live-submit. */
  liveSubmit: boolean;
  delphiApiKey: string | undefined;
  firecrawlApiKey: string | undefined;
  agentId: string;
  agentHarness: string;
  agentModel: string;
  baseUrl: string;
  marketsUrl: string;
  feedbackUrl: string;
  firecrawlUrl: string;
}

export function resolveConfig(opts: { mode?: "mock" | "live"; liveSubmit?: boolean }): AgentConfig {
  const delphiApiKey = env.DELPHI_API_ACCESS_KEY || undefined;
  const firecrawlApiKey = env.FIRECRAWL_API_KEY || undefined;
  let mode = opts.mode;
  if (!mode) mode = delphiApiKey ? "live" : "mock";
  if (mode === "live" && !delphiApiKey) {
    throw new Error(
      "mode=live requires DELPHI_API_ACCESS_KEY to be set. Set the key or run with --mode=mock.",
    );
  }
  // Triple guard: the flag alone, the env alone, or one without the other, never submits.
  const liveSubmit =
    mode === "live" && opts.liveSubmit === true && env.LIVE_SUBMIT === "1" && !!delphiApiKey;
  return {
    mode,
    liveSubmit,
    delphiApiKey,
    firecrawlApiKey,
    agentId: env.X_AGENT_ID || "siera-labs-evidence-miner",
    agentHarness: env.X_AGENT_HARNESS || "mistral-vibe",
    agentModel: env.X_AGENT_MODEL || "unknown",
    baseUrl: env.DELPHI_BASE_URL || "https://delphi.fyi/v1",
    marketsUrl: env.DELPHI_MARKETS_URL || "https://competition.delphi.fyi/markets.json",
    feedbackUrl: env.DELPHI_FEEDBACK_URL || "https://feedback.delphi.fyi/v1/feedback",
    firecrawlUrl: env.FIRECRAWL_BASE_URL || "https://api.firecrawl.dev/v1",
  };
}
