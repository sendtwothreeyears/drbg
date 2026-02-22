# Brainstorm: Textarea Focus, Assessment Optimization, PDF Export

**Date:** 2026-02-22
**Status:** Ready for planning

---

## What We're Building

Three changes to the conversation experience:

### Bug #1: Textarea Focus Management

The main chat textarea should auto-focus after every AI response so the user can immediately type again. Currently, focus is NOT returning to the textarea after the AI finishes streaming.

**Focus flow:**
1. User sends a message -> textarea disabled during streaming
2. AI finishes streaming -> textarea re-enabled and **auto-focused**
3. Exception: when the demographics form appears, focus goes to the **age number input** inside the demographics form (not the textarea)
4. After the demographics form is submitted and disappears, focus returns to the textarea

No other tool-rendered forms need to capture focus — only demographics.

### Bug #2 -> Revised: English-Only Assessment + Localized CTA

**Problem:** The assessment pipeline (guideline retrieval + Sonnet generation + translation) is slow. Investigation confirmed translation only happens once, so the bottleneck is the full pipeline, not double-translation.

**Decision:** Remove assessment translation entirely.

- Assessment is **always generated in English only** (skip `translateText` call)
- Remove the dual-accordion pattern (translated + English)
- Single accordion showing the English assessment
- If the user has a non-English language selected, display a **localized message in their language** below the assessment, telling them they can download the PDF or email it to their doctor
- Remove `assessmentTranslated` state and DB column usage (can leave column for now, just stop writing to it)

### Feature #1: PDF Download + Email Icons on Accordion

**Placement:** Email and download icons in the accordion header row, to the left of the chevron toggle.

**Download button:**
- Generates a styled PDF server-side using **Puppeteer** (adapted from existing KasaMD code)
- Branded footer with Kasa logo (`assets/kasagreen.png`)
- Returns PDF as base64 to the client
- Client triggers browser download

**Email button:**
- Opens a `mailto:` link in the user's default email client
- User downloads the PDF separately and attaches it manually
- No server-side email service needed

---

## Why This Approach

- **English-only assessment** eliminates the translation wait time, making the end-of-conversation experience noticeably faster
- **Localized CTA** still serves non-English users by guiding them to actionable next steps (download/email) in their language
- **Puppeteer PDF** reuses a proven pattern from another KasaMD project — no new dependencies to learn
- **mailto: for email** avoids needing an email service (SendGrid, Resend, etc.), keeping infrastructure simple
- **Icons in accordion header** is a natural, established UI pattern that doesn't require extra vertical space

---

## Key Decisions

1. **Assessment is English-only** — no translation of assessment content
2. **Localized CTA message** shown for non-English users instead of translated assessment
3. **PDF via Puppeteer** server-side, returned as base64
4. **mailto: link** for email (no server-side email service)
5. **Icons in accordion header row** to the left of the chevron
6. **Focus always returns to textarea** after AI response, except when demographics form is active

---

## Open Questions

_None — all questions resolved during brainstorming._

---

## Technical Notes (for planning phase)

**Relevant files:**
- `src/client/components/Conversation/index.tsx` — textarea ref, focus logic, accordion rendering, streaming state
- `src/client/shared/TextArea/index.tsx` — TextArea component with forwarded ref
- `src/client/components/Conversation/DemographicsForm.tsx` — age input autofocus
- `src/client/shared/Accordion/index.tsx` — needs icon slots added to header
- `src/server/services/generateAssessment.ts` — remove translation call
- `src/server/services/runStreamOpenAI.ts` — assessment pipeline, remove translated assessment from meta
- New: `src/server/services/generatePDF.ts` — Puppeteer PDF generation util
- New: server endpoint to handle PDF generation requests
