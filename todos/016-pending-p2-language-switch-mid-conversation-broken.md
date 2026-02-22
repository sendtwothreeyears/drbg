---
status: pending
priority: p2
issue_id: "016"
tags: [ux, architecture, frontend, backend]
dependencies: ["004"]
---

# Language switch mid-conversation produces wrong response language

## Problem Statement

The UI allows language switching mid-conversation via `LanguageSelector` in `Conversation/index.tsx`. However, `conversation.language` is set at creation time and never updated. In `runStreamOpenAI`, the system prompt is based on `conversation.language` (from DB), not the per-message language. This means:

1. User starts conversation in English → `conversation.language = "en"`
2. User switches to Twi mid-conversation
3. User sends Twi message → controller translates Twi→English → stores correctly
4. Stream starts → `runStreamOpenAI` reads `conversation.language = "en"` → **English system prompt** → model responds in **English**
5. User sees English response despite selecting Twi

The user's Twi input is translated correctly, but the model doesn't know to respond in Twi because the system prompt lacks the Twi instruction.

## Findings

- `src/server/services/runStreamOpenAI.ts:37` — `const language = conversation?.language || "en"` reads from DB
- `src/server/services/runStreamOpenAI.ts:17-23` — `getSystemPrompt(language)` uses DB language
- `src/client/components/Conversation/index.tsx:339-340` — LanguageSelector shown and mutable mid-conversation
- `src/server/controllers/conversation.ts:126` — per-message language only used for translation, not stored on conversation
- Related to todo 004 (Home language init), but this is a server-side issue

## Proposed Solutions

### Option 1: Disable language switching mid-conversation

**Approach:** Hide or disable the LanguageSelector after the first message is sent. Language is fixed at conversation creation.

**Pros:**
- Simplest fix; no backend changes
- Avoids confusion about response language

**Cons:**
- User cannot switch language if they made a mistake

**Effort:** 10 minutes

**Risk:** Low

### Option 2: Update conversation.language on language change

**Approach:** Add an API endpoint to update `conversation.language`. When user switches language, call it. `runStreamOpenAI` will then use the updated language.

**Pros:**
- Full flexibility for users

**Cons:**
- More complex; needs new endpoint and DB update
- Mid-conversation language switch creates a mixed-language transcript

**Effort:** 1-2 hours

**Risk:** Medium

## Recommended Action

Option 1 for MVP. Lock language at conversation creation. Consider Option 2 for future.

## Technical Details

**Affected files:**
- `src/client/components/Conversation/index.tsx:339-340` — LanguageSelector visibility

## Acceptance Criteria

- [ ] Language cannot be changed after conversation starts, OR
- [ ] Language changes are persisted to conversation.language and affect system prompt

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified during deep-dive scenario analysis of feat/language-twi branch
- Discovered that conversation.language is immutable after creation while UI allows changes
