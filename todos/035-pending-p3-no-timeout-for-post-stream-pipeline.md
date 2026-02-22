---
status: pending
priority: p3
issue_id: "035"
tags: [resilience, streaming, timeout]
dependencies: []
---

# No timeout for post-stream pipeline

## Problem Statement

After the OpenAI stream completes, the SSE connection remains open while the server performs up to 9 sequential operations: translation, persistence, findings extraction, guideline search (per differential), assessment generation, and more. If any of these hang (e.g., downstream API becomes unresponsive), the SSE connection stays open indefinitely. The client has no visibility — it already stopped showing the typing indicator when `onAssessmentLoading()` fired.

## Findings

- `src/server/services/runStreamOpenAI.ts:104-248` — post-stream pipeline with no timeout
- Includes multiple external API calls (OpenAI translation, guideline search, assessment generation)
- Client cannot detect a hung post-stream operation

## Proposed Solutions

### Option 1: Add timeout wrapper around post-stream pipeline

**Approach:** Wrap the post-stream work in a `Promise.race` with a timeout. If exceeded, send error and close.

**Effort:** 1-2 hours

**Risk:** Low

### Option 2: Async assessment with client polling

**Approach:** Return `onDone` immediately after message persistence. Compute assessment asynchronously. Client polls for assessment completion.

**Effort:** 4-6 hours

**Risk:** Medium (architectural change)

## Recommended Action

Option 1 for immediate resilience. Consider Option 2 in a future architecture pass.

## Acceptance Criteria

- [ ] Post-stream pipeline has a maximum execution time
- [ ] Client receives an error if the timeout is exceeded

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)
