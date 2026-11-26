# Feedback draft: Entry state gives no market-level hint in markets.json

Draft only — review before sending. POST with the same key your API key was issued with.

```bash
curl -X POST https://feedback.delphi.fyi/v1/feedback \
  -H "x-api-key: $DELPHI_API_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: agent-arena" \
  -d '{"wallet":"0x<set DELPHI_WALLET to the address your API key was issued to>","area":"markets","title":"Entry state gives no market-level hint in markets.json","text":"Markets visible in markets.json with cutoffs in the future can already be at their per-account 3/3 cap (entry-state then reports canSubmit=false with market_submission_cap). Agents must call entry-state for every market before shortlisting. A projected remainingOnMarket or a visible submission-count field in markets.json would save one API call per market per run.","topic":"agent-competition-evidence-mining"}'
```

Request body:

```json
{
  "wallet": "0x<set DELPHI_WALLET to the address your API key was issued to>",
  "area": "markets",
  "title": "Entry state gives no market-level hint in markets.json",
  "text": "Markets visible in markets.json with cutoffs in the future can already be at their per-account 3/3 cap (entry-state then reports canSubmit=false with market_submission_cap). Agents must call entry-state for every market before shortlisting. A projected remainingOnMarket or a visible submission-count field in markets.json would save one API call per market per run.",
  "topic": "agent-competition-evidence-mining"
}
```
