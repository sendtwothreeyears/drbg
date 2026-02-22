---
status: pending
priority: p2
issue_id: "030"
tags: [security, phi, logging, translation]
dependencies: []
---

# PHI exposure in translation error console logs

## Problem Statement

Two log statements in `runStreamOpenAI.ts` log full error objects that may contain PHI:

1. **Line 124-127** — Translation retry error:
```typescript
console.error(
  `[runStreamOpenAI] Translation attempt ${attempt} failed:`,
  err,
);
```

2. **Line 250** — Outer catch block:
```typescript
console.error("[runStreamOpenAI] Stream error:", error);
```

When `translateText` fails, the OpenAI SDK's `APIError` object may include the full request context — which contains `fullText`, the assistant's clinical response in Twi with patient symptom discussion. The outer catch block logs the full error for any failure in the pipeline, which could include conversation content from streaming or database operations.

## Findings

- `src/server/services/runStreamOpenAI.ts:124-127` — logs full `err` object on translation failure
- `src/server/services/runStreamOpenAI.ts:250` — logs full `error` object on any pipeline failure
- OpenAI SDK `APIError` may serialize request payloads containing patient text
- Project rule: "Log error codes only, never request bodies or patient text"

## Proposed Solutions

### Option 1: Log structured metadata only (Recommended)

**Approach:** Replace full error object logging with structured error metadata:

```typescript
// Translation error (lines 124-127):
console.error(
  `[runStreamOpenAI] Translation attempt ${attempt} failed: ` +
  `conversationId=${conversationId} ` +
  `errorType=${(err as Error)?.constructor?.name} ` +
  `errorMessage=${(err as Error)?.message}`
);

// Outer catch (line 250):
console.error(
  `[runStreamOpenAI] Stream error: ` +
  `conversationId=${conversationId} ` +
  `errorType=${(error as Error)?.constructor?.name} ` +
  `errorMessage=${(error as Error)?.message}`
);
```

**Pros:**
- Preserves error diagnostics (type, message) without PHI
- Consistent with project logging conventions

**Cons:**
- Loses full stack trace for debugging

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

Option 1. Log structured error metadata without full error objects.

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:124-127` — translation retry error log
- `src/server/services/runStreamOpenAI.ts:250` — outer catch error log

**Related components:**
- Translation service (`src/server/services/translate.ts`)
- OpenAI SDK error classes

## Resources

- **Related todo:** `todos/011-pending-p3-phi-in-console-error-logs.md`

## Acceptance Criteria

- [ ] No full error objects logged that could contain patient text
- [ ] Error type and message still logged for diagnostics
- [ ] `conversationId` included in all error logs for tracing

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)

**Actions:**
- Identified via security review of commit 98ac954
- Cross-referenced with Todo #011 (PHI in console error logs)

**Learnings:**
- Never log full error objects in clinical code paths; OpenAI SDK errors can serialize request payloads
