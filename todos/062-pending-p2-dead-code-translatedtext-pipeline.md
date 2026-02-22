---
status: pending
priority: p2
issue_id: "062"
tags: [cleanup, dead-code]
dependencies: []
---

# Dead Code: translatedText Pipeline Still Wired Across 7 Files

## Problem Statement

Commit 870c9f7 removed assessment translation logic but left the plumbing in place. `translatedText` is hardcoded to `null` in `generateAssessment.ts` but still: declared in the `AssessmentResult` type, destructured in `runStreamOpenAI.ts`, passed to `updateAssessmentMutation`, written to the `assessment_translated` DB column, returned from `getConversationAndMessages`, and defined in the `Conversation` TypeScript type. The `language` parameter in `generateAssessment` is also unused.

## Findings

- `src/server/services/generateAssessment.ts:91` — `translatedText` hardcoded to `null`
- `src/server/services/generateAssessment.ts:26` — `language` parameter accepted but unused
- `src/server/services/runStreamOpenAI.ts:265` — Destructures `translatedText`
- `src/server/db/operations/conversations.ts` — Writes NULL to `assessment_translated`
- `src/server/controllers/conversation.ts:261` — Returns field in API response
- `src/types/conversation.ts` — Type definition includes field

## Proposed Solutions

### Option 1: Remove translatedText from all files (Recommended)

**Approach:** Delete the field from: AssessmentResult type, generateAssessment return, runStreamOpenAI destructuring, updateAssessmentMutation, API response, TypeScript type. Keep DB column (nullable) for backward compat.

**Effort:** 1 hour
**Risk:** Low

## Acceptance Criteria

- [ ] `translatedText` removed from all TypeScript types and function signatures
- [ ] `language` parameter removed from `generateAssessment`
- [ ] DB column left intact but no longer actively written
- [ ] No runtime errors after cleanup

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
