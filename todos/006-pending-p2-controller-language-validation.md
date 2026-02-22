---
status: pending
priority: p2
issue_id: "006"
tags: [validation, backend, error-handling]
dependencies: []
---

# No server-side language validation at controller level

## Problem Statement

The controller destructures `language` with a default of `"en"` but never validates it. If a client sends `language: "zh"`, the error comes from deep inside the translation service as an "Unsupported language pair" error, caught as a 502. A 502 is semantically wrong — this is a client input error (400). The plan specifies "Invalid language parameter → Fallback to English" but the implementation throws instead.

## Findings

- `src/server/controllers/conversation.ts:89,115` — no validation of language value
- Plan doc line 309 specifies fallback to English for invalid language
- Current behavior: throws → 502, contradicting plan spec

## Proposed Solutions

### Option 1: Validate and fallback at controller level

**Approach:**
```typescript
const SUPPORTED_LANGUAGES = ["en", "ak"];
const language = SUPPORTED_LANGUAGES.includes(req.body.language)
  ? req.body.language
  : "en";
```

**Effort:** 5 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:89,115`

## Acceptance Criteria

- [ ] Invalid language values fall back to English silently
- [ ] No 502 error for invalid language — message is processed in English
