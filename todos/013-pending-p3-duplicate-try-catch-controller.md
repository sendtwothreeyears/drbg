---
status: pending
priority: p3
issue_id: "013"
tags: [code-quality, duplication, backend]
dependencies: []
---

# Duplicated translation try/catch pattern in controller

## Problem Statement

`createConversation` and `createConversationMessage` contain nearly identical try/catch blocks for translation + message creation + error handling. If the error message or status code needs to change, both must be updated.

## Findings

- `src/server/controllers/conversation.ts:97-107` and `117-127` — identical pattern

## Proposed Solutions

Extract a `translateAndSaveMessage` helper method on the controller class.

**Effort:** 15 minutes

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts`
