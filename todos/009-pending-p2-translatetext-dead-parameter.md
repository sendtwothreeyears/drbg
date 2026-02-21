---
status: pending
priority: p2
issue_id: "009"
tags: [api-design, backend, simplicity]
dependencies: []
---

# `to` parameter in translateText is dead weight

## Problem Statement

`translateText(text, from, to)` accepts a `to` parameter that is always `"en"` at every call site. The system prompt is hardcoded to Twi-to-English. Passing `to: "fr"` would silently produce English anyway. The parameter creates a false impression of generality.

## Findings

- `src/server/services/translate.ts:12-16` — `to` param validated but never influences behavior
- `src/server/controllers/conversation.ts:98,118` — always called with `"en"`
- The `ALLOWED_LANGUAGES` type machinery (lines 7-8) and the dual validation (lines 20-25) exist primarily because of this unused parameter

## Proposed Solutions

### Option 1: Simplify to `translateToEnglish(text, from)`

**Approach:** Remove `to` parameter, simplify validation to `if (from !== "ak")`.

**Effort:** 15 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/services/translate.ts` — function signature and validation
- `src/server/controllers/conversation.ts:98,118` — call sites

## Acceptance Criteria

- [ ] Function signature reflects actual capability (Twi → English only)
- [ ] Call sites updated
