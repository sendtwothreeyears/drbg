---
status: pending
priority: p2
issue_id: "010"
tags: [reliability, backend, performance]
dependencies: []
---

# No timeout on OpenAI translation API call

## Problem Statement

The OpenAI `chat.completions.create()` call has no timeout. If OpenAI is slow or down, the request hangs indefinitely, blocking the Express handler and degrading UX.

## Findings

- `src/server/services/translate.ts:27-35` — no timeout configured on client or request

## Proposed Solutions

### Option 1: Add timeout to OpenAI client

**Approach:**
```typescript
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 10_000, // 10 seconds
});
```

**Effort:** 2 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/services/translate.ts:3-5`

## Acceptance Criteria

- [ ] Translation requests time out after 10 seconds
- [ ] Timeout produces a clear error caught by the controller
