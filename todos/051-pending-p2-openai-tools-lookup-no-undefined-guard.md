---
status: pending
priority: p2
issue_id: "051"
tags: [correctness, error-handling, tool-calling]
dependencies: []
---

# openaiTools[toolName] lookup without undefined guard

## Problem Statement

The new tool selection logic in `runStreamOpenAI.ts` accesses `openaiTools[toolName]` without checking if the key exists. If `toolName` is a string not present in the `openaiTools` record, the result is `[undefined]` passed as the `tools` array to OpenAI — which will crash the API call. The previous code had the same lookup but produced `undefined` (no tools), a more graceful failure mode.

## Findings

- `src/server/services/runStreamOpenAI.ts:67-68` — `openaiTools[toolName]` used without existence check
- Old behavior: `const tool = toolName ? openaiTools[toolName] : undefined` → passed `undefined` (no tools)
- New behavior: `[openaiTools[toolName]]` → passes `[undefined]` (invalid tools array → API crash)
- Currently only `"generate_differentials"` or `undefined` are passed, so this cannot trigger in practice
- Latent defect that will surface when a new tool name is added with a typo in the controller

## Proposed Solutions

### Option 1: Add existence guard

**Approach:** Validate the lookup result before wrapping in an array.

```typescript
const tools = toolName
  ? (openaiTools[toolName] ? [openaiTools[toolName]] : undefined)
  : Object.values(openaiTools);
```

**Pros:**
- Simple, defensive
- Graceful degradation (falls back to no tools)

**Cons:**
- Silent failure if tool name is wrong

**Effort:** 15 minutes

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:67-68` - tool lookup

**Related components:**
- OpenAI tool calling pipeline
- openaiTools registry (`src/server/openaiTools/index.ts`)

## Resources

- **Commit:** d5e3b9f

## Acceptance Criteria

- [ ] Invalid toolName does not crash the OpenAI API call
- [ ] A warning is logged when toolName is not found in openaiTools
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified changed failure mode from graceful to crash
- Proposed guard fix

**Learnings:**
- Object lookup on dynamic keys needs existence checks before array wrapping
