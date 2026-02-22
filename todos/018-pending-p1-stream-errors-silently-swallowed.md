---
status: pending
priority: p1
issue_id: "018"
tags: [error-handling, frontend, ux, clinical-safety]
dependencies: []
---

# Stream errors silently swallowed by client

## Problem Statement

When the SSE stream encounters an error (server sends `{ error: "Stream failed" }` or `EventSource.onerror` fires), the client calls `onDone()` with no error information. The user sees a partially streamed response with no indication that something went wrong. In a clinical conversation, this can lead to incomplete medical advice being taken at face value.

## Findings

- `src/client/services/stream.ts` — both the `data.error` handler and `eventSource.onerror` call `onDone()` without propagating error state
- `src/client/components/Conversation/index.tsx:79-91` — `onDone` callback simply stops streaming and focuses the text area; no error display logic exists for stream failures
- The server's `onError` handler in `conversation.ts:80-83` sends `{ error: "Stream failed" }` and closes the connection, but the client treats this as a normal completion
- Most critically: if translation fails after streaming Twi text (`runStreamOpenAI.ts:108`), the user sees a complete response that was never persisted — it vanishes on page reload

## Proposed Solutions

### Option 1: Propagate stream errors to UI

**Approach:** Add an `onError` callback to `startStream()`. When the client receives `{ error: ... }`, display an error banner in the conversation view.

```typescript
// stream.ts
if (data.error) {
  eventSource.close();
  onError?.(data.error);  // new callback
  return;
}

// Conversation/index.tsx - in streamResponse()
startStream(
  conversationId!,
  onText,
  onToolUse,
  onAssessmentLoading,
  onDone,
  (errorMsg) => {
    setStreaming(false);
    setError("The response could not be completed. Please try sending your message again.");
  },
);
```

**Pros:**
- User knows the response failed
- Can retry or seek help

**Cons:**
- Partially streamed text may remain visible

**Effort:** 30 minutes

**Risk:** Low

### Option 2: Remove partial response on error

**Approach:** In addition to Option 1, remove the last (incomplete) assistant message from state when an error occurs.

**Pros:**
- Clean state — no ghost messages

**Cons:**
- User loses whatever partial response was visible

**Effort:** 45 minutes

**Risk:** Low

## Recommended Action

Option 2 — propagate error AND clean up partial message.

## Technical Details

**Affected files:**
- `src/client/services/stream.ts` — error handling in SSE listener
- `src/client/components/Conversation/index.tsx:45-91` — `streamResponse` function

**Related components:**
- `src/server/controllers/conversation.ts:80-83` — server error emission

## Acceptance Criteria

- [ ] Stream errors display a visible error message to the user
- [ ] Partial assistant messages are removed on stream error
- [ ] User can retry after a stream error
- [ ] Normal streaming completion is unaffected

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by spec-flow-analyzer and best-practices-researcher agents
- Confirmed by cross-referencing stream.ts error paths with Conversation component
