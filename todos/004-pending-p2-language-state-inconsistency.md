---
status: pending
priority: p2
issue_id: "004"
tags: [ux, state-management, frontend]
dependencies: []
---

# Home page does not read language from sessionStorage on mount

## Problem Statement

Home initializes language state to `"en"` (line 59) while Conversation reads from `sessionStorage` (lines 41-43). If a user selects Twi on Home, submits, navigates back to Home, the toggle resets to English even though `sessionStorage` still has `"ak"`. This is a usability bug — the user expects their language preference to persist.

## Findings

- `src/client/components/Home/index.tsx:59` — `useState("en")` hardcoded
- `src/client/components/Conversation/index.tsx:41-43` — reads from sessionStorage
- Flagged by architecture and simplicity review agents

## Proposed Solutions

### Option 1: Read sessionStorage on Home mount

**Approach:**
```typescript
const [language, setLanguage] = useState(
  () => sessionStorage.getItem("boafo-language") || "en",
);
```

**Effort:** 2 minutes

### Option 2: Extract a `useLanguage` hook (addresses this + duplication)

**Approach:** Create a shared hook that handles both initialization and persistence.

**Effort:** 15 minutes

## Recommended Action

Option 1 for immediate fix. Option 2 as a follow-up if more language logic is added.

## Technical Details

**Affected files:**
- `src/client/components/Home/index.tsx:59` — language state initialization

## Acceptance Criteria

- [ ] Navigating back to Home preserves the language selection
- [ ] Default is still English if sessionStorage is empty
