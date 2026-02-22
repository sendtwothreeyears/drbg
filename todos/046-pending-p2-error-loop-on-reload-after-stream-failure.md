---
status: pending
priority: p2
issue_id: "046"
tags: [reliability, frontend, streaming, ux]
dependencies: ["020"]
---

# Error loop on page reload after streaming translation failure

## Problem Statement

When a stream error occurs (e.g., translation failure), the client removes the empty assistant placeholder message. But the user's message was already persisted server-side. On page reload, the `useEffect` sees the last message is from a user (`lastMessage?.role === "user"`) and auto-triggers `streamResponse()` again — which may hit the same translation failure, creating an infinite error loop.

## Findings

- `src/client/components/Conversation/index.tsx:100-108` — onError removes assistant placeholder but user message persists
- `src/client/components/Conversation/index.tsx:198-203` — auto-stream triggers when last message is from user
- `src/server/services/runStreamOpenAI.ts:131-135` — translation failure throws after stream completes
- Loop: reload → last msg is user → stream → translation fails → error → reload → repeat

## Proposed Solutions

### Option 1: Persist assistant message before translation (addresses root cause)

**Approach:** Same as todo 020 Option 1 — persist Twi text immediately, then translate asynchronously. This eliminates the scenario where the last message remains a user message after a failed stream.

**Effort:** 2-3 hours (combined with todo 020)

**Risk:** Medium

### Option 2: Add retry counter to prevent infinite loops

**Approach:** Track stream attempts in `sessionStorage`. If the last stream attempt for this conversation failed (within 30s), do not auto-stream on mount. Show a "Retry" button instead.

**Effort:** 1-2 hours

**Risk:** Low

## Acceptance Criteria

- [ ] Page reload after stream failure does not trigger infinite loop
- [ ] User can manually retry when ready
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
