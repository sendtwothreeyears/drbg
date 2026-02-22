---
status: pending
priority: p1
issue_id: "028"
tags: [security, streaming, sse, error-handling]
dependencies: []
---

# Internal error messages leaked to client via SSE

## Problem Statement

The controller at `src/server/controllers/conversation.ts:84` now forwards `err.message` directly to the client via SSE:

```typescript
(err) => {
  send({ error: err.message || "Stream failed" });
  res.end();
},
```

The outer catch block in `runStreamOpenAI.ts:249-251` catches **all** errors from the entire try block — including OpenAI SDK errors, JSON parse errors, database errors, and translation errors — and passes them through as `onError(error as Error)`.

The OpenAI SDK's `APIError` constructs messages like:
- `"401 Incorrect API key provided: sk-proj-****..."` (exposes partial API key)
- `"429 Rate limit reached for gpt-5.2..."` (exposes model name and rate limits)
- `"400 ..."` with full OpenAI error body

Only the translation failure message is user-friendly. All other error messages are internal implementation details.

## Findings

- `src/server/controllers/conversation.ts:84` — passes `err.message` to client without sanitization
- `src/server/services/runStreamOpenAI.ts:249-251` — catches all errors, casts as `Error`, passes to `onError`
- `src/server/services/translate.ts` — throws errors with internal validation details ("Unsupported language pair", "Input exceeds maximum length")
- OpenAI SDK errors contain API key fragments, model names, endpoint URLs
- An attacker can differentiate failure modes based on error string content

## Proposed Solutions

### Option 1: Allowlist safe messages in controller (Recommended)

**Approach:** Maintain an allowlist of user-facing error messages in the controller. Only forward messages that match; use a generic fallback otherwise.

```typescript
const SAFE_ERROR_MESSAGES = new Set([
  "Translation failed. Your response could not be saved. Please resend your message.",
]);

(err) => {
  const message = (err instanceof Error && SAFE_ERROR_MESSAGES.has(err.message))
    ? err.message
    : "Stream failed";
  send({ error: message });
  res.end();
},
```

**Pros:**
- Simple, defensive, no new abstractions
- Only explicitly approved messages reach the client

**Cons:**
- Must update allowlist when adding new user-facing errors

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Custom error class for user-facing errors

**Approach:** Create a `UserFacingError` class. Only forward messages from this class.

```typescript
class UserFacingError extends Error { constructor(msg: string) { super(msg); } }

// In controller:
(err) => {
  const message = err instanceof UserFacingError ? err.message : "Stream failed";
  send({ error: message });
  res.end();
},
```

**Pros:**
- Type-safe, extensible
- Makes intent explicit at throw site

**Cons:**
- Requires changing throw sites to use new class

**Effort:** 1 hour

**Risk:** Low

## Recommended Action

Option 1 for immediate fix; migrate to Option 2 if the number of user-facing error messages grows.

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:82-86` — error forwarding
- `src/server/services/runStreamOpenAI.ts:132-134` — translation error throw
- `src/server/services/runStreamOpenAI.ts:249-251` — outer catch block

**Related components:**
- SSE streaming pipeline
- Client error display (`src/client/components/Conversation/index.tsx:101`)

## Acceptance Criteria

- [ ] No OpenAI SDK error messages reach the client
- [ ] No database error messages reach the client
- [ ] Translation failure message ("Translation failed...") still reaches the client
- [ ] Generic "Stream failed" shown for all unexpected errors
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)

**Actions:**
- Identified via security review of commit 98ac954
- Confirmed OpenAI SDK error format includes partial API keys

**Learnings:**
- Never forward raw `err.message` to clients from a catch-all block
