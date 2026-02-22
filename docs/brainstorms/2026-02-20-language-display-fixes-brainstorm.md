# Language Display Fixes

**Date:** 2026-02-20
**Status:** Brainstorm
**Approach:** Minimal — fix bugs + read-only badge

## What We're Building

Fix two language-related bugs in the conversation UI and add a read-only language badge:

1. **Twi messages display in English** — Conversation page renders `msg.content` (always the English translation) instead of `original_content` (original Twi). User and assistant messages both appear in English even when the conversation language is Twi.

2. **Language selector active mid-conversation** — The `LanguageSelector` component is fully interactive on the conversation page, allowing users to switch language after it's been locked at creation time. This causes a mismatch between the frontend language state (sessionStorage) and the backend conversation language (DB).

3. **Read-only language badge** — Replace the interactive language selector on the conversation page with a non-interactive pill showing the conversation's language (e.g., "Twi" or "English").

4. **Make system prompt language-generic** — `runStreamOpenAI.ts:18` hardcodes `=== "ak"` for the Twi system prompt instruction. Replace with a generic approach that works for any non-English language using the language name from a shared config (e.g., `"Conduct this clinical interview in ${languageName}"`).

## Why This Approach

- The bugs block Twi from working at all — fixing them is the minimum to unblock the feature
- A read-only badge communicates the locked language without adding complexity
- Bilingual assessment (Twi + English) deferred — can be added later without rework
- Static UI text stays in English — keeps scope small, conversation messages are what matter

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Message display for Twi conversations | Twi only | Clean single-language view. No toggle or side-by-side. |
| Language indicator on conversation page | Read-only badge | Non-interactive pill so user knows the language without being able to change it |
| Static UI text (headers, buttons, labels) | Keep English | Only conversation messages switch to Twi. Simpler. |
| AI Consult Summary language | English only (for now) | Deferred to a future pass. Clinical summary is clinician-facing. |

## Root Causes

### Bug 1: Messages show in English
- **File:** `src/client/components/Conversation/index.tsx:158`
- `renderMessages` calls `getDisplayText(msg.content)` — `content` is always English
- The `original_content` field (Twi) is returned from the API but never used
- The frontend doesn't know the conversation language because the API doesn't return it

### Bug 2: Language selector active mid-conversation
- **File:** `src/client/components/Conversation/index.tsx:340`
- `LanguageSelector` rendered with full interactivity
- Language state initialized from `sessionStorage`, not from the conversation record
- Switching language in UI updates sessionStorage but not the DB conversation

### Missing piece: API doesn't return language
- **File:** `src/server/controllers/conversation.ts:196-203`
- `getConversationAndMessages` returns conversation fields but omits `language`
- Frontend has no way to know the conversation's actual language on page load

## Affected Files

| File | Change |
|------|--------|
| `src/server/controllers/conversation.ts` | Return `language` field in `getConversationAndMessages` response |
| `src/client/components/Conversation/index.tsx` | Initialize language from API response; replace `LanguageSelector` with read-only badge; display `original_content` when available |
| `src/client/components/LanguageSelector/index.tsx` | Add a read-only variant (or create a new `LanguageBadge` component) |
| `src/client/utils/index.tsx` | May need to update `getDisplayText` or add a language-aware display helper |
| `src/server/services/runStreamOpenAI.ts` | Replace hardcoded `"ak"` check in `getSystemPrompt` with generic language lookup |
| `src/server/services/translate.ts` | Already has `LANGUAGE_NAMES` map — reuse as the shared config |

## Open Questions

- None — scope is well-defined.

## Future Work (Out of Scope)

- Bilingual AI Consult Summary (Twi + English) — user wants this, deferred to next iteration
- Full UI localization (translating headers, buttons, labels into Twi)
- Additional language support beyond English and Twi (Ewe, Ga)
