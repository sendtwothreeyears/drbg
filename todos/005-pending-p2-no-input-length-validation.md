---
status: pending
priority: p2
issue_id: "005"
tags: [security, validation, backend]
dependencies: []
---

# No input length validation before translation API call

## Problem Statement

The `message` field from `req.body` is passed to `translateText()` with no length validation. Express defaults to 100KB body limit. A user could send very large payloads to inflate OpenAI API costs or cause timeouts. The `max_tokens: 1024` only limits the output, not the input.

## Findings

- `src/server/controllers/conversation.ts:89,115` — no length check on message
- `src/server/services/translate.ts` — no input length guard
- No `express.json({ limit })` configured in main.ts

## Proposed Solutions

### Option 1: Add message length check in controller + body size limit

**Approach:**
- Add `express.json({ limit: '10kb' })` in main.ts
- Validate `message.length <= 2000` in controller before calling translateText
- Return 400 for oversized messages

**Effort:** 15 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:89,115`
- `src/server/main.ts` — express.json configuration

## Acceptance Criteria

- [ ] Messages over 2000 characters are rejected with a 400 error
- [ ] Body size limit is configured on express.json middleware
