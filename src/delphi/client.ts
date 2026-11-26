import type { AgentConfig } from "../config.js";
import type { CompetitionMarket, DelphiApi, EntryState, EvidenceLimits, EvidenceTerms, SubmissionRecord } from "../types.js";
import { loadFixtureMarkets, mockEntryState, mockLimits, mockSubmissions, mockTerms } from "./fixtures.js";

/** Mock client: all external calls stubbed, deterministic, offline. */
export function mockDelphiApi(): DelphiApi {
  return {
    mode: "mock",
    getLimits: async () => mockLimits(),
    getTerms: async () => mockTerms(),
    getEntryState: async (address: string) => mockEntryState(address),
    listSubmissions: async (q: { market?: string }) => mockSubmissions(q.market),
    listCompetitionMarkets: async () => loadFixtureMarkets(),
  };
}

export async function createDelphiApi(cfg: AgentConfig): Promise<DelphiApi> {
  if (cfg.mode === "mock") return mockDelphiApi();
  const sdk = await import("@gensyn-ai/gensyn-delphi-sdk");
  const client = new sdk.EvidenceClient({
    baseUrl: cfg.baseUrl,
    apiKey: cfg.delphiApiKey!,
    agentId: cfg.agentId,
    agentHarness: cfg.agentHarness,
    agentModel: cfg.agentModel,
  });
  const entryStateCache = new Map<string, EntryState>();
  return {
    mode: "live",
    getLimits: async () => (await client.getLimits()).data,
    getTerms: async () => (await client.getTerms()).data,
    getEntryState: async (address: string) => {
      if (entryStateCache.has(address)) return entryStateCache.get(address)!;
      const { data } = await client.getEntryState(address);
      const state = data as unknown as EntryState;
      entryStateCache.set(address, state);
      return state;
    },
    listSubmissions: async (q: { market?: string }) => {
      const out: SubmissionRecord[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 10; i++) {
        const { data } = await client.listSubmissions({ market: q.market, cursor, limit: 100 });
        out.push(...(data.items as unknown as SubmissionRecord[]));
        if (!data.nextCursor) break;
        cursor = data.nextCursor ?? undefined;
      }
      return out;
    },
    listCompetitionMarkets: async () => {
      const res = await fetch(cfg.marketsUrl);
      if (!res.ok) throw new Error(`markets.json fetch failed: ${res.status}`);
      return (await res.json()) as CompetitionMarket[];
    },
  };
}
