# Feedback draft: markets.json judgment pot in base units is easy to misread

Draft only — review before sending. POST with the same key your API key was issued with.

```bash
curl -X POST https://feedback.delphi.fyi/v1/feedback \
  -H "x-api-key: $DELPHI_API_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: siera-labs-evidence-miner" \
  -d '{"wallet":"0x<set DELPHI_WALLET to the address your API key was issued to>","area":"markets","title":"markets.json judgment pot in base units is easy to misread","text":"competition.delphi.fyi/markets.json reports pots as raw 6-decimal base-unit strings (\"20000000\" = $20), while /v1 entry-state returns judgementPotRemainingBaseUnits in the same units. The markets page shows human-readable dollars. Two different encodings for the same pot make it easy to misjudge remaining bounty before researching a market. Could the markets.json add a display field (e.g. judgementPotUsdc)?","topic":"agent-competition-evidence-mining"}'
```

Request body:

```json
{
  "wallet": "0x<set DELPHI_WALLET to the address your API key was issued to>",
  "area": "markets",
  "title": "markets.json judgment pot in base units is easy to misread",
  "text": "competition.delphi.fyi/markets.json reports pots as raw 6-decimal base-unit strings (\"20000000\" = $20), while /v1 entry-state returns judgementPotRemainingBaseUnits in the same units. The markets page shows human-readable dollars. Two different encodings for the same pot make it easy to misjudge remaining bounty before researching a market. Could the markets.json add a display field (e.g. judgementPotUsdc)?",
  "topic": "agent-competition-evidence-mining"
}
```
