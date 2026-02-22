# Brainstorm: Language UX & Conversation Polish

**Date**: 2026-02-21
**Status**: Approved

## What We're Building

A suite of UX improvements to make Boafo's multilingual experience seamless and consistent. When a user selects a non-English language (e.g., Twi), the entire experience — from the home page through the conversation to the assessment — should feel native in that language, while keeping clinician-facing panels in English.

### Feature Breakdown

1. **Remove translation notice** — Delete the "Your message will be translated to English for processing. Responses will be in English." message from both Home and Conversation pages.

2. **Dual-language assessment transcripts** — When the conversation is in a non-English language, generate two assessment versions at assessment time (both stored in DB). Display as two separate accordions: the user's language first, English second. Each accordion title is in its respective language.

3. **Contextual demographics prompt** — Update the server-side system prompt so the AI generates a warm, contextual message before calling `collect_demographics` (e.g., acknowledging the chief complaint, explaining why age/sex are needed, assuring privacy). This message should be in the user's selected language.

4. **Localized demographics form** — The inline demographics form labels ("Age", "Sex", "Female", "Male", "Submit") should be in the user's selected language.

5. **Auto-focus age input** — When the demographics form appears, auto-focus the age number input instead of the default textarea.

6. **Disable textarea during streaming** — The textarea should be completely disabled (not interactive) while the AI's message is being rendered.

7. **TOS consent checkbox** — On the conversation page, a checkbox with consent text appears above the textarea. The user must check it before they can send their next message. Text: "I agree to the [KasaMD Terms of Service](https://kasamd.com/terms) and will discuss all Boafo output with a doctor. Boafo is an AI clinical tool, not a licensed doctor, and does not practice medicine or provide medical advice or care. Questions or complaints: support@kasamd.com". Localized into the user's selected language (including Twi).

8. **Full UI localization (react-i18next)** — All user-facing UI text should reflect the selected language:
   - **Home page**: Greeting ("I'm here to help you understand your symptoms..."), placeholder text, "Get Started" button
   - **Conversation page**: "Consult started: ...", "If this is an emergency, call 211 or your local emergency number", "AI Consult Summary", "Assessment & Plan" accordion title, loading panel text
   - **NOT localized** (stays English): "Findings" toggle, "Diagnoses" toggle, "Demo: For clinician use only", FindingsPanel content, DiagnosisPanel content, side panel headers

9. **Emergency number update** — Change from 911 to 211.

## Why This Approach

**Hybrid implementation (i18n foundation first, then features):**
- Set up `react-i18next` with English + Twi translation files containing all keys
- Then implement each feature in dependency order, each using the i18n system from the start
- Avoids retrofitting translations later while keeping the initial setup lightweight

**AI-generated Twi translations** as placeholders, marked for human review and correction.

**AI-generated demographics prompt** (server-side) rather than hardcoded, so the message feels natural and contextual to the conversation.

**Both assessments generated at assessment time** (not on-demand) to avoid UX delays when toggling between language versions.

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| i18n approach | `react-i18next` library | Scalable, industry standard, supports future languages |
| TOS consent | Blocking checkbox above textarea on conversation page, localized | Must accept before sending messages; mirrors Doctronic pattern; text translated to user's language |
| Demographics prompt | AI-generated via system prompt | Feels natural and contextual to each conversation |
| Assessment translation | Both generated at assessment time | No delay when viewing; both stored in DB |
| Assessment display | Two separate accordions | User's language first, English second; titles in respective languages |
| Emergency number | 211 | Ghana-focused |
| Side panels | Always English | Clinician-facing, not patient-facing |
| Twi translations | AI-generated placeholders for review | Speeds up initial implementation |

## Affected Files

### Client
- `src/client/components/Home/index.tsx` — Remove translation notice, localize UI strings
- `src/client/components/Conversation/index.tsx` — TOS checkbox, disable textarea, dual accordions, localize strings
- `src/client/components/Conversation/DemographicsForm.tsx` — Localize labels, auto-focus age input
- `src/client/shared/TextArea/index.tsx` — Add disabled prop support
- `src/client/utils/index.tsx` — Localize date formatting strings
- New: `src/client/i18n/` — i18n config, `en.json`, `ak.json` translation files

### Server
- `src/server/prompts/CLINICAL_INTERVIEW.ts` — Update demographics tool usage instructions
- `src/server/services/generateAssessment.ts` — Generate translated assessment version
- `src/server/controllers/conversation.ts` — Store/return translated assessment
- DB migration — Add `assessment_translated` column to `conversations` table

## Open Questions

None — all questions resolved during brainstorm dialogue.
