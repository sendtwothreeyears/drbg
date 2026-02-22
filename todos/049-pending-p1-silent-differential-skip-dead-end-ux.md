---
status: pending
priority: p1
issue_id: "049"
tags: [clinical-safety, ux, data-integrity, streaming]
dependencies: ["050"]
---

# Silent skip of generate_differentials creates dead-end conversation state

## Problem Statement

When the AI calls `generate_differentials` without a patient profile (demographics), the new server-side guard silently discards the entire differential/assessment pipeline. The user sees the AI's response text (which likely references differentials) but no diagnoses or assessment ever appear. The conversation enters an ambiguous broken state with no error feedback.

## Findings

- `src/server/services/runStreamOpenAI.ts:228-231` — profile guard silently skips all differential processing
- The AI's response text (already streamed and persisted) may reference differentials that were discarded
- `meta.diagnoses`, `meta.assessment`, `meta.assessmentTranslated` all remain unset
- The conversation is NOT marked as completed, so on the next message the controller forces `generate_differentials` again
- The AI's conversation history now contains a tool call that was silently ignored, creating a disconnect between AI context and DB state
- No error event is sent to the client — `onDone(meta)` fires with an empty meta object

## Proposed Solutions

### Option 1: Send error event to client when guard triggers

**Approach:** When the profile guard fires, send an SSE error event (e.g., `event: error` with a user-friendly message) so the frontend can display a retry prompt or re-trigger demographics collection.

**Pros:**
- User knows something went wrong
- Frontend can take corrective action

**Cons:**
- Requires client-side handling of a new error type

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Re-queue demographics collection when guard triggers

**Approach:** When the guard fires, instead of just logging a warning, inject a follow-up that forces `collect_demographics` on the next turn. Could be as simple as setting a flag that the controller reads.

**Pros:**
- Self-healing — the conversation recovers automatically
- Better UX than an error message

**Cons:**
- More complex state management
- AI context still has the orphaned tool call

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:228-231` - silent guard
- `src/server/controllers/conversation.ts:61-68` - controller flow that re-forces tool
- `src/client/components/Conversation/index.tsx:88-96` - client onDone handler

**Related components:**
- OpenAI streaming pipeline (tool call processing)
- SSE event system (client-server communication)
- Conversation state machine (completed/active status)

## Resources

- **Commit:** d5e3b9f
- **Related todo:** #050 (non-deterministic demographics — root cause)

## Acceptance Criteria

- [ ] When AI calls generate_differentials without profile, user receives feedback
- [ ] Conversation does not enter a dead-end state
- [ ] Subsequent messages can recover the conversation flow
- [ ] Tests pass
- [ ] Code reviewed and approved

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified silent discard pattern in runStreamOpenAI.ts
- Traced downstream effects on conversation state and client UX
- Documented two solution approaches

**Learnings:**
- Server-side guards that silently drop tool results need client notification
- The conversation state machine has no explicit "needs demographics" state
