---
status: pending
priority: p2
issue_id: "032"
tags: [clinical, architecture, translation, conversation-state]
dependencies: []
---

# OpenAI context loss on translation failure (clinical concern)

## Problem Statement

When translation fails after streaming, the assistant's response is not persisted to the database. On the next user turn, `runStreamOpenAI` fetches `dbMessages` from the database and builds the OpenAI context from them. Since the failed message was never persisted, OpenAI has no record of what it just said.

In a clinical interview context, this can cause:
1. The model repeating the exact same question, confusing the patient
2. The model losing track of interview progress
3. Inconsistency between what the patient remembers and what the model's context contains

The plan document acknowledges this as a known trade-off ("English-only content is non-negotiable"), and translation failure after a successful stream is rare. However, for a clinical system, conversation coherence matters.

## Findings

- `src/server/services/runStreamOpenAI.ts:47-48` — messages fetched from DB at start of each turn
- `src/server/services/runStreamOpenAI.ts:131-134` — translation failure throws, skips persistence
- The user saw the Twi response streamed in real-time, but the model will not know it made that statement
- Translation failure is rare (OpenAI API is already proven working if streaming succeeded)

## Proposed Solutions

### Option 1: Context recovery hint on next turn (Recommended)

**Approach:** When translation fails, store a temporary note (e.g., in a server-side session or conversation metadata) that the next turn should include a system-level hint: "Note: your previous response could not be saved. The user saw your response. Please continue the interview naturally."

**Pros:**
- Preserves English-only persistence rule
- Recovers conversational coherence

**Cons:**
- Requires a mechanism to pass state between turns (conversation metadata flag)

**Effort:** 2-3 hours

**Risk:** Low

---

### Option 2: Accept the trade-off (Current)

**Approach:** Do nothing. Translation failure is extremely rare. The user resends and OpenAI re-generates from existing history.

**Pros:**
- No additional complexity

**Cons:**
- Clinical interview may lose coherence in the rare failure case

**Effort:** None

**Risk:** Low (rare event)

## Recommended Action

Option 2 for now. Monitor for translation failure frequency. If it occurs more than ~1% of the time, implement Option 1.

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:47-61` — message reconstruction from DB
- `src/server/services/runStreamOpenAI.ts:131-134` — translation failure throw

## Acceptance Criteria

- [ ] Decision documented (accept trade-off or implement recovery)
- [ ] Monitoring for translation failure rate in place

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (Review Agent)

**Actions:**
- Identified via architecture review of commit 98ac954
- Confirmed this is a known, accepted trade-off per brainstorm doc
