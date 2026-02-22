---
status: pending
priority: p2
issue_id: "065"
tags: [bug, ui, i18n]
dependencies: []
---

# assessmentCTA Shows When Language is Null

## Problem Statement

The condition `language !== "en"` evaluates to `true` when `language` is `null` (initial state before conversation loads). This could cause the CTA text to briefly flash for all users during the loading phase.

## Findings

- `src/client/components/Conversation/index.tsx:417` — `{language !== "en" && (...)}`
- `language` state initialized as `null` (line 72)

## Proposed Solutions

### Option 1: Add null guard (Recommended)

```tsx
{language && language !== "en" && (
  <p className="mt-4 text-sm text-gray-600 italic">
    {t("conversation.assessmentCTA")}
  </p>
)}
```

**Effort:** 5 minutes
**Risk:** Low

## Acceptance Criteria

- [ ] CTA text only shows for explicitly non-English conversations
- [ ] CTA does not flash during initial load

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
