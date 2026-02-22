---
status: pending
priority: p1
issue_id: "037"
tags: [security, infrastructure, rate-limiting, cost]
dependencies: []
---

# No rate limiting on any endpoint

## Problem Statement

There is no rate limiting on any endpoint. Each request can trigger multiple external API calls (translation + streaming chat + findings extraction + embeddings). An attacker can script thousands of requests and run up significant API costs or exhaust server connections.

The docs/solutions reference recommended `express-rate-limit` at 10 req/min/IP but it was never implemented.

## Findings

- `src/server/main.ts` — no rate-limit middleware
- `package.json` — `express-rate-limit` not in dependencies
- Stream endpoint triggers: 1 OpenAI chat completion + 1 translation + 1 Anthropic findings extraction (minimum 3 API calls per stream)
- Diagnosis flow adds: RAG embedding + guideline search + assessment generation + assessment translation (6+ API calls total)
- SSE connections are long-lived — mass-opening streams exhausts server connection pool

## Proposed Solutions

### Option 1: express-rate-limit with tiered limits

**Approach:** Install `express-rate-limit`. Apply different limits to creation vs. streaming vs. read endpoints.

```typescript
import rateLimit from 'express-rate-limit';

const createLimiter = rateLimit({ windowMs: 60000, max: 3 }); // 3 conversations/min
const messageLimiter = rateLimit({ windowMs: 60000, max: 10 }); // 10 messages/min
const readLimiter = rateLimit({ windowMs: 60000, max: 30 }); // 30 reads/min

app.use('/api/create', createLimiter);
app.use('/api/conversation/:id/message', messageLimiter);
app.use('/api/conversation/:id/stream', messageLimiter);
```

**Effort:** 1-2 hours

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/main.ts` — add rate-limit middleware
- `package.json` — add express-rate-limit dependency

## Acceptance Criteria

- [ ] Rate limiting configured on all write/stream endpoints
- [ ] Appropriate error response (429) returned when limit exceeded
- [ ] Read endpoints have reasonable limits
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)

**Actions:**
- Confirmed no rate limiting in codebase
- Confirmed high API cost amplification potential
