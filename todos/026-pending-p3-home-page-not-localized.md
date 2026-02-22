---
status: pending
priority: p3
issue_id: "026"
tags: [ux, localization, frontend]
dependencies: []
---

# Home page UI not localized for Twi speakers

## Problem Statement

When a user selects Twi on the Home page, only the textarea placeholder changes to Twi. All other UI text remains in English: "Hi, I'm Boafo", "I'm here to help you understand your symptoms...", "What symptoms are you experiencing?", the "Get Started" button, and the disclaimer text. A monolingual Twi speaker would not understand most of the Home page.

## Findings

- `src/client/components/Home/index.tsx:104-108` — "Hi, I'm Boafo" hardcoded English
- `src/client/components/Home/index.tsx:113-116` — instruction text hardcoded English
- `src/client/components/Home/index.tsx:48` — "Get Started" button text hardcoded English
- `src/client/components/Home/index.tsx:136` — disclaimer hardcoded English
- Similarly, "AI Consult Summary" and assessment loading text in Conversation/index.tsx are English-only

## Proposed Solutions

### Option 1: Simple language lookup object

**Approach:** Create a `UI_STRINGS` object keyed by language code with all user-facing strings. Swap at render time based on `language` state.

**Effort:** 1-2 hours

**Risk:** Low

### Option 2: Adopt react-i18next

**Approach:** Integrate a proper i18n library for scalable localization.

**Effort:** 4-6 hours

**Risk:** Low

## Recommended Action

Option 1 for the demo. Option 2 if more languages are planned.

## Acceptance Criteria

- [ ] Twi users see Twi text on the Home page
- [ ] English experience unchanged

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by spec-flow-analyzer (G-16)
