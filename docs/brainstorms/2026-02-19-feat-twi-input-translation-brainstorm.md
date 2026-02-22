---
date: 2026-02-19
topic: twi-input-translation
---

# Twi Input Translation — MVP Proof of Concept

## What We're Building

A one-directional translation pipeline: patients type symptoms in Twi on the frontend, the server translates to English via GhanaNLP Khaya, and Claude receives and responds in English. The patient sees Claude's English response as-is.

This proves the core hypothesis: GhanaNLP Khaya can translate Twi patient input accurately enough for Claude to conduct a clinical interview on it.

## Why This Approach

- **Smallest testable slice.** One language, one direction, no database changes, no response translation.
- **Tests the critical risk first.** If Twi-to-English translation quality is poor, nothing else matters — there's no point building the full pipeline.
- **Builds on research.** GhanaNLP Khaya is the only service covering all 5 Ghanaian languages including Dagbani. Starting with their API validates whether it's production-viable.

## Scope

### In scope

- Language selector on Home page (English default, Twi option)
- Textarea placeholder text switches when Twi is selected
- Language choice sent to backend with `POST /api/create`
- Server translates Twi input to English via GhanaNLP Khaya `POST /translate` endpoint
- Translated English text sent to Claude as usual
- Claude's English response streamed back to patient (no translation back)

### Out of scope

- Translating Claude's response back to Twi
- Full UI i18n (buttons, labels, panels stay English)
- Database schema changes (no language column, no bilingual transcripts)
- Translation routing factory (only one provider: GhanaNLP)
- Other languages beyond Twi
- Streaming rework
- Pre-translated system greeting

## Key Decisions

- **English is the default language.** Twi is opt-in via a selector on the Home page.
- **GhanaNLP Khaya is the translation provider.** It's the only service covering all target Ghanaian languages — validating it now informs the full multilingual roadmap.
- **No database changes.** The translated English text is what gets stored (same as current behavior). Language preference lives only in frontend state and is passed per-request.
- **Response stays English.** This is a proof of concept — the goal is to validate translation quality, not deliver a full Twi experience yet.

## Frontend Changes

- **Language selector component** on Home page (English / Twi toggle)
- Selecting Twi updates the textarea placeholder to a Twi string (e.g., "Kyerɛ me wo yare ho..." or standard ASCII equivalent)
- Language choice passed to `createNewConversation(message, language)` call
- No changes to Conversation component rendering — it already displays English

## Backend Changes

- **`POST /api/create`** accepts a `language` field in the request body
- **Before sending to Claude:** if language is not English, translate the patient's message to English via GhanaNLP Khaya API
- **`POST /api/conversation/{id}/message`** also accepts `language` and translates before processing
- Translation happens in a new service (e.g., `src/server/services/translate.ts`) that wraps the GhanaNLP API call
- Existing Claude pipeline (`runStream`, `extractFindings`, `generateAssessment`) receives English and is unchanged

## GhanaNLP Khaya API Integration

- **Endpoint:** `POST https://translation.ghananlp.org/v1/translate`
- **Authentication:** API key via developer portal subscription
- **Action required:** Sign up at https://translation.ghananlp.org/ to get API credentials and confirm pricing

## Open Questions

- What is GhanaNLP Khaya's latency per translation request? This adds to time-to-first-token for the patient.
- What is the API rate limit? Relevant for concurrent patients.
- How does Khaya handle ASCII-substituted Twi (e.g., "e" for "ɛ")? Needs testing.
- Should the first system greeting also be in Twi for this MVP, or is English acceptable since we're testing input translation only?

## Related Research

- [`multilingual-translation.md`](../research/multilingual-translation.md) — Full translation service comparison, architecture pattern, risk analysis

## Next Steps

→ `/workflows:plan` for implementation details
