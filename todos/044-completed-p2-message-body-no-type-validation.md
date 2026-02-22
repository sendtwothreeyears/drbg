---
status: completed
priority: p2
issue_id: "044"
tags: [security, validation, backend]
dependencies: []
---

# Message body lacks type validation (req.body.message not string-checked)

## Problem Statement

The `message` field from `req.body` in `createConversation` and `createConversationMessage` is destructured without type checking. If an attacker sends `{ "message": 123 }` or `{ "message": { "$ne": "" } }`, calling `text.trim()` in `translateText()` throws a `TypeError` with internal details.

## Findings

- `src/server/controllers/conversation.ts:99` — `const { message, language = "en" } = req.body;` (no type check)
- `src/server/controllers/conversation.ts:144` — same pattern
- `src/server/services/translate.ts:35` — `text.trim()` throws if text is not a string
- `src/server/services/translate.ts:41` — `text.length` has different semantics for arrays/objects

## Proposed Solutions

### Option 1: Add explicit type guard at controller entry

**Approach:**

```typescript
if (typeof message !== 'string' || !message.trim()) {
  return res.status(400).json({ error: 'Message is required' });
}
```

**Effort:** 15 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] Non-string message values return 400
- [ ] Empty/whitespace-only messages rejected
- [ ] No TypeError propagation to client
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
