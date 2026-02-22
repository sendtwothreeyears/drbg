---
status: completed
priority: p2
issue_id: "042"
tags: [reliability, backend, streaming, error-handling]
dependencies: []
---

# JSON.parse of tool call arguments without try/catch

## Problem Statement

In `runStreamOpenAI.ts`, accumulated tool call arguments are parsed with `JSON.parse(fc.arguments)` at line 162 without a try/catch. If the OpenAI model returns malformed JSON (which happens with streaming truncation or model errors), this throws a `SyntaxError`. By this point, the text stream has already been sent to the client — but the throw prevents message persistence. The patient sees the response disappear.

Distinct from todo 020 (translation failure) — this is a JSON parse failure before any translation occurs.

## Findings

- `src/server/services/runStreamOpenAI.ts:162` — unguarded `JSON.parse(fc.arguments)`
- Error caught at line 250 outer catch, calling `onError` — but text already streamed
- Message never persisted, clinical data lost

## Proposed Solutions

### Option 1: Wrap JSON.parse in try/catch, skip malformed tool calls

**Approach:** Catch parse errors for individual tool calls, log and skip them, still persist the text portion.

```typescript
let input;
try {
  input = JSON.parse(fc.arguments);
} catch {
  console.error(`[runStreamOpenAI] Failed to parse tool arguments for ${fc.name}`);
  continue;
}
```

**Effort:** 15 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] Malformed tool call JSON does not crash the stream pipeline
- [ ] Text portion is still persisted even if tool call fails
- [ ] Error is logged for debugging
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
