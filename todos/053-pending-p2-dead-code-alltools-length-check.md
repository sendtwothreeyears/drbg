---
status: pending
priority: p2
issue_id: "053"
tags: [code-quality, dead-code, simplification]
dependencies: []
---

# Dead code: allTools.length > 0 branch is always true

## Problem Statement

The tool selection logic in `runStreamOpenAI.ts` includes a `allTools.length > 0` check that is always true. The `openaiTools` record in `src/server/openaiTools/index.ts` is a static import with two hardcoded entries (`collect_demographics`, `generate_differentials`). `Object.values(openaiTools)` always returns an array of length 2.

## Findings

- `src/server/services/runStreamOpenAI.ts:66-71` — dead `allTools.length > 0` branch
- `src/server/openaiTools/index.ts` — static record with 2 entries; never empty
- The `undefined` fallback on the false branch can never execute

## Proposed Solutions

### Option 1: Simplify to remove dead branch

**Approach:**
```typescript
const tools = toolName
  ? [openaiTools[toolName]]
  : Object.values(openaiTools);
```

**Pros:**
- Removes 3 lines of dead code
- Easier to read

**Cons:**
- None

**Effort:** 5 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:66-71` - tool selection

## Resources

- **Commit:** d5e3b9f

## Acceptance Criteria

- [ ] Dead branch removed
- [ ] Behavior unchanged
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified dead branch via static analysis of openaiTools imports

**Learnings:**
- Defensive checks on static imports create dead code
