const env: Record<string, string | undefined> = {};

const passthrough = new Set([
  "DELPHI_API_ACCESS_KEY",
  "FIRECRAWL_API_KEY",
  "LIVE_SUBMIT",
  "X_AGENT_ID",
  "X_AGENT_HARNESS",
  "X_AGENT_MODEL",
  "DELPHI_BASE_URL",
  "DELPHI_MARKETS_URL",
  "DELPHI_FEEDBACK_URL",
  "FIRECRAWL_BASE_URL",
]);

for (const [k, v] of Object.entries(process.env)) {
  if (passthrough.has(k) && typeof v === "string") env[k] = v;
}

/** Never print values of credential env vars; key names only. */
export const config = {
  get DELPHI_API_ACCESS_KEY() {
    return env.DELPHI_API_ACCESS_KEY;
  },
  get FIRECRAWL_API_KEY() {
    return env.FIRECRAWL_API_KEY;
  },
  get LIVE_SUBMIT() {
    return env.LIVE_SUBMIT;
  },
  get X_AGENT_ID() {
    return env.X_AGENT_ID;
  },
  get X_AGENT_HARNESS() {
    return env.X_AGENT_HARNESS;
  },
  get X_AGENT_MODEL() {
    return env.X_AGENT_MODEL;
  },
  get DELPHI_BASE_URL() {
    return env.DELPHI_BASE_URL;
  },
  get DELPHI_MARKETS_URL() {
    return env.DELPHI_MARKETS_URL;
  },
  get DELPHI_FEEDBACK_URL() {
    return env.DELPHI_FEEDBACK_URL;
  },
  get FIRECRAWL_BASE_URL() {
    return env.FIRECRAWL_BASE_URL;
  },
};
