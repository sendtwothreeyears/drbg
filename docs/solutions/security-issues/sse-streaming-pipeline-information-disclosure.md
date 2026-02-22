---
title: P1 Security Fixes - Internal Error Messages and PHI Leakage in Streaming Conversation Engine
date: 2026-02-21
category: security-issues
tags: [error-handling, phi-protection, api-security, streaming, sse]
severity: p1
component: streaming-conversation-engine
symptoms:
  - Raw OpenAI SDK errors exposed to clients containing partial API keys, model names, and rate limit details
  - Protected Health Information (symptoms, medical history) logged to stdout via debug console.log statement
root_cause: Unsanitized error propagation from service layer to client and leftover debug statement in differential diagnosis flow
files_changed:
  - src/server/controllers/conversation.ts
  - src/server/services/runStreamOpenAI.ts
related_todos:
  - "028"
  - "029"
---

# SSE Streaming Pipeline Information Disclosure

Two P1 security vulnerabilities were identified and fixed in the server-sent events (SSE) streaming pipeline for the conversation controller. Both involve sensitive data escaping its intended boundary.

## Problem

The SSE streaming pipeline exposed sensitive information in two distinct ways:

1. **Internal infrastructure details** leaked through error messages forwarded directly to clients via SSE
2. **Protected health information (PHI)** inadvertently logged to stdout via a leftover debug statement in the differential diagnosis flow

Both issues create compliance violations and security risks in a healthcare (HIPAA-regulated) context.

## Investigation

The vulnerability chain begins in `runStreamOpenAI.ts`, which handles OpenAI API integration with bidirectional Twi-English translation:

1. When OpenAI requests fail (rate limits, invalid models, network errors, API key rotation failures), the SDK throws errors containing system details
2. These unfiltered errors bubble up through the catch-all handler in `runStreamOpenAI.ts:249-251`, which casts all errors as `Error` and passes them to `onError`
3. The `onError` callback in `conversation.ts:84` forwarded `err.message` directly to clients via SSE without sanitization
4. Simultaneously, the `getFindingsByConversationQuery()` call in the differential diagnosis phase logged raw clinical findings to stdout at line 224
5. In production, stdout is captured by log aggregation services (CloudWatch, Datadog) with broader access than database controls

The attack surface includes:
- Error messages revealing API endpoint structure, model names, and partial credentials (`sk-proj-****`)
- Clinical findings (symptoms, severity, duration) appearing in centralized logs accessible to non-HIPAA-trained personnel
- Attackers could perform inference attacks by triggering different failure modes to map infrastructure

## Root Cause

Two separate but related oversights in the streaming implementation:

1. **No error message validation layer** between internal service errors and external SSE responses — the controller assumed all errors were user-safe
2. **Leftover debug statement** in the differential diagnosis flow — `console.log("findings", findings)` was not removed before commit

Both stem from treating the streaming pipeline as a transparent data conduit rather than a security boundary.

## Solution

Two complementary hardening strategies:

1. **Allowlist approach for error messages**: Maintain an explicit `Set` of known, user-facing error messages. Map all other errors to a generic fallback that reveals no system details.

2. **Remove debug logging of sensitive data**: Delete the `console.log` statement that outputs clinical findings.

Both changes operate on the principle of least privilege for information disclosure — only forward what the client needs to know, and only log what operators need to monitor.

## Code Changes

### Change 1: Error Message Sanitization (`conversation.ts`)

**Before (vulnerable):**
```typescript
// src/server/controllers/conversation.ts
(err) => {
  send({ error: err.message || "Stream failed" });
  res.end();
},
```

**After (fixed):**
```typescript
// src/server/controllers/conversation.ts
// OnError — only forward known user-facing messages; generic fallback for unexpected errors
(err) => {
  const SAFE_MESSAGES = new Set([
    "Translation failed. Your response could not be saved. Please resend your message.",
  ]);
  const message =
    err instanceof Error && SAFE_MESSAGES.has(err.message)
      ? err.message
      : "Stream failed";
  send({ error: message });
  res.end();
},
```

**Impact**: Prevents leakage of OpenAI SDK errors, rate limit details, endpoint information, and partial credentials through the SSE stream. Clients receive actionable guidance for known errors and a generic fallback for everything else.

### Change 2: Remove PHI Debug Logging (`runStreamOpenAI.ts`)

**Before (vulnerable):**
```typescript
// src/server/services/runStreamOpenAI.ts:224
const findings = await getFindingsByConversationQuery(conversationId);
console.log("findings", findings);
```

**After (fixed):**
```typescript
// src/server/services/runStreamOpenAI.ts:224
const findings = await getFindingsByConversationQuery(conversationId);
```

**Impact**: Eliminates clinical findings (symptoms, categories, durations) from stdout logs, ensuring PHI stays within database access control boundaries. Achieves compliance with HIPAA minimum necessary standard.

## Prevention Strategies

### Lint Rules

- **no-direct-console-log-in-clinical-paths**: Flag bare `console.log()` in `services/` and `controllers/` directories. Require structured logger or explicit prefix.
- **no-raw-error-message-to-client**: Detect `send({ error: err.message })` or `res.json({ error: error.message })` patterns in controllers. Require allowlist validation.
- **no-sensitive-data-in-logs**: Flag logging of variables named `findings`, `diagnoses`, `assessment`, `demographics` without aggregation (counts/IDs only).

### Code Review Checklist

For any PR touching error handling or logging in clinical code paths:

- [ ] All user-facing error messages are in the `SAFE_MESSAGES` allowlist
- [ ] No raw `err.message` forwarded to HTTP responses or SSE clients
- [ ] All `console.*` statements checked: do they log PHI?
- [ ] External API errors (OpenAI, translation) caught and transformed before client forwarding
- [ ] No debug statements (`console.log` without `[prefix]`) left in clinical code

### Error Design Pattern (Future)

If the number of user-facing error messages grows beyond the current allowlist, migrate to a `UserFacingError` class:

```typescript
class UserFacingError extends Error {
  constructor(msg: string) { super(msg); }
}

// In controller:
const message = err instanceof UserFacingError ? err.message : "Stream failed";
```

This makes intent explicit at the throw site and is enforced by the type system.

## Test Cases

1. **SDK error sanitization**: Mock `createOpenAIChatStream()` to throw `APIError("401 Incorrect API key provided: sk-proj-1234...")`. Assert client receives `"Stream failed"`, not the raw message.
2. **Translation error allowlisting**: Mock translation failure. Assert client receives the allowlisted translation error message.
3. **Database error fallback**: Mock `getFindingsByConversationQuery()` to throw. Assert client receives `"Stream failed"`.
4. **Non-Error throw handling**: Throw a string or plain object. Assert the `instanceof Error` check falls through to the generic fallback.
5. **PHI not in stdout**: Spy on `console.log` during a full differential diagnosis flow. Assert no clinical findings data appears in captured calls.

## Cross-References

### Directly Related
- [Todo #028: Internal error messages leaked to client](../../../todos/028-pending-p1-internal-error-messages-leaked-to-client.md)
- [Todo #029: Debug console.log leaks PHI](../../../todos/029-pending-p1-debug-console-log-leaks-phi.md)
- [Todo #011: PHI in console error logs](../../../todos/011-pending-p3-phi-in-console-error-logs.md) (broader PHI logging concern)

### Sibling Issues from Same Review
- [Todo #030: PHI exposure in translation error logs](../../../todos/030-pending-p2-phi-exposure-in-translation-error-logs.md) (P2)
- [Todo #031: Client message removal lacks identity check](../../../todos/031-pending-p2-client-message-removal-lacks-identity-check.md) (P2)
- [Todo #032: OpenAI context loss on translation failure](../../../todos/032-pending-p2-openai-context-loss-on-translation-failure.md) (P2)

### Architecture & Plans
- [OpenAI streaming engine migration](../integration-issues/openai-streaming-conversation-engine-migration.md) — parent solution doc with known issues tracker
- [P1 streaming error resilience plan](../../plans/2026-02-21-fix-p1-streaming-error-resilience-plan.md)
- [P1 hardening brainstorm](../../brainstorms/2026-02-21-p1-hardening-brainstorm.md)
- [Twi input translation](../integration-issues/twi-input-translation.md) — translation error handling patterns

### Error Chain
**Streaming errors**: #028 (leaked errors) → #030 (translation error logs) → #018 (silently swallowed)
**Post-stream translation**: #020 (translation failure) → #032 (context loss) → #033 (no backoff) → #035 (no timeout)
