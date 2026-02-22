---
status: pending
priority: p2
issue_id: "008"
tags: [reliability, backend, configuration]
dependencies: []
---

# No OPENAI_API_KEY presence check — silent runtime failure

## Problem Statement

The OpenAI client is instantiated at module load time with `process.env.OPENAI_API_KEY`. If the key is missing, the client is created with `undefined` and every translation call fails at runtime with a cryptic OpenAI SDK error. The application starts successfully but translation is silently broken.

## Findings

- `src/server/services/translate.ts:3-5` — client created without key validation
- Existing `searchGuidelines.ts` has the same pattern (pre-existing)

## Proposed Solutions

### Option 1: Add startup guard

**Approach:**
```typescript
if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not set — translation service will be unavailable");
}
```

**Effort:** 5 minutes

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/services/translate.ts:3-5`

## Acceptance Criteria

- [ ] Missing API key produces a clear warning at startup
