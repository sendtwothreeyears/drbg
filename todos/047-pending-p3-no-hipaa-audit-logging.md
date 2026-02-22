---
status: pending
priority: p3
issue_id: "047"
tags: [hipaa, security, logging, compliance]
dependencies: []
---

# No HIPAA audit logging for PHI access

## Problem Statement

HIPAA requires audit controls (45 CFR 164.312(b)). There are no structured audit logs recording who accessed conversations, clinical findings, diagnoses, or assessments. The only logging is translation length and error logs. No audit trail exists for breach investigation or compliance reporting.

## Findings

- `src/server/controllers/conversation.ts` — no access logging on any endpoint
- No structured logging library in dependencies
- No request correlation IDs

## Proposed Solutions

### Option 1: Add structured audit logging middleware

**Approach:** Log all PHI access operations with timestamp, endpoint, conversationId, and session/IP.

**Effort:** 4-6 hours

**Risk:** Low

## Acceptance Criteria

- [ ] All PHI access endpoints produce audit log entries
- [ ] Logs include timestamp, action, resource ID, and accessor identity
- [ ] Logs stored separately from application logs
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
