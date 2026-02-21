---
status: pending
priority: p2
issue_id: "022"
tags: [reliability, frontend, backend, streaming]
dependencies: []
---

# SSE reconnection causes duplicate streams

## Problem Statement

The browser's `EventSource` API automatically reconnects when the connection drops. Without SSE event IDs (`id:` field), reconnection triggers a new `GET /api/conversation/:conversationId/stream` request, which starts a new `runStreamOpenAI` execution while the first may still be completing. This causes the patient to see duplicated assistant messages.

## Findings

- `src/client/services/stream.ts` — uses `EventSource` which has built-in auto-reconnection
- `src/server/controllers/conversation.ts:66-85` — stream endpoint starts a new `runStreamOpenAI` on each request with no deduplication or stream ID tracking
- No `Last-Event-ID` header support, no SSE `id:` field in events
- The server has `req.on("close")` handling (line 47-49) but this only prevents writes to a closed connection — it does not cancel the OpenAI stream

## Proposed Solutions

### Option 1: Disable EventSource auto-reconnect

**Approach:** In the SSE response, set `retry: 86400000` (24 hours) to effectively disable auto-reconnect. Use explicit client-side retry with deduplication instead.

**Effort:** 15 minutes

**Risk:** Low

### Option 2: Use fetch + ReadableStream instead of EventSource

**Approach:** Replace `EventSource` with `fetch()` and `ReadableStream` for SSE consumption. This gives full control over reconnection behavior.

**Effort:** 1-2 hours

**Risk:** Low

### Option 3: Add server-side stream deduplication

**Approach:** Track active streams per conversation. If a new stream request arrives for a conversation with an active stream, reject it or cancel the previous one.

**Effort:** 2-3 hours

**Risk:** Medium

## Recommended Action

Option 1 for immediate fix. Option 2 for a cleaner long-term solution.

## Technical Details

**Affected files:**
- `src/client/services/stream.ts` — SSE client
- `src/server/controllers/conversation.ts:28-85` — stream endpoint

## Acceptance Criteria

- [ ] Connection drops do not cause duplicate assistant messages
- [ ] Client handles reconnection gracefully with user feedback

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by best-practices-researcher agent during SSE analysis
