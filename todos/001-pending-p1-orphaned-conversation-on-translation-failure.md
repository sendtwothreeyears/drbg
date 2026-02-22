---
status: completed
priority: p1
issue_id: "001"
tags: [data-integrity, error-handling, backend]
dependencies: []
---

# Orphaned conversation rows on translation failure

## Problem Statement

In `createConversation()`, the conversation row and initial assistant message are created in the database BEFORE translation is attempted. If `translateText()` throws, the controller returns a 502 but the conversation and its orphan assistant message persist. The client never receives a `conversationId`, so there is no way to clean up or resume. Repeated failures accumulate dead rows.

## Findings

- `src/server/controllers/conversation.ts:88-107` — `createConversationMutation()` at line 90 and `createMessageMutation()` at lines 91-95 run before the try/catch at line 97
- On translation failure, the catch block returns 502 but the DB rows are already committed
- Client will call `createConversation` again on retry, creating yet another orphaned row
- Flagged by 3 independent review agents (security, architecture, quality)

## Proposed Solutions

### Option 1: Translate first, then create conversation

**Approach:** Move `translateText()` before `createConversationMutation()`. Only create DB records after translation succeeds.

```typescript
async createConversation(req: Request, res: Response) {
  const { message, language = "en" } = req.body;
  try {
    const englishMessage = await translateText(message, language, "en");
    const conversationId = await createConversationMutation();
    await createMessageMutation(conversationId, "assistant", "I'll help you...");
    await createMessageMutation(conversationId, "user", englishMessage);
    res.json({ conversationId });
  } catch (error) {
    console.error("Translation failed:", error);
    return res.status(502).json({ error: "translation_failed", message: "..." });
  }
}
```

**Pros:**
- Simple reordering, minimal code change
- No orphaned rows possible

**Cons:**
- The catch now also catches DB errors as "translation_failed" (could add separate try/catch)

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

Option 1 is the simplest fix. Reorder the operations so translation precedes DB writes.

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:88-107` — `createConversation` method

## Acceptance Criteria

- [x] Translation failure does not create any DB rows
- [x] Successful flow creates conversation, assistant message, and user message as before
- [x] Client receives 502 on translation failure with no side effects

## Work Log

### 2026-02-19 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified during multi-agent code review of feat/language-twi branch
- Confirmed by security, architecture, and quality agents
