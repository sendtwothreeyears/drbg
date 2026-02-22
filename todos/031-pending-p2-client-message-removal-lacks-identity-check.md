---
status: pending
priority: p2
issue_id: "031"
tags: [frontend, state-management, error-handling]
dependencies: []
---

# Client error handler removes assistant message by position, not identity

## Problem Statement

The error handler in `src/client/components/Conversation/index.tsx:94-100` removes the last message if it has role `"assistant"`:

```typescript
setMessages((prev) => {
  const last = prev[prev.length - 1];
  if (last?.role === "assistant") {
    return prev.slice(0, -1);
  }
  return prev;
});
```

This relies on positional logic — it assumes the last message is always the one added by `streamResponse()` (which prepends an empty assistant message at line 47). While this is safe today due to the `streaming` flag preventing concurrent sends, the coupling is implicit.

Additionally, the previous code had a `!last.content` guard that only removed empty placeholder messages. The new code removes messages even with streamed content. In the new architecture (translate-first-persist-second), this is intentionally correct — the message was never persisted, so it should be removed. But this intent is not documented.

## Findings

- `src/client/components/Conversation/index.tsx:47` — `streamResponse()` prepends empty assistant message
- `src/client/components/Conversation/index.tsx:94-100` — error handler removes last assistant message unconditionally
- `src/client/components/Conversation/index.tsx:121` — `handleSend` has `streaming` guard
- `src/client/components/Conversation/index.tsx:106-118` — `handleDemographicsSubmit` calls `streamResponse()` without checking `streaming` flag
- Positional removal could target wrong message if future changes introduce concurrent streams

## Proposed Solutions

### Option 1: Add documentation comment (Minimum)

**Approach:** Document the invariant with a code comment explaining why unconditional removal is safe.

```typescript
// Safe to remove unconditionally: streamResponse() always appends an assistant
// message before starting, the streaming flag prevents concurrent calls, and
// on error the message was never persisted to DB (translate-first-persist-second).
if (last?.role === "assistant") {
  return prev.slice(0, -1);
}
```

**Effort:** 5 minutes

**Risk:** None

---

### Option 2: Tag optimistic messages with pending flag

**Approach:** Mark the optimistic assistant message with a `pending: true` flag and target it specifically in the error handler.

```typescript
// In streamResponse:
setMessages((prev) => [...prev, { role: "assistant", content: "", pending: true }]);

// In error handler:
setMessages((prev) => {
  const last = prev[prev.length - 1];
  if (last?.role === "assistant" && last.pending) {
    return prev.slice(0, -1);
  }
  return prev;
});
```

**Effort:** 30 minutes

**Risk:** Low

## Recommended Action

Option 1 for now. Option 2 if concurrent streams or reconnection logic is added later.

## Technical Details

**Affected files:**
- `src/client/components/Conversation/index.tsx:47` — optimistic message creation
- `src/client/components/Conversation/index.tsx:94-100` — error handler removal

## Acceptance Criteria

- [ ] Intent of unconditional message removal is documented
- [ ] No regressions in error handling behavior

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)

**Actions:**
- Identified via architecture and quality reviews of commit 98ac954
- Confirmed current behavior is intentional per plan docs
