# QW-3: Parallelize Embedding Calls in searchGuidelines

**Impact:** Saves 150-300ms per differential diagnosis.
**Effort:** Low
**Risk:** None. The two embedding calls are independent.

## Problem
In `searchGuidelines.ts:22-33`, two `embedQuery` calls run sequentially but are independent.

## Changes

### 1. Parallelize embeddings and searches (`src/server/services/searchGuidelines.ts`)
```typescript
const [conditionEmbedding, findingsEmbedding] = await Promise.all([
  embedQuery(condition),
  embedQuery(findingsQuery),
]);
const [conditionChunks, findingsChunks] = await Promise.all([
  searchGuidelineChunksQuery(conditionEmbedding, limit),
  searchGuidelineChunksQuery(findingsEmbedding, limit),
]);
```

### 2. Fix misleading log message (line 55)
Says "passed 0.85 threshold" but filters at 0.50 (`MIN_SIMILARITY`).

## Done When
- [ ] Both embedding calls run via `Promise.all`
- [ ] Both DB searches run via `Promise.all`
- [ ] Log message fixed to show correct threshold
