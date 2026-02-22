---
status: completed
priority: p2
issue_id: "041"
tags: [security, hipaa, database, infrastructure]
dependencies: []
---

# Database connection without SSL/TLS configuration

## Problem Statement

The PostgreSQL connection pool in `src/server/db/index.ts` has no SSL configuration. While `host: "localhost"` suggests development, deployment to a cloud environment with a separate database host would transmit PHI in plaintext. The password also defaults to empty string and user to superuser `postgres`.

Violates HIPAA's transmission security requirement (45 CFR 164.312(e)(1)).

## Findings

- `src/server/db/index.ts:3-8` — no `ssl` property, password defaults to `""`, user defaults to `postgres`

## Proposed Solutions

### Option 1: Add environment-driven SSL configuration

**Approach:** Enable SSL when `NODE_ENV=production` or via a dedicated env var.

**Effort:** 15 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] SSL enabled for production database connections
- [ ] No default superuser credentials
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
