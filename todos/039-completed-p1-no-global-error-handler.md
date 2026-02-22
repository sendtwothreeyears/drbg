---
status: completed
priority: p1
issue_id: "039"
tags: [security, error-handling, backend, information-disclosure]
dependencies: []
---

# No global Express error handler — non-streaming endpoints leak stack traces

## Problem Statement

The Express app in `main.ts` has no global error handler. Most controller methods (`createDemographics`, `getFindingsByConversation`, `getDiagnosesByConversation`, `getConversationAndMessages`) have no try/catch. Unhandled errors propagate to Express's default handler which returns full stack traces in development mode, leaking:
- Database host, port, and connection strings
- Table names, column names, and constraint names
- Full file paths and line numbers

Existing todo 028 covers SSE streaming errors specifically (and has been fixed with the SAFE_MESSAGES allowlist), but these non-streaming REST endpoints have no protection.

## Findings

- `src/server/main.ts:7-10` — no `app.use((err, req, res, next) => {...})`
- `src/server/controllers/conversation.ts:168-187` — `createDemographics` has no try/catch
- `src/server/controllers/conversation.ts:189-196` — `getFindingsByConversation` no try/catch
- `src/server/controllers/conversation.ts:199-205` — `getDiagnosesByConversation` no try/catch
- `src/server/controllers/conversation.ts:207-224` — `getConversationAndMessages` no try/catch
- Express 5 propagates unhandled rejections to default error handler

## Proposed Solutions

### Option 1: Add global error handler middleware

**Approach:** Add a catch-all error handler as the last middleware in `main.ts`.

```typescript
app.use((err, req, res, next) => {
  console.error('[server]', err);
  res.status(500).json({ error: 'Internal server error' });
});
```

**Effort:** 15 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/main.ts` — add error handler middleware

## Acceptance Criteria

- [ ] Global error handler returns generic 500 response
- [ ] No stack traces or internal details reach the client
- [ ] Errors are logged server-side for debugging
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)

**Actions:**
- Confirmed no global error handler in main.ts
- Confirmed 4 controller methods have no try/catch
