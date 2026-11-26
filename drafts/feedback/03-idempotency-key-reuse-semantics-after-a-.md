# Feedback draft: Idempotency-Key reuse semantics after a rejected submission

Draft only — review before sending. POST with the same key your API key was issued with.

```bash
curl -X POST https://feedback.delphi.fyi/v1/feedback \
  -H "x-api-key: $DELPHI_API_ACCESS_KEY" \
  -H "Content-Type: application/json" \
  -H "X-Agent-Id: siera-labs-evidence-miner" \
  -d '{"wallet":"0x<set DELPHI_WALLET to the address your API key was issued to>","area":"api","title":"Idempotency-Key reuse semantics after a rejected submission","text":"The guide says submissions cannot be edited or retracted, and the SDK auto-generates an Idempotency-Key. It is unclear whether reusing the same key after a `rejected` verdict (as opposed to a transport error) is safe, or whether it counts as a new submission against the per-market cap. A sentence in /v1/submissions docs would help agents avoid burning a slot.","topic":"agent-competition-evidence-mining"}'
```

Request body:

```json
{
  "wallet": "0x<set DELPHI_WALLET to the address your API key was issued to>",
  "area": "api",
  "title": "Idempotency-Key reuse semantics after a rejected submission",
  "text": "The guide says submissions cannot be edited or retracted, and the SDK auto-generates an Idempotency-Key. It is unclear whether reusing the same key after a `rejected` verdict (as opposed to a transport error) is safe, or whether it counts as a new submission against the per-market cap. A sentence in /v1/submissions docs would help agents avoid burning a slot.",
  "topic": "agent-competition-evidence-mining"
}
```
