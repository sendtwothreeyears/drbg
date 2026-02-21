---
title: "P1 Hardening: Error Resilience & Translation Safety"
type: fix
status: draft
date: 2026-02-21
---

# P1 Hardening: Error Resilience & Translation Safety

## What We're Building

Fix the 3 remaining P1 issues to make the streaming pipeline resilient to errors. These all live in the streaming/post-stream path and are tightly coupled:

1. **#018 — Stream errors silently swallowed**: Client treats stream errors as normal completion. User sees partial/broken response with no error indication.
2. **#019 — No Twi output quality verification**: OpenAI may respond in wrong language. No detection or logging.
3. **#020 — Post-stream translation failure = vanishing messages**: If Twi→English translation fails after streaming, message is never persisted but user already saw it.

## Why This Approach

These are the last P1 issues. #001 (orphaned conversation) and #002 (optimistic UI rollback) are already fixed. The remaining three share the same code path (`runStreamOpenAI.ts` + `stream.ts`) and should be fixed together.

## Key Decisions

### #018 — Stream error propagation
- Add `onError` callback to client's `startStream()`
- On stream error: display error message to user, remove partial assistant message from state
- User can retry by resending their message

### #019 — Twi quality verification: log-only
- Add structured logging after stream completes: log the conversation language, response length, and a sample of the response text
- Do NOT block or modify the response based on language detection
- Defer automated language detection to a future pass — this is for audit visibility only

### #020 — Translation failure: retry then fail clean
- **English is the single source of truth** — no Twi-only rows in the `content` column, ever
- After stream completes, translate Twi→English with **one retry** on failure
- If both attempts fail: **do not persist the message**. Send an error to the client telling the user to retry their message. This ensures we always have an English message to go back to.
- The current fallback on line 141 of `runStreamOpenAI.ts` (`englishContent = fullText`) must be removed — it stores Twi in `content`, violating the English-only rule
- `extractFindings` and the clinical pipeline are never exposed to non-English content

### Principle
- Translation happens FIRST, persistence happens SECOND
- If we can't produce English, we don't write to the DB
- The user is always told to retry so the conversation state stays clean

## Open Questions

None — all decisions resolved during brainstorming.

## Affected Files

| File | Changes |
|------|---------|
| `src/server/services/runStreamOpenAI.ts` | Add translation retry, structured logging, error propagation |
| `src/client/services/stream.ts` | Add `onError` callback, stop treating errors as completion |
| `src/client/components/Conversation/index.tsx` | Handle stream errors: show error, remove partial message |
| `src/server/db/operations/messages.ts` | No changes needed (no new mutation) |

## References

- Todo #018: `todos/018-pending-p1-stream-errors-silently-swallowed.md`
- Todo #019: `todos/019-pending-p1-no-twi-output-quality-verification.md`
- Todo #020: `todos/020-pending-p1-post-stream-translation-failure-vanishing-messages.md`
