---
status: pending
priority: p3
issue_id: "017"
tags: [architecture, frontend, consistency]
dependencies: []
---

# Conversation component bypasses api.ts service layer

## Problem Statement

`Conversation/index.tsx` makes direct `axios.post` and `axios.get` calls (lines 123, 171) instead of using functions from `src/client/services/api.ts`. Meanwhile, `createNewConversation` and `submitDemographics` are properly routed through the api service. This inconsistency makes it harder to add centralized error handling, auth headers, or request interceptors.

## Findings

- `src/client/components/Conversation/index.tsx:123` — `axios.post(\`/api/conversation/${conversationId}/message\`, ...)` direct call
- `src/client/components/Conversation/index.tsx:171` — `axios.get(\`/api/conversation/${conversationId}\`)` direct call
- `src/client/services/api.ts` — has `createNewConversation` and `submitDemographics` but no `sendMessage` or `getConversation` functions

## Proposed Solutions

### Option 1: Add missing functions to api.ts

**Approach:** Create `sendMessage(conversationId, message, language)` and `getConversation(conversationId)` in api.ts, then update Conversation component to use them.

**Effort:** 15 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/client/services/api.ts` — add new functions
- `src/client/components/Conversation/index.tsx:123,171` — replace direct axios calls

## Acceptance Criteria

- [ ] All API calls go through the service layer
- [ ] No direct axios imports in component files

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by code-simplicity-reviewer agent during feat/language-twi review
