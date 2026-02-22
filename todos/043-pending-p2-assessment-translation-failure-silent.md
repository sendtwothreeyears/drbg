---
status: pending
priority: p2
issue_id: "043"
tags: [ux, translation, backend, accessibility]
dependencies: []
---

# Assessment translation failure silently swallowed — patient gets English-only

## Problem Statement

In `generateAssessment.ts`, if the assessment translation to the patient's language fails, the error is caught and `translatedText` remains `null`. The client displays the English assessment with no warning. A Twi-speaking patient receives a clinical assessment they may not be able to read, with no indication that translation failed.

## Findings

- `src/server/services/generateAssessment.ts:93-98` — translation failure caught with `console.warn`, `translatedText = null`
- `src/server/services/runStreamOpenAI.ts:239` — `meta.assessmentTranslated = translatedText` (null)
- `src/client/components/Conversation/index.tsx:338-343` — shows English-only accordion when `assessmentTranslated` is null
- No user-facing indication of translation failure
- Accordion title is in Twi (`t()`) but content is English — confusing UX

## Proposed Solutions

### Option 1: Add "translation unavailable" banner

**Approach:** Pass a `translationFailed` flag in the metadata. Client shows a dismissible banner: "Assessment could not be translated to Twi. Showing English version."

**Effort:** 1-2 hours

**Risk:** Low

### Option 2: Retry translation with backoff

**Approach:** Retry translation up to 2 times before falling back. Still show the banner if all retries fail.

**Effort:** 1-2 hours

**Risk:** Low

## Acceptance Criteria

- [ ] Patient is informed when assessment translation fails
- [ ] English assessment still displayed as fallback
- [ ] Banner is translatable via i18n
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
