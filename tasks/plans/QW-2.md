# QW-2: Parallelize extractFindings with Assessment Pipeline

**Impact:** Saves 1-2s from critical path.
**Effort:** Low (~5-line change)
**Risk:** Low. extractFindings has no dependency on assessment output.

## Problem
`extractFindings` (Haiku, 1-3s) runs sequentially after the assessment pipeline in `runStreamOpenAI.ts:278-281` but is completely independent.

## Changes

### 1. Move extractFindings to run concurrently (`src/server/services/runStreamOpenAI.ts`)
Fire `extractFindings` alongside the assessment pipeline using `Promise.all` or fire-and-forget with error handling.

## Done When
- [ ] `extractFindings` runs in parallel with assessment generation
- [ ] Errors in extraction don't break the assessment flow
- [ ] Assessment still completes and returns correctly
