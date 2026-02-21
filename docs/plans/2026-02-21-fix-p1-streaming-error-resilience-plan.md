---
title: "fix: P1 Streaming Error Resilience (Issues #018, #019, #020)"
type: fix
status: active
date: 2026-02-21
brainstorm: docs/brainstorms/2026-02-21-p1-hardening-brainstorm.md
---

# fix: P1 Streaming Error Resilience

## Overview

Fix the 3 remaining P1 issues in the streaming pipeline. All three share the same code path (`runStreamOpenAI.ts` → `conversation.ts` → `stream.ts` → `Conversation/index.tsx`) and are fixed together.

## Problem Statement

Three interconnected bugs in the post-stream pipeline:

1. **#018**: Stream errors are silently swallowed. The server sends `{ error: "Stream failed" }` (generic, ignores actual error). The client shows a hardcoded message and only removes empty assistant messages — leaving streamed content visible even when the response was never persisted.

2. **#019**: No structured logging for Twi quality verification. A basic similarity check exists but logs minimal context.

3. **#020**: If post-stream translation (Twi→English) fails, the catch block stores Twi in the `content` column (`englishContent = fullText` at line 141). This violates the rule: **English is the single source of truth in `content`**. No Twi should ever land there.

## Proposed Solution

### Principle

**Translate first, persist second.** If we can't produce English, we don't write to the DB. The user is told to retry.

### #020 — Translation failure: retry then fail clean

**File:** `src/server/services/runStreamOpenAI.ts:111-143`

Replace the current catch block (which stores Twi as fallback) with:

1. Attempt translation
2. On failure, retry once
3. On second failure, throw — do not persist

```typescript
// --- Stream complete ---

// Translate assistant response: English is the single source of truth
let englishContent = fullText;
let originalContent: string | null = null;
let originalLanguage: string | null = null;

if (language !== "en" && fullText) {
  originalContent = fullText;
  originalLanguage = language;

  // Translate with one retry — English must exist before persistence
  let translationError: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      englishContent = await translateText(fullText, language, "en");
      translationError = null;
      break;
    } catch (err) {
      translationError = err;
      console.error(
        `[runStreamOpenAI] Translation attempt ${attempt} failed:`,
        err,
      );
    }
  }

  if (translationError) {
    throw new Error(
      "Translation failed. Your response could not be saved. Please resend your message.",
    );
  }

  // Quality check: detect if OpenAI responded in English instead of requested language
  const src = fullText.toLowerCase().trim();
  const tgt = englishContent.toLowerCase().trim();
  if (
    src === tgt ||
    (src.length > 20 &&
      tgt.length > 20 &&
      Math.abs(src.length - tgt.length) /
        Math.max(src.length, tgt.length) <
        0.1)
  ) {
    console.warn(
      `[runStreamOpenAI] Language quality warning: ` +
        `expected ${LANGUAGE_NAMES[language]} but response appears to be English. ` +
        `conversationId=${conversationId} responseLength=${fullText.length}`,
    );
  }
}
```

**What this removes:** Line 141 (`englishContent = fullText`) — the Twi fallback that violates the English-only rule.

**What this ensures:** The `throw` propagates to the outer catch block (line 238), which calls `onError(error)` → controller sends error to client → client removes the streamed message and shows the error.

#### Gate extractFindings on successful persistence

**File:** `src/server/services/runStreamOpenAI.ts:230-234`

Currently `extractFindings` runs unconditionally. If translation failed and we threw before persisting, this code is unreachable (the throw already jumped to the catch block). But for clarity and safety, keep it gated within the try block after successful persistence — which it already is.

No code change needed here. The `throw` on translation failure exits the try block before reaching line 230.

### #018 — Stream error propagation

#### Server: pass error details through SSE

**File:** `src/server/controllers/conversation.ts:82-86`

Current code ignores the error parameter:

```typescript
// Current (broken)
() => {
  send({ error: "Stream failed" });
  res.end();
},
```

Fix: use the error message from `runStreamOpenAI`:

```typescript
// Fixed
(err) => {
  send({ error: err.message || "Stream failed" });
  res.end();
},
```

This means the translation failure message ("Translation failed. Your response could not be saved. Please resend your message.") flows through to the client.

#### Client: remove streamed assistant message on any error

**File:** `src/client/components/Conversation/index.tsx:91-102`

Current code only removes the assistant message if it has no content:

```typescript
// Current (broken)
(errorMsg) => {
  setStreaming(false);
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (last?.role === "assistant" && !last.content) {
      return prev.slice(0, -1);
    }
    return prev;
  });
  setError("The response could not be completed. Please try again.");
},
```

Fix: remove the last assistant message regardless of content (it was never persisted), and use the server's error message:

```typescript
// Fixed
(errorMsg) => {
  setStreaming(false);
  setMessages((prev) => {
    const last = prev[prev.length - 1];
    if (last?.role === "assistant") {
      return prev.slice(0, -1);
    }
    return prev;
  });
  setError(errorMsg || "The response could not be completed. Please try again.");
},
```

### #019 — Twi quality logging (log-only)

**File:** `src/server/services/runStreamOpenAI.ts:119-134`

The existing similarity check and `console.warn` is sufficient for this pass. No code change needed — the quality check already logs `conversationId` and `responseLength`.

Future pass: add language detection and alerting thresholds.

## Technical Considerations

### Lost context on translation failure

If translation fails and the message is not persisted, OpenAI loses context of what it just said on the next turn. This is a known trade-off: English-only `content` is non-negotiable. In practice, translation failure after a successful stream is extremely rare (OpenAI API is already proven working). The single retry makes it even more unlikely. If it does happen, the user resends and OpenAI re-generates from the existing conversation history.

### SSE connection stays open

The SSE connection is held open for the entire `runStreamOpenAI` execution. The `throw` on translation failure propagates to the catch block, which calls `onError`, which calls `send({ error: ... })` and `res.end()`. The error has a delivery path — no timing issue.

### extractFindings is unaffected

`extractFindings` runs on `lastUserMsg.content` (fetched from DB at stream start). The user's message is always in English (translated by the controller before persistence). The assistant translation failure doesn't affect this — `extractFindings` reads the user's message, not the assistant's.

## Acceptance Criteria

- [ ] Post-stream translation retries once on failure
- [ ] If both translation attempts fail, assistant message is NOT persisted to DB
- [ ] No Twi text ever appears in the `content` column
- [ ] Client receives specific error message on translation failure
- [ ] Client removes the streamed assistant message (even if it has content) on any stream error
- [ ] Client shows actionable error message telling user to retry
- [ ] Normal English conversations are unaffected
- [ ] Normal Twi conversations with successful translation are unaffected
- [ ] `extractFindings` continues to receive English text

## Affected Files

| File | Change | Lines |
|------|--------|-------|
| `src/server/services/runStreamOpenAI.ts` | Replace translation catch with retry+throw, remove Twi fallback | 111-143 |
| `src/server/controllers/conversation.ts` | Pass `err.message` through onError SSE event | 82-86 |
| `src/client/components/Conversation/index.tsx` | Remove `!last.content` guard, use server error message | 91-102 |

**No changes needed:**
- `src/client/services/stream.ts` — already supports `onError` with string messages
- `src/server/services/translate.ts` — no changes
- `src/server/db/operations/messages.ts` — no new mutations

## References

- Brainstorm: `docs/brainstorms/2026-02-21-p1-hardening-brainstorm.md`
- Todo #018: `todos/018-pending-p1-stream-errors-silently-swallowed.md`
- Todo #019: `todos/019-pending-p1-no-twi-output-quality-verification.md`
- Todo #020: `todos/020-pending-p1-post-stream-translation-failure-vanishing-messages.md`
- Solution learnings: `docs/solutions/integration-issues/openai-streaming-conversation-engine-migration.md`
