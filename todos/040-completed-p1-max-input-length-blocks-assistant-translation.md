---
status: completed
priority: p1
issue_id: "040"
tags: [data-integrity, translation, backend, streaming]
dependencies: ["020"]
---

# MAX_INPUT_LENGTH (2000 chars) too low for assistant response translation

## Problem Statement

`translateText()` enforces a `MAX_INPUT_LENGTH` of 2000 characters, which is appropriate for user input but applied to ALL translations including assistant responses. OpenAI's `max_completion_tokens: 1024` can produce responses that exceed 2000 characters in Twi. When `runStreamOpenAI` tries to translate the assistant's Twi response to English for storage, the length check throws, causing the "Translation failed" error — but the response was already streamed to the patient. The patient sees the response, but it is never persisted. On page reload, the message vanishes.

Additionally, the `MAX_OUTPUT_RATIO` of 3 may block legitimate Twi-to-English translations since clinical English explanations can be much longer than equivalent Twi phrases.

## Findings

- `src/server/services/translate.ts:15-16` — `MAX_INPUT_LENGTH = 2000`, `MAX_OUTPUT_RATIO = 3`
- `src/server/services/translate.ts:41-43` — length check applied to all input
- `src/server/services/runStreamOpenAI.ts:119` — calls `translateText(fullText, language, "en")` where `fullText` can exceed 2000 chars
- `src/server/services/openai-chat.ts:23` — `max_completion_tokens: 1024` (1024 tokens ≈ 2000-4000 characters)
- Compounds with todo 020 (vanishing messages on translation failure)

## Proposed Solutions

### Option 1: Separate limits for user input vs. assistant translation

**Approach:** Add a `maxLength` parameter to `translateText()` or split into `translateUserInput()` and `translateAssistantResponse()` with different limits.

```typescript
export async function translateText(
  text: string, from: string, to: string,
  maxLength: number = MAX_INPUT_LENGTH,
): Promise<string> {
  if (text.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  // ...
}
```

Call with higher limit for assistant responses:
```typescript
englishContent = await translateText(fullText, language, "en", 8000);
```

**Effort:** 30 minutes

**Risk:** Low

### Option 2: Remove length check from translateText, validate at call sites

**Approach:** Move the length validation to the controller (user input boundary) and remove it from the translate service. The translate service should translate whatever it receives.

**Effort:** 30 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/services/translate.ts:15-16, 41-43` — adjust or remove length limits
- `src/server/controllers/conversation.ts` — add input length check at boundary
- `src/server/services/runStreamOpenAI.ts:119` — call with appropriate limit

## Acceptance Criteria

- [ ] User input still has reasonable length limit
- [ ] Assistant response translation does not fail due to length
- [ ] Output ratio check adjusted for legitimate cross-language expansion
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)

**Actions:**
- Identified that MAX_INPUT_LENGTH applies to both user and assistant text
- Confirmed 1024 tokens can exceed 2000 characters
