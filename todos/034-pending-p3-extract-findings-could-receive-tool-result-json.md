---
status: pending
priority: p3
issue_id: "034"
tags: [data-integrity, findings, edge-case]
dependencies: []
---

# extractFindings could receive tool_result JSON as user message

## Problem Statement

In `src/server/services/runStreamOpenAI.ts:242-245`:

```typescript
const lastUserMsg = dbMessages.findLast((m: Message) => m.role === "user");
if (lastUserMsg) {
  await extractFindings(conversationId, lastUserMsg.content);
}
```

The `dbMessages` snapshot could include tool_result messages that have `role: "user"` (see `createDemographics` in the controller at line 177). If the last "user" message is a JSON tool_result string like `[{"type":"tool_result","tool_use_id":"...","content":"Patient demographics collected: Age 30, Sex male"}]`, `extractFindings` would send JSON to the extraction model, producing garbage findings.

## Findings

- `src/server/controllers/conversation.ts:177` — stores tool_result with `role: "user"`
- `src/server/services/runStreamOpenAI.ts:242` — `findLast` does not filter tool_result messages
- `extractFindings` likely catches all errors silently, so this would fail silently

## Proposed Solutions

### Option 1: Filter tool_result messages before findLast

**Approach:**
```typescript
const lastUserMsg = dbMessages.findLast(
  (m: Message) => m.role === "user" && !m.content.startsWith('[{"type":"tool_result"')
);
```

**Effort:** 10 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] `extractFindings` never receives JSON tool_result content

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)
