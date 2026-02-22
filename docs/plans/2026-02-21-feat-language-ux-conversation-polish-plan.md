---
title: Language UX & Conversation Polish
type: feat
status: active
date: 2026-02-21
brainstorm: docs/brainstorms/2026-02-21-language-ux-polish-brainstorm.md
---

# Language UX & Conversation Polish

## Overview

A suite of UX improvements to make Boafo's multilingual experience seamless and consistent. When a user selects Twi, the entire patient-facing experience — from the home page through the conversation to the assessment — should feel native in that language, while clinician-facing panels remain in English. Includes foundational i18n infrastructure, dual-language assessments, TOS consent, and several interaction polish items.

## Problem Statement

The current Twi experience has friction:
- A translation notice tells users their message "will be translated to English" — undermining the native feel
- All UI chrome (buttons, labels, headers, emergency text) stays in English regardless of language
- The assessment is English-only, so Twi-speaking patients can't read their clinical summary
- The demographics form labels are English-only
- The textarea remains interactive during streaming, allowing premature sends
- No Terms of Service consent mechanism exists
- Emergency number references 911 instead of Ghana's 211

## Proposed Solution

Implement `react-i18next` as the i18n foundation, then build each feature on top of it. Features are grouped into three phases by dependency: foundation, UI components, and backend/assessment.

## Technical Approach

### Architecture

```
┌─────────────────────────────────────────────────┐
│  Client                                          │
│                                                  │
│  I18nextProvider (wraps App)                     │
│    ├── language from conversation.language        │
│    ├── en.json (English translations)            │
│    └── ak.json (Twi translations)               │
│                                                  │
│  Home Page                                       │
│    ├── useTranslation() for all strings          │
│    ├── No translation notice                     │
│    └── LanguageSelector sets i18n.changeLanguage │
│                                                  │
│  Conversation Page                               │
│    ├── useTranslation() for all strings          │
│    ├── TOS consent checkbox (localized)          │
│    ├── TextArea disabled={streaming}             │
│    ├── DemographicsForm (localized labels)       │
│    └── Dual assessment accordions                │
│         ├── Accordion 1: user's language         │
│         └── Accordion 2: English                 │
│              (only if language !== "en")          │
│                                                  │
│  Clinician Panels (NOT localized)                │
│    ├── FindingsPanel — always English             │
│    └── DiagnosisPanel — always English            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Server                                          │
│                                                  │
│  System Prompt                                   │
│    └── Contextual demographics prompt in         │
│        patient's language                        │
│                                                  │
│  Assessment Generation                           │
│    ├── Generate English assessment (existing)    │
│    └── Translate to patient's language            │
│        via translateText()                        │
│                                                  │
│  DB: conversations table                         │
│    └── + assessment_translated TEXT               │
└─────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase 0: Foundation (No Feature Dependencies)

**Goal:** Install i18n infrastructure and make two zero-dependency fixes.

##### 0.1 — Set up react-i18next

**Tasks:**
- [x] Install `react-i18next` and `i18next` packages
- [x] Create `src/client/i18n/config.ts` — i18n initialization with `en` and `ak` languages
- [x] Create `src/client/i18n/en.json` — English translation keys
- [x] Create `src/client/i18n/ak.json` — Twi translation keys (AI-generated placeholders, marked for human review)
- [x] Wrap `App` component with `I18nextProvider` in `src/client/main.tsx`
- [x] Wire language from conversation state → `i18n.changeLanguage()` so i18n tracks the active language
- [x] On Home page, wire `LanguageSelector` onChange to also call `i18n.changeLanguage()`

**Files:**
- New: `src/client/i18n/config.ts`
- New: `src/client/i18n/en.json`
- New: `src/client/i18n/ak.json`
- Edit: `src/client/main.tsx` — wrap with I18nextProvider
- Edit: `src/client/components/Home/index.tsx` — sync language selector with i18n
- Edit: `src/client/components/Conversation/index.tsx` — sync conversation language with i18n

**i18n config approach:**
- Bundle translations at build time (JSON imports), not lazy-loaded — avoids flash-of-English race condition
- Flat namespace (single `translation` namespace) — adequate for current scale
- Fallback language: `en`
- Interpolation escaping: enabled (default) — prevents XSS from translation strings

**Translation key structure:**

```json
// en.json
{
  "home": {
    "greeting": "Hi, I'm Boafo",
    "subtitle": "I'm here to help you understand your symptoms. I'll guide you through a few questions.",
    "prompt": "What symptoms are you experiencing?",
    "placeholder": "Describe your symptoms...",
    "getStarted": "Get Started",
    "error": {
      "translationFailed": "Translation failed. Please try again.",
      "generic": "Something went wrong. Please try again."
    }
  },
  "conversation": {
    "consultStarted": "Consult started:",
    "today": "Today",
    "yesterday": "Yesterday",
    "emergency": "If this is an emergency, call 211 or your local emergency number.",
    "summaryTitle": "AI Consult Summary",
    "assessmentTitle": "Assessment & Plan",
    "assessmentTitleEnglish": "Assessment & Plan (English)",
    "loadingTitle": "Writing Your AI Consult Summary",
    "loadingSubtitle": "Reviewing the latest medical data...",
    "placeholder": "Type your message..."
  },
  "demographics": {
    "agePlaceholder": "Age (18+)",
    "female": "Female",
    "male": "Male",
    "submit": "Submit"
  },
  "tos": {
    "consent": "I agree to the <tosLink>KasaMD Terms of Service</tosLink> and will discuss all Boafo output with a doctor. Boafo is an AI clinical tool, not a licensed doctor, and does not practice medicine or provide medical advice or care. Questions or complaints: <emailLink>support@kasamd.com</emailLink>"
  }
}
```

```json
// ak.json (AI-generated placeholders — needs human review)
{
  "home": {
    "greeting": "Me din de Boafo",
    "subtitle": "Mɛboa wo na woahu wo yare ho nsɛm. Mɛbisa wo nsɛmmisa kakra.",
    "prompt": "Yare bɛn na wowɔ?",
    "placeholder": "Kyerɛ me wo yare ho...",
    "getStarted": "Hyɛ ase",
    "error": {
      "translationFailed": "Nkyerɛase no anyɛ yiye. Yɛsrɛ wo bɔ mmɔden bio.",
      "generic": "Biribi kɔɔ basaa. Yɛsrɛ wo bɔ mmɔden bio."
    }
  },
  "conversation": {
    "consultStarted": "Ndwenendwene hyɛɛ aseɛ:",
    "today": "Ɛnnɛ",
    "yesterday": "Ɛnnora",
    "emergency": "Sɛ ɛyɛ ɛhia a, frɛ 211 anaa wo man mu emergency nɔma.",
    "summaryTitle": "AI Ndwenendwene Nsɛm",
    "assessmentTitle": "Nhwɛso ne Nhyehyɛe",
    "assessmentTitleEnglish": "Nhwɛso ne Nhyehyɛe (Borɔfo)",
    "loadingTitle": "Ɛrekyerɛw Wo AI Ndwenendwene Nsɛm",
    "loadingSubtitle": "Ɛrehwɛ yaresa ho nsɛm foforo...",
    "placeholder": "Kyerɛ me wo yare ho..."
  },
  "demographics": {
    "agePlaceholder": "Mfeɛ (18+)",
    "female": "Ɔbaa",
    "male": "Ɔbarima",
    "submit": "Mena so"
  },
  "tos": {
    "consent": "Mepene <tosLink>KasaMD Nhyehyɛe</tosLink> so na mɛka Boafo nsɛm nyinaa akyerɛ dɔkota. Boafo yɛ AI adwumayɛ adwinnadeɛ, ɛnyɛ dɔkota a wɔde tumi amaano, na ɛnyɛ yaremuayie anaa yaremuayie fotoɔ. Nsɛmmisa anaa nkwagye: <emailLink>support@kasamd.com</emailLink>"
  }
}
```

**Success criteria:**
- [ ] `useTranslation()` hook returns correct strings for `en` and `ak`
- [ ] Changing language on Home page updates i18n language
- [ ] Loading Conversation page sets i18n to conversation's language
- [ ] English users see zero behavior changes

##### 0.2 — Remove translation notice

**Tasks:**
- [x] Delete the translation notice JSX block from `src/client/components/Home/index.tsx` (lines 130-134)

**Files:**
- Edit: `src/client/components/Home/index.tsx`

**Success criteria:**
- [ ] No "Your message will be translated..." text visible for any language

##### 0.3 — Emergency number 911 → 211

**Tasks:**
- [x] Update emergency text in `src/client/components/Conversation/index.tsx`: "911" → "112"
- [x] Update system prompt in `src/server/prompts/CLINICAL_INTERVIEW.ts`: "call 911" → "call 112"

**Files:**
- Edit: `src/client/components/Conversation/index.tsx`
- Edit: `src/server/prompts/CLINICAL_INTERVIEW.ts`

**Success criteria:**
- [ ] All user-facing and AI-facing references say 211, not 911

---

#### Phase 1: UI Component Features (Depends on Phase 0)

**Goal:** Localize all patient-facing UI and add interaction improvements.

##### 1.1 — Full UI localization

Replace all hardcoded patient-facing strings with `t()` calls using keys from Phase 0.1.

**Tasks:**
- [x] `src/client/components/Home/index.tsx` — Replace greeting, subtitle, prompt, placeholder, button text, error messages with `t()` calls
- [x] `src/client/components/Conversation/index.tsx` — Replace emergency text, summary title, assessment accordion title, loading panel text, placeholder with `t()` calls
- [x] `src/client/utils/index.tsx` — Replace "Consult started:", "Today", "Yesterday" with `t()` calls in `formatConsultDate()`; accept language param for locale-aware date formatting
- [x] Verify clinician panels (FindingsPanel, DiagnosisPanel, "Demo · For clinician use only", "Findings"/"Diagnoses" toggles) remain hardcoded English

**Files:**
- Edit: `src/client/components/Home/index.tsx`
- Edit: `src/client/components/Conversation/index.tsx`
- Edit: `src/client/utils/index.tsx`

**NOT localized (stays English):**
- "Findings" toggle label
- "Diagnoses" toggle label
- "Demo · For clinician use only"
- FindingsPanel content
- DiagnosisPanel content
- Side panel headers

**Success criteria:**
- [ ] Twi user sees all patient-facing text in Twi
- [ ] English user sees all text in English (no regressions)
- [ ] Clinician panels always English

##### 1.2 — Disable textarea during streaming

**Tasks:**
- [x] Add `disabled?: boolean` prop to `src/client/shared/TextArea/index.tsx`
- [x] Apply `disabled` attribute to the `<textarea>` element
- [x] Add visual styling: `opacity-50 cursor-not-allowed` when disabled
- [x] Pass `streaming` state as `disabled` prop from Conversation component
- [x] Ensure textarea re-enables when streaming completes OR on stream error

**Files:**
- Edit: `src/client/shared/TextArea/index.tsx`
- Edit: `src/client/components/Conversation/index.tsx`

**Edge cases:**
- Text already typed is preserved when streaming begins (user can send it after)
- Stream error → textarea re-enables immediately (existing error handling in `streamResponse` sets `streaming = false`)
- Submit button also disabled during streaming (already the case at line 366)

**Success criteria:**
- [ ] Textarea is visually and functionally disabled during streaming
- [ ] Textarea re-enables after stream completes
- [ ] Textarea re-enables after stream error
- [ ] Pre-typed text is preserved

##### 1.3 — Localized demographics form + auto-focus age input

**Tasks:**
- [x] Add `useTranslation()` to `src/client/components/Conversation/DemographicsForm.tsx`
- [x] Replace "Age (18+)" placeholder with `t("demographics.agePlaceholder")`
- [x] Replace "Female" with `t("demographics.female")`
- [x] Replace "Male" with `t("demographics.male")`
- [x] Replace "Submit" with `t("demographics.submit")`
- [x] Add `useRef` + `useEffect` to auto-focus the age input on mount
- [x] Add `language?: string` prop if needed for i18n context

**Files:**
- Edit: `src/client/components/Conversation/DemographicsForm.tsx`

**Edge cases:**
- Mobile: auto-focus may trigger keyboard. This is acceptable — the user needs to type their age.
- Screen readers: focus shift will announce the input field (acceptable UX).

**Success criteria:**
- [ ] Twi user sees Twi labels on demographics form
- [ ] English user sees English labels
- [ ] Age input has focus when form appears
- [ ] Form validation still works

##### 1.4 — TOS consent checkbox

**Tasks:**
- [x] Add `tosAccepted: boolean` state to Conversation component
- [x] Persist consent in `sessionStorage` keyed by conversation ID (resets per conversation, survives page reload within same conversation)
- [x] Render checkbox + label above the textarea area
- [x] Use `react-i18next` `Trans` component for the TOS text (supports `<tosLink>` and `<emailLink>` interpolation components — prevents XSS)
- [x] Disable send button when `!tosAccepted` (compose with existing `!message.trim() || streaming` condition)
- [x] Style: small text, checkbox aligned left, link styled as underline

**Files:**
- Edit: `src/client/components/Conversation/index.tsx`

**TOS text rendering (using Trans component for safe HTML):**

```tsx
<Trans i18nKey="tos.consent" components={{
  tosLink: <a href="https://kasamd.com/terms" target="_blank" rel="noopener noreferrer" className="underline" />,
  emailLink: <a href="mailto:support@kasamd.com" className="underline" />
}} />
```

**Persistence behavior:**
- Per-conversation: `sessionStorage.setItem(\`boafo-tos-\${conversationId}\`, "true")`
- On mount, check sessionStorage → if "true", set `tosAccepted = true`
- New conversation = new consent required

**Edge cases:**
- Page reload mid-conversation: checkbox restores from sessionStorage
- New conversation: must re-consent
- English and Twi: text comes from i18n translation files

**Success criteria:**
- [ ] Checkbox visible above textarea
- [ ] Send button disabled until checked
- [ ] TOS text displays in user's language
- [ ] Links (Terms of Service, email) are clickable
- [ ] Consent persists on page reload for same conversation
- [ ] New conversation requires fresh consent

---

#### Phase 2: Backend & Assessment (Depends on Phase 0)

**Goal:** Add dual-language assessments and improve demographics prompting.

##### 2.1 — Contextual demographics prompt

**Tasks:**
- [x] Update system prompt in `src/server/prompts/CLINICAL_INTERVIEW.ts` to instruct the AI to generate a warm, contextual message before calling `collect_demographics`
- [x] The prompt should tell the AI to: acknowledge the chief complaint, explain why age/sex are needed, assure privacy, and do this in the patient's language

**Updated prompt addition:**

```
- After the patient describes their chief complaint, use the collect_demographics tool to collect age and biological sex before continuing the assessment. Before calling the tool, send a warm message that:
  1. Acknowledges what the patient has shared
  2. Explains that you need a couple of details (age and biological sex) to give the best guidance
  3. Reassures them that their information is private and secure
  This message should be in the patient's language and feel natural to the conversation.
```

**Files:**
- Edit: `src/server/prompts/CLINICAL_INTERVIEW.ts`

**Behavior:** The AI sends a text message AND calls `collect_demographics` in the same turn. The text message renders above the demographics form (already supported by current rendering order).

**Success criteria:**
- [ ] AI generates a warm preamble before the demographics form
- [ ] Preamble is in the patient's language
- [ ] Preamble acknowledges the chief complaint
- [ ] Demographics form still renders and functions correctly

##### 2.2 — Dual-language assessment transcripts

**Tasks:**
- [x] Add `assessment_translated TEXT` column to conversations table in schema.sql (DB wipe instead of migration)
- [x] Update `src/server/services/generateAssessment.ts` to accept a `language` parameter
- [x] After generating the English assessment, if `language !== "en"`, translate it via `translateText()` to the patient's language
- [x] Return both `text` (English) and `translatedText` (patient's language) from `generateAssessment()`
- [x] Update `src/server/services/runStreamOpenAI.ts` to pass `language` to `generateAssessment()` and store `assessment_translated` via mutation
- [x] Update `src/server/db/operations/conversations.ts` to store/retrieve `assessment_translated`
- [x] Update `src/server/controllers/conversation.ts` to return `assessmentTranslated` in API response
- [x] Update `src/client/components/Conversation/index.tsx` to display dual accordions when `assessmentTranslated` exists
- [x] Update `src/types/conversation.ts` to include `assessment_translated` field

**DB migration:**

```sql
ALTER TABLE conversations
ADD COLUMN IF NOT EXISTS assessment_translated TEXT;
```

**Files:**
- New: `src/server/scripts/migrate-002-add-assessment-translated.ts`
- Edit: `src/server/services/generateAssessment.ts`
- Edit: `src/server/services/runStreamOpenAI.ts`
- Edit: `src/server/db/operations/conversations.ts`
- Edit: `src/server/controllers/conversation.ts`
- Edit: `src/client/components/Conversation/index.tsx`

**Generation strategy:**
1. Generate assessment in English (existing flow — Claude Sonnet)
2. If `language !== "en"`, translate English assessment → patient's language via `translateText(assessment, "en", language)`
3. Store both: `assessment` (English, source of truth) and `assessment_translated` (patient's language)

**Client display logic:**

```tsx
{assessment && !assessmentTranslated && (
  // English-only user: single accordion (current behavior)
  <Accordion title={t("conversation.assessmentTitle")}>
    <ReactMarkdown>{assessment}</ReactMarkdown>
  </Accordion>
)}

{assessment && assessmentTranslated && (
  // Non-English user: two accordions, patient's language first
  <>
    <Accordion title={t("conversation.assessmentTitle")} defaultOpen={true}>
      <ReactMarkdown>{assessmentTranslated}</ReactMarkdown>
    </Accordion>
    <Accordion title={t("conversation.assessmentTitleEnglish")}>
      <ReactMarkdown>{assessment}</ReactMarkdown>
    </Accordion>
  </>
)}
```

**Edge cases:**
- **English user:** `assessmentTranslated` is null → single accordion (no change)
- **Translation failure:** If `translateText()` fails, store only the English assessment. Log warning. The patient sees one English accordion (graceful degradation).
- **Existing conversations:** `assessment_translated` is null for old conversations → single accordion (backward compatible)
- **Loading state:** Both assessments generate before display (translation happens server-side before response)

**Success criteria:**
- [ ] Twi user sees two accordions: Twi first (open), English second (closed)
- [ ] English user sees single accordion (no regression)
- [ ] Both assessments stored in DB
- [ ] Translation failure degrades to English-only gracefully
- [ ] Old conversations render correctly with single accordion

---

## Alternative Approaches Considered

| Approach | Why Rejected |
|---|---|
| **Lazy-load translations** | Adds complexity and causes flash-of-English on first render. Bundle size is trivial for 2 languages. |
| **Generate assessment natively in Twi** | Less reliable than translating a high-quality English assessment. English assessment is the clinical source of truth. |
| **Server-side TOS enforcement** | Adds complexity for MVP. TOS is currently a UI gate only. Can add server-side recording as a follow-up when legal review is complete. |
| **On-demand assessment translation** | Adds delay when toggling between languages. Both generated at assessment time per brainstorm decision. |
| **Separate translation namespace per page** | Over-engineering for 2 languages and ~30 keys. Single flat namespace is sufficient. |

## Acceptance Criteria

### Functional Requirements

- [ ] Twi user sees all patient-facing UI in Twi
- [ ] English user experience is unchanged
- [ ] Translation notice removed from Home page
- [ ] Emergency number says 211 everywhere
- [ ] Demographics form labels localized
- [ ] Age input auto-focused when form appears
- [ ] Textarea disabled during streaming, re-enables after
- [ ] TOS checkbox blocks message sending until accepted
- [ ] TOS text localized in both English and Twi
- [ ] Dual-language assessment accordions for Twi users
- [ ] Single assessment accordion for English users
- [ ] AI generates contextual demographics prompt in patient's language

### Non-Functional Requirements

- [ ] No flash-of-English when loading Twi conversation
- [ ] Translation failure degrades gracefully (English fallback)
- [ ] TOS link rendering uses `Trans` component (XSS-safe)
- [ ] Clinician panels always render in English

### Quality Gates

- [ ] All existing functionality works for English users
- [ ] Manual test: complete Twi conversation end-to-end
- [ ] Manual test: complete English conversation end-to-end
- [ ] Twi translations marked as AI-generated for human review

## Dependencies & Prerequisites

| Dependency | Status | Notes |
|---|---|---|
| Bilingual DB schema (language, original_content) | ✅ Done | Migration 001 applied |
| OpenAI streaming engine | ✅ Done | runStreamOpenAI.ts operational |
| Translation service | ✅ Done | translate.ts using gpt-4o-mini |
| P1 streaming fixes | ✅ Done | Error resilience hardened |
| Language state threading | ✅ Done | Client → API → DB → response |
| `assessment_translated` column | ❌ Needed | Migration 002 in this plan |
| `react-i18next` package | ❌ Needed | Phase 0.1 |

## Risk Analysis & Mitigation

| Risk | Impact | Mitigation |
|---|---|---|
| Twi medical translations inaccurate | High — clinical misinformation | AI-generated translations marked for human review. English assessment is source of truth. |
| TOS legal text machine-translated | Medium — enforceability concern | Flag for legal review. Display English TOS as canonical. |
| Assessment translation API failure | Medium — degraded UX | Graceful fallback to English-only assessment. Log warning. |
| i18n flash-of-English | Low — visual glitch | Bundle translations at build time, not lazy-loaded. |
| Auto-focus triggers mobile keyboard | Low — minor UX | Acceptable: user needs to type age immediately. |

## Future Considerations

- **Server-side TOS consent recording** — When legal review completes, add `tos_accepted_at` timestamp to conversations table
- **Additional languages** — Ewe (`ee`), Ga (`ga`) translation files following same pattern
- **Human-reviewed translations** — Replace AI-generated Twi placeholders with human-verified translations
- **Accessibility audit** — Screen reader testing for TOS checkbox, demographics form focus, disabled textarea states

## References & Research

### Internal References

- Brainstorm: `docs/brainstorms/2026-02-21-language-ux-polish-brainstorm.md`
- Translation service: `src/server/services/translate.ts`
- Streaming engine: `src/server/services/runStreamOpenAI.ts`
- System prompt: `src/server/prompts/CLINICAL_INTERVIEW.ts`
- Assessment generation: `src/server/services/generateAssessment.ts`
- Migration pattern: `src/server/scripts/migrate-001-add-language-support.ts`
- Streaming security fixes: `docs/solutions/security-issues/sse-streaming-pipeline-information-disclosure.md`
- Bilingual architecture: `docs/solutions/integration-issues/openai-streaming-conversation-engine-migration.md`

### Key File Index

| File | Changes |
|---|---|
| `src/client/i18n/config.ts` | New — i18n initialization |
| `src/client/i18n/en.json` | New — English translation keys |
| `src/client/i18n/ak.json` | New — Twi translation keys |
| `src/client/main.tsx` | Wrap with I18nextProvider |
| `src/client/components/Home/index.tsx` | Remove notice, localize strings, sync i18n language |
| `src/client/components/Conversation/index.tsx` | TOS checkbox, dual accordions, localize strings, disable textarea |
| `src/client/components/Conversation/DemographicsForm.tsx` | Localize labels, auto-focus age |
| `src/client/shared/TextArea/index.tsx` | Add disabled prop |
| `src/client/utils/index.tsx` | Localize date strings |
| `src/server/prompts/CLINICAL_INTERVIEW.ts` | Demographics prompt update, 911→211 |
| `src/server/services/generateAssessment.ts` | Accept language, return translated assessment |
| `src/server/services/runStreamOpenAI.ts` | Pass language to assessment, store translated |
| `src/server/db/operations/conversations.ts` | Store/retrieve assessment_translated |
| `src/server/controllers/conversation.ts` | Return assessmentTranslated in API |
| `src/server/scripts/migrate-002-add-assessment-translated.ts` | New — add assessment_translated column |
