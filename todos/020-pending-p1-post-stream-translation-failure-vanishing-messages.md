---
status: pending
priority: p1
issue_id: "020"
tags: [data-integrity, error-handling, backend, translation]
dependencies: []
---

# Post-stream translation failure causes vanishing messages

## Problem Statement

In `runStreamOpenAI`, after the full Twi response has been streamed to the client, the server translates it to English for storage (`translateText(fullText, language, "en")`). If this translation call fails, the catch block fires, `onError` is called, and the message is **never persisted to the database**. The user has already seen the complete Twi response, but on page reload it vanishes. The conversation state becomes inconsistent — the DB shows the last message is from the user, so the next stream would re-run, potentially generating a different response.

This is distinct from #001 (orphaned conversation on initial creation) — this occurs mid-conversation after the user has already received a response.

## Findings

- `src/server/services/runStreamOpenAI.ts:100-109` — translation happens after streaming but before persistence
- `src/server/services/runStreamOpenAI.ts:196-198` — catch block calls `onError`, message never persisted
- The user sees: complete Twi response → page reload → response gone
- If streaming text was accumulated client-side, it exists only in React state until the page unloads
- `extractFindings` (line 191) also never runs, losing clinical finding extraction

## Proposed Solutions

### Option 1: Persist Twi text first, translate asynchronously

**Approach:** Immediately persist the assistant message with `content = fullText` (Twi) and `original_content = fullText`, `original_language = language`. Then attempt translation in a separate try/catch. If translation succeeds, update the row with English content. If it fails, the Twi message still exists in the DB.

```typescript
// Always persist first (Twi as content)
await createMessageMutation(
  conversationId, "assistant",
  fullText,          // Twi as content (temporary)
  fullText,          // Twi as original_content
  language,          // "ak"
);

// Then try translation
try {
  const englishContent = await translateText(fullText, language, "en");
  await updateMessageContentMutation(messageId, englishContent);
} catch (translationError) {
  console.error("[runStreamOpenAI] Post-stream translation failed:", translationError);
  // Message still persists with Twi content — flag for manual translation
}
```

**Pros:**
- Message never vanishes
- Graceful degradation (Twi-only message until translation retry)

**Cons:**
- Requires new `updateMessageContentMutation`
- `extractFindings` may fail on Twi content (expects English)

**Effort:** 1-2 hours

**Risk:** Low

### Option 2: Wrap only translation in try/catch

**Approach:** Keep the current flow but wrap the translation call in its own try/catch. On failure, store the Twi text as `content` (without English translation) and continue.

**Pros:**
- Minimal code change
- Message always persists

**Cons:**
- `content` field may contain Twi instead of English, breaking downstream consumers (extractFindings, searchGuidelines)
- Need to flag untranslated messages

**Effort:** 30 minutes

**Risk:** Medium

## Recommended Action

Option 1 — persist first, translate second. This ensures data integrity while allowing graceful degradation.

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:100-161` — post-stream processing block

**Related components:**
- `src/server/db/operations/messages.ts` — may need `updateMessageContentMutation`

## Acceptance Criteria

- [ ] Assistant messages are always persisted even if translation fails
- [ ] Untranslated messages are identifiable in the database
- [ ] Page reload shows the Twi message if English translation failed
- [ ] extractFindings gracefully handles non-English content or skips untranslated messages

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by spec-flow-analyzer (G-13) during flow analysis
- Confirmed as distinct from #001 (which covers initial conversation creation)
