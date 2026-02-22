---
status: pending
priority: p2
issue_id: "066"
tags: [accessibility, ui]
dependencies: []
---

# Accordion: Nested Buttons + Missing ARIA Attributes

## Problem Statement

1. The Accordion header is a `<button>` that contains the download and email `<button>` elements. Nesting interactive elements (buttons inside a button) is invalid HTML and causes unpredictable behavior in browsers and screen readers.
2. The icon-only download and email buttons lack `aria-label` attributes.
3. The Accordion toggle button lacks `aria-expanded` attribute.

## Findings

- `src/client/shared/Accordion/index.tsx:16-47` — Outer `<button>` contains inner buttons via `headerActions`
- `src/client/components/Conversation/index.tsx:383-410` — Download and email buttons have `title` but no `aria-label`

## Proposed Solutions

### Option 1: Refactor Accordion header to non-button container (Recommended)

Change the outer element from `<button>` to a `<div>` with `role="button"`, `tabIndex={0}`, `onKeyDown` for Enter/Space, and `aria-expanded`. Add `aria-label` to icon buttons.

**Effort:** 1 hour
**Risk:** Low

## Acceptance Criteria

- [ ] No nested `<button>` elements in the DOM
- [ ] Accordion toggle communicates expanded/collapsed state via `aria-expanded`
- [ ] Icon-only buttons have `aria-label`
- [ ] Keyboard navigation still works (Enter/Space to toggle)

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
