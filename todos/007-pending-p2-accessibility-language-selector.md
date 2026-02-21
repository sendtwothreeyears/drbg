---
status: pending
priority: p2
issue_id: "007"
tags: [accessibility, frontend, a11y]
dependencies: []
---

# LanguageSelector missing ARIA roles, labels, and focus styles

## Problem Statement

The language toggle buttons behave as a radio group but lack `role="radiogroup"`, `role="radio"`, `aria-checked`, `aria-label`, and visible focus ring styles. Keyboard-only users cannot see which button is focused. Screen readers cannot convey the selected state.

## Findings

- `src/client/components/LanguageSelector/index.tsx` — no ARIA attributes
- No `focus:ring-*` Tailwind classes on buttons
- Buttons have no `type="button"` attribute (default is `"submit"` inside forms)

## Proposed Solutions

### Option 1: Add ARIA attributes and focus styles

**Approach:**
- Add `role="radiogroup"` and `aria-label="Select input language"` to wrapper div
- Add `role="radio"` and `aria-checked` to each button
- Add `type="button"` to each button
- Add `focus:ring-2 focus:ring-main focus:ring-offset-1` to button classNames

**Effort:** 15 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/client/components/LanguageSelector/index.tsx`

## Acceptance Criteria

- [ ] Screen reader announces language selection state
- [ ] Focus ring visible when navigating with keyboard
- [ ] Buttons have type="button"
