---
status: pending
priority: p2
issue_id: "023"
tags: [ux, localization, frontend, backend]
dependencies: []
---

# Canned greeting always English for Twi conversations

## Problem Statement

When a Twi user starts a conversation, the first assistant message is hardcoded in English: "I'll help you work through your symptoms. Let's take a closer look." This message has no `original_content` or `original_language`, so it displays in English even for Twi conversations. A Twi-speaking patient's first interaction with the system is in a language they may not understand.

## Findings

- `src/server/controllers/conversation.ts:106-110` — hardcoded English greeting
- No bilingual fields passed for this message
- `renderMessages` in Conversation/index.tsx shows `getDisplayText(msg.content)` for messages without `original_content`, which returns the English text

## Proposed Solutions

### Option 1: Translate the greeting based on conversation language

**Approach:** Use `translateText` to generate a Twi version of the greeting, or maintain a small lookup table of pre-translated greetings for supported languages.

**Effort:** 30 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:106-110` — greeting creation

## Acceptance Criteria

- [ ] Twi conversations start with a Twi-language greeting
- [ ] English conversations continue to show the English greeting
- [ ] Greeting message stores bilingual fields correctly

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by spec-flow-analyzer (G-09) during user flow analysis
