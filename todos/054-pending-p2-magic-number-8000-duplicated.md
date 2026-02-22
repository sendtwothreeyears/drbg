---
status: pending
priority: p2
issue_id: "054"
tags: [code-quality, dry, constants]
dependencies: []
---

# Magic number 8000 duplicated across two files

## Problem Statement

The value `8000` is passed as `maxLength` to `translateText()` in two separate files with no named constant. If the limit needs to change, both call sites must be found and updated independently.

## Findings

- `src/server/services/runStreamOpenAI.ts:125` — `translateText(fullText, language, "en", 8000)`
- `src/server/services/generateAssessment.ts:95` — `translateText(text, "en", language, 8000)`
- The default `MAX_INPUT_LENGTH = 2000` is already defined in `translate.ts` but not exported
- No explanation of why 8000 was chosen

## Proposed Solutions

### Option 1: Export named constant from translate.ts

**Approach:**
```typescript
// translate.ts
export const MAX_INPUT_LENGTH = 2000;
export const MAX_LONG_INPUT_LENGTH = 8000;  // For assistant responses & assessments
```

Both call sites import `MAX_LONG_INPUT_LENGTH`.

**Pros:**
- Single source of truth
- Self-documenting

**Cons:**
- None

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/server/services/translate.ts` - define and export constant
- `src/server/services/runStreamOpenAI.ts:125` - use named constant
- `src/server/services/generateAssessment.ts:95` - use named constant

## Resources

- **Commit:** d5e3b9f

## Acceptance Criteria

- [ ] Magic number replaced with named constant
- [ ] Both call sites use the same constant
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified duplicate magic number across files

**Learnings:**
- Translation length limits should be centralized in the translation service
