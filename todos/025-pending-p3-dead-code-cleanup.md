---
status: pending
priority: p3
issue_id: "025"
tags: [code-quality, cleanup]
dependencies: []
---

# Dead code cleanup across multiple files

## Problem Statement

Several exported functions and code artifacts are unused, adding maintenance surface area.

## Findings

- `src/server/db/operations/messages.ts:34-40` — `getLastUserMessageQuery` is exported but never imported. `runStreamOpenAI.ts:189` uses inline `dbMessages.findLast()` instead.
- `src/server/db/operations/conversations.ts:22-26` — `updateConversationTitleMutation` is exported but never imported
- `src/server/db/operations/conversations.ts:29-33` — `getAllConversationsQuery` is exported but never imported
- `src/client/services/api.ts:37` — commented-out `// getAllConversations` export
- `src/server/services/translate.ts:10-12` — commented-out future language entries (YAGNI)

## Proposed Solutions

### Option 1: Remove all dead code

**Approach:** Delete the unused functions and commented-out code.

**Effort:** 15 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] No unused exports remain in the affected files
- [ ] No commented-out code remains
- [ ] Build and tests pass after removal

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by code-simplicity-reviewer agent
