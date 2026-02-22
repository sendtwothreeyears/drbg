---
status: pending
priority: p3
issue_id: "055"
tags: [security, i18n, defense-in-depth]
dependencies: []
---

# Language from sessionStorage used without whitelist validation

## Problem Statement

The i18n config reads `sessionStorage.getItem("boafo-language")` and passes it directly to i18next's `lng` option without validating it against supported locales. While i18next's `fallbackLng: "en"` and `escapeValue: true` mitigate most risks, an arbitrary string could briefly trigger loading logic for a non-existent locale.

## Findings

- `src/client/i18n/config.ts:12` — raw sessionStorage value used as language
- Supported languages are `"en"` and `"ak"` only
- i18next falls back to `"en"` for unknown locales (defense-in-depth exists)
- Risk is minimal but validation is a one-line improvement

## Proposed Solutions

### Option 1: Add whitelist check

**Approach:**
```typescript
const SUPPORTED_LOCALES = ["en", "ak"];
const stored = typeof window !== "undefined" ? sessionStorage.getItem("boafo-language") : null;
// ...
lng: stored && SUPPORTED_LOCALES.includes(stored) ? stored : "en",
```

**Pros:**
- Defense-in-depth
- Documents supported locales

**Cons:**
- Must update when adding new languages

**Effort:** 10 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/client/i18n/config.ts:12` - language initialization

## Resources

- **Commit:** d5e3b9f

## Acceptance Criteria

- [ ] Language value is validated against a supported locale list
- [ ] Unsupported values fall back to "en"
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified unvalidated sessionStorage read

**Learnings:**
- Values from external storage should be validated against allowed sets
