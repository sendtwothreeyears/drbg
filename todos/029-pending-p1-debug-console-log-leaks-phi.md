---
status: pending
priority: p1
issue_id: "029"
tags: [security, phi, logging, hipaa]
dependencies: []
---

# Debug `console.log("findings", findings)` leaks PHI to server logs

## Problem Statement

Line 224 of `src/server/services/runStreamOpenAI.ts` contains a leftover debug statement:

```typescript
console.log("findings", findings);
```

The `findings` variable contains the full result of `getFindingsByConversationQuery(conversationId)` — rows from the clinical findings table with shape `{ category: string, value: string }`. These contain Protected Health Information (PHI) such as:
- `{ category: "symptom", value: "severe abdominal pain for 3 days" }`
- `{ category: "history", value: "diabetes diagnosed 2019" }`

This data is logged to stdout on **every conversation** that reaches the differential diagnosis phase. In deployed environments, stdout is captured by log aggregation systems (CloudWatch, Datadog, etc.) that are not governed by the same access controls as the database.

This violates HIPAA's minimum necessary standard and the project's own rule: "Log error codes only, never request bodies or patient text" (from `docs/solutions/integration-issues/openai-streaming-conversation-engine-migration.md`).

## Findings

- `src/server/services/runStreamOpenAI.ts:224` — bare `console.log("findings", findings)`
- No `[runStreamOpenAI]` prefix (inconsistent with all other log statements in the file)
- Uses `console.log` (not `console.error` or `console.warn` like structured logs)
- Clearly a debug statement that was not removed before commit

## Proposed Solutions

### Option 1: Remove the line entirely (Recommended)

**Approach:** Delete the debug log. One-line fix.

```diff
- console.log("findings", findings);
```

**Pros:**
- Immediate, zero-risk fix
- No PHI in logs

**Cons:**
- None

**Effort:** 1 minute

**Risk:** None

---

### Option 2: Replace with structured, safe log

**Approach:** If findings logging is needed operationally, log only the count:

```typescript
console.log(`[runStreamOpenAI] findings count=${findings.length} conversationId=${conversationId}`);
```

**Pros:**
- Preserves observability without PHI

**Cons:**
- Slightly more work than just deleting

**Effort:** 5 minutes

**Risk:** None

## Recommended Action

Option 1. Remove the line immediately.

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:224`

**Related components:**
- Differential diagnosis pipeline
- Log aggregation infrastructure

## Resources

- **Related todo:** `todos/011-pending-p3-phi-in-console-error-logs.md`

## Acceptance Criteria

- [ ] `console.log("findings", findings)` removed from codebase
- [ ] No PHI logged during differential diagnosis flow
- [ ] Code reviewed and approved

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)

**Actions:**
- Identified by all review agents (security, architecture, quality, simplicity) — unanimous P1
- Cross-referenced with existing Todo #011 (PHI in console error logs)

**Learnings:**
- Debug statements in clinical code paths are a PHI risk; consider a lint rule for bare `console.log`
