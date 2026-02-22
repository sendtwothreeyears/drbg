---
status: completed
priority: p3
issue_id: "048"
tags: [ux, frontend, i18n]
dependencies: []
---

# sessionStorage language preference not restored on Home page return

## Problem Statement

The Home page saves the selected language to `sessionStorage.setItem("boafo-language", lang)` when changed, but the `language` state is always initialized to `"en"`. If a patient navigates away and returns, the selector resets to English even though they previously selected Twi.

## Findings

- `src/client/components/Home/index.tsx:64` — saves to sessionStorage
- `src/client/components/Home/index.tsx:58` — `useState("en")` ignores stored value

## Proposed Solutions

### Option 1: Initialize from sessionStorage

**Approach:**

```typescript
const [language, setLanguage] = useState(() =>
  sessionStorage.getItem("boafo-language") || "en"
);
```

**Effort:** 5 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] Language preference persists across Home page visits within a session
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
