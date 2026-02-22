---
status: pending
priority: p3
issue_id: "033"
tags: [resilience, translation, retry]
dependencies: []
---

# No backoff between translation retry attempts

## Problem Statement

The retry loop in `src/server/services/runStreamOpenAI.ts:117-129` fires the second translation attempt immediately after the first fails. If the failure is due to OpenAI rate limiting (429) or a transient network error, an immediate retry is likely to hit the same condition.

## Findings

- `src/server/services/runStreamOpenAI.ts:117-129` — retry loop with no delay
- Translation uses `gpt-4o-mini` via `translate.ts`
- If OpenAI returns 429, immediate retry will also be rate-limited

## Proposed Solutions

### Option 1: Add 500ms delay between retries

**Approach:** Add a short delay before the second attempt:

```typescript
if (attempt < 2) await new Promise((r) => setTimeout(r, 500));
```

**Effort:** 5 minutes

**Risk:** None

## Acceptance Criteria

- [ ] Second translation attempt has a delay before firing

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)
