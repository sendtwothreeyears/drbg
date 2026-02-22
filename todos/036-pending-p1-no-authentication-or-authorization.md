---
status: pending
priority: p1
issue_id: "036"
tags: [security, hipaa, authentication, authorization]
dependencies: []
---

# No authentication or authorization on any endpoint

## Problem Statement

Every API endpoint is completely public — no session management, no JWT verification, no API key check. Anyone who knows or guesses a `conversationId` (UUID) can read full conversation history, clinical findings, diagnoses, and assessments. They can also inject messages, submit demographics, or trigger LLM streams for any conversation.

The `authorid` column exists in the `conversations` table but is never populated or checked, suggesting auth was planned but never implemented.

This violates HIPAA's access control requirement (45 CFR 164.312(a)(1)).

## Findings

- `src/server/main.ts:7-10` — no authentication middleware, just `express.json()` + routes
- `src/server/routes/conversation.ts:1-35` — all 7 routes are completely unprotected
- `src/server/db/schema/schema.sql:17` — `authorid` column exists but is never used
- No session library in `package.json`

**Impact:** Full PHI exposure. Any anonymous user can:
1. Read any conversation (messages, findings, diagnoses, assessment)
2. Inject messages into any conversation
3. Submit demographics for any conversation
4. Trigger LLM API calls for any conversation

## Proposed Solutions

### Option 1: Session-based auth with express-session

**Approach:** Add `express-session` with secure cookie configuration. Generate a session on conversation creation, require it on all subsequent access. Associate conversations with session IDs.

**Pros:**
- Simple to implement
- No external auth provider needed
- Suitable for anonymous clinical sessions

**Cons:**
- Session-only (no persistent user accounts)
- Requires session store for production (Redis, pg)

**Effort:** 4-6 hours

**Risk:** Medium (touches all routes)

### Option 2: Per-conversation access token

**Approach:** Generate a random access token on conversation creation, return it to the client, require it as a bearer token on all subsequent requests for that conversation.

**Pros:**
- Stateless (no session store)
- Ties access to conversation knowledge
- Simple to implement

**Cons:**
- Token in URL/localStorage is vulnerable to XSS
- No user identity for audit logging

**Effort:** 2-3 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.** This is the single most impactful security improvement — without it, every other security measure is undermined.

## Technical Details

**Affected files:**
- `src/server/main.ts` — add auth middleware
- `src/server/routes/conversation.ts` — all routes need auth check
- `src/server/controllers/conversation.ts` — validate ownership
- `src/server/db/operations/conversations.ts` — set `authorid`

## Acceptance Criteria

- [ ] All conversation endpoints require valid authentication
- [ ] One conversation's data cannot be accessed by another session
- [ ] `authorid` column populated on conversation creation
- [ ] Unauthenticated requests return 401
- [ ] Tests pass
- [ ] Code reviewed and approved

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)

**Actions:**
- Confirmed zero auth middleware in main.ts
- Confirmed all 7 routes unprotected
- Noted `authorid` column exists but unused
