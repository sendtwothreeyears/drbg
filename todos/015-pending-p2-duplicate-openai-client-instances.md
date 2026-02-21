---
status: pending
priority: p2
issue_id: "015"
tags: [architecture, backend, simplicity]
dependencies: []
---

# Duplicate OpenAI client instances

## Problem Statement

Two separate `new OpenAI()` instances are created in the codebase — one in `translate.ts` (line 3-5) and another in `openai-chat.ts` (line 3). Both use the same `OPENAI_API_KEY` environment variable. This means two HTTP connection pools, two sets of default configurations, and divergent timeout/retry settings if one is updated but not the other.

## Findings

- `src/server/services/translate.ts:3-5` — `const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
- `src/server/services/openai-chat.ts:3` — `const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })`
- If timeout is added to one (per todo 010), the other stays without timeout
- No shared configuration means settings drift over time

## Proposed Solutions

### Option 1: Shared OpenAI client module

**Approach:** Create `src/server/services/openaiClient.ts` exporting a single configured instance. Both translate.ts and openai-chat.ts import from it.

```typescript
// src/server/services/openaiClient.ts
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 10_000,
});

export default openai;
```

**Pros:**
- Single source of truth for OpenAI configuration
- Timeout/retry changes apply everywhere
- One connection pool

**Cons:**
- None significant

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

Option 1. Extract shared client before adding timeout (combines with todo 010).

## Technical Details

**Affected files:**
- `src/server/services/translate.ts:3-5` — replace local client with shared import
- `src/server/services/openai-chat.ts:3` — replace local client with shared import
- New file: `src/server/services/openaiClient.ts`

## Acceptance Criteria

- [ ] Single OpenAI client instance shared across all services
- [ ] Timeout and retry configuration applied in one place
- [ ] All existing translation and chat functionality works unchanged

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified during code simplicity review of feat/language-twi branch
- Flagged by code-simplicity-reviewer agent
