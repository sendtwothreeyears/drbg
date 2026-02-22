---
status: pending
priority: p2
issue_id: "052"
tags: [correctness, i18n, ssr]
dependencies: []
---

# i18n SSR guard should use typeof window, not typeof sessionStorage

## Problem Statement

The i18n config reads `sessionStorage` at module evaluation time with a `typeof sessionStorage !== "undefined"` guard. While this technically works for undeclared variables in pure Node.js, the idiomatic and more robust pattern is `typeof window !== "undefined"`. The current approach has a subtle failure mode: if a bundler or SSR framework polyfills `sessionStorage` without implementing the full Storage API, the typeof check passes but `getItem` throws.

## Findings

- `src/client/i18n/config.ts:12` — `typeof sessionStorage !== "undefined"` used as SSR guard
- This executes at module evaluation time during `i18n.init()`, not inside a React component
- The standard browser detection pattern is `typeof window !== "undefined"`
- A whitelist check on the stored value would add defense-in-depth

## Proposed Solutions

### Option 1: Use typeof window guard + language whitelist

**Approach:**
```typescript
lng: (typeof window !== "undefined" &&
      ["en", "ak"].includes(sessionStorage.getItem("boafo-language") || "")
        ? sessionStorage.getItem("boafo-language")
        : "en") as string,
```

Or simpler:
```typescript
const stored = typeof window !== "undefined" ? sessionStorage.getItem("boafo-language") : null;
// ...
lng: (stored && ["en", "ak"].includes(stored)) ? stored : "en",
```

**Pros:**
- Idiomatic SSR guard
- Validates stored value against supported locales
- Prevents arbitrary strings in i18n

**Cons:**
- Slightly more verbose
- Supported languages list needs to stay in sync

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/client/i18n/config.ts:12` - language initialization

## Resources

- **Commit:** d5e3b9f

## Acceptance Criteria

- [ ] Guard uses `typeof window !== "undefined"` pattern
- [ ] Stored language is validated against supported locales
- [ ] Fallback to "en" works correctly
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified non-idiomatic SSR guard
- Proposed fix with language whitelist

**Learnings:**
- `typeof window !== "undefined"` is the universal browser detection pattern
- Values from sessionStorage should be validated against allowed sets
