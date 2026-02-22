---
status: pending
priority: p2
issue_id: "050"
tags: [clinical-safety, architecture, tool-calling, demographics]
dependencies: []
---

# Non-deterministic demographics collection after forced-tool removal

## Problem Statement

Commit d5e3b9f removed the forced `collect_demographics` tool when no patient profile exists. Now all tools are passed to OpenAI with `tool_choice: "auto"`, relying entirely on the system prompt to guide the AI into calling `collect_demographics`. This makes demographics collection non-deterministic — the AI may skip demographics, call `generate_differentials` prematurely, or engage in free-form conversation indefinitely.

In a clinical decision support system, demographics (age, biological sex) are critical inputs for differential diagnosis accuracy.

## Findings

- `src/server/controllers/conversation.ts:63-66` — `toolName` set to `undefined` when `!profile` (was `"collect_demographics"`)
- `src/server/services/runStreamOpenAI.ts:66-71` — all tools provided when `toolName` is `undefined`
- `src/server/services/openai-chat.ts:18-24` — no `tool_choice` parameter set; OpenAI defaults to `"auto"`
- System prompt in `src/server/prompts/CLINICAL_INTERVIEW.ts` instructs AI to collect demographics, but prompt compliance is probabilistic
- Server guard at `runStreamOpenAI.ts:228` catches premature differentials but creates dead-end state (see #049)

## Proposed Solutions

### Option 1: Hybrid approach — all tools + tool_choice hint

**Approach:** Pass all tools but set `tool_choice: "auto"` explicitly, and add a stronger system prompt instruction. Keep the server guard as safety net.

**Pros:**
- AI can still send a warm acknowledgment message before calling tool
- Minimal code change

**Cons:**
- Still relies on prompt compliance
- Does not guarantee demographics collection

**Effort:** 1-2 hours

**Risk:** Medium (prompt compliance varies)

---

### Option 2: Server-side state machine enforcement

**Approach:** Add a conversation state machine that tracks phases: `needs_demographics` → `needs_differentials` → `completed`. Only expose tools appropriate for the current phase. When `needs_demographics`, pass all tools but validate server-side that the AI called `collect_demographics` (not just checked profile existence).

**Pros:**
- Deterministic — demographics are guaranteed before differentials
- AI can still produce natural text alongside tool calls

**Cons:**
- More complex state management
- Requires schema/model changes

**Effort:** 6-8 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:61-68` - tool selection logic
- `src/server/services/runStreamOpenAI.ts:66-71` - tool provision logic
- `src/server/services/openai-chat.ts:18-24` - OpenAI API call (no tool_choice)
- `src/server/prompts/CLINICAL_INTERVIEW.ts` - system prompt instructions

**Related components:**
- Tool calling pipeline
- Conversation controller
- Clinical workflow progression

## Resources

- **Commit:** d5e3b9f
- **Related todo:** #049 (silent differential skip — downstream effect)

## Acceptance Criteria

- [ ] Demographics are reliably collected before differential generation
- [ ] AI can still send natural text before tool calls
- [ ] Server-side enforcement prevents premature differentials
- [ ] Tests pass
- [ ] Code reviewed and approved

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified non-deterministic demographics collection path
- Traced tool_choice behavior in OpenAI API
- Documented two solution approaches

**Learnings:**
- Removing forced tool calling in favor of prompt compliance trades UX quality for reliability
- Healthcare workflows may need server-side state machines for critical path enforcement
