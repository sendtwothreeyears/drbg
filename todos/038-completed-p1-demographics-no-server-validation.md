---
status: completed
priority: p1
issue_id: "038"
tags: [security, validation, backend, data-integrity]
dependencies: []
---

# Demographics endpoint lacks all server-side input validation

## Problem Statement

The `createDemographics` controller accepts `age`, `biologicalSex`, and `toolUseId` from `req.body` and passes them directly to the database with zero server-side validation. Only client-side HTML validation exists (`min="18" max="120"`), which is trivially bypassed.

Invalid `biologicalSex` values trigger an uncaught PostgreSQL CHECK constraint violation that returns a 500 with database schema details.

## Findings

- `src/server/controllers/conversation.ts:168-187` — no validation on any field
- `age` — no type check, no range check; accepts negative numbers, strings, objects
- `biologicalSex` — no validation; invalid values cause uncaught PG constraint error
- `toolUseId` — injected into JSON stored as message content with no format check
- `conversationId` — no UUID format validation, no existence check
- Database constraint: `CHECK(biological_sex IN ('male', 'female'))` catches some bad values but error propagates unsanitized

## Proposed Solutions

### Option 1: Add explicit validation guards

**Approach:** Validate all fields before database operations.

```typescript
async createDemographics(req, res) {
  const { conversationId } = req.params;
  const { toolUseId, age, biologicalSex } = req.body;

  if (typeof age !== 'number' || !Number.isInteger(age) || age < 0 || age > 150) {
    return res.status(400).json({ error: 'Invalid age' });
  }
  if (!['male', 'female'].includes(biologicalSex)) {
    return res.status(400).json({ error: 'Invalid biological sex' });
  }
  if (typeof toolUseId !== 'string' || !toolUseId) {
    return res.status(400).json({ error: 'Invalid tool use ID' });
  }
  // ... proceed
}
```

**Effort:** 30 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:168-187` — add validation

## Acceptance Criteria

- [ ] All demographic fields validated server-side
- [ ] Invalid values return 400 with safe error messages
- [ ] No database constraint errors propagate to client
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)

**Actions:**
- Confirmed zero server-side validation on demographics endpoint
- Confirmed PG constraint errors propagate unsanitized
