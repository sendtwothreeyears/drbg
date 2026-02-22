---
status: pending
priority: p2
issue_id: "021"
tags: [data-integrity, backend, translation]
dependencies: []
---

# Bilingual fields lost for tool-call messages

## Problem Statement

When the OpenAI streaming response includes tool calls alongside text, the assistant message is stored as JSON content blocks without bilingual metadata (`original_content`, `original_language`). This means any Twi text in tool-containing messages is not separately preserved. The non-tool branch correctly stores bilingual fields.

## Findings

- `src/server/services/runStreamOpenAI.ts:128-146` — tool-call branch: `createMessageMutation(conversationId, "assistant", JSON.stringify(contentBlocks))` — no `originalContent`/`originalLanguage` passed
- `src/server/services/runStreamOpenAI.ts:153-161` — non-tool branch correctly passes bilingual fields
- The Twi text IS present inside the JSON content blocks (as `fullText`), but it is stored in the `content` field as JSON, not in `original_content`
- English translation is never performed for the tool-call case — the text block in JSON contains Twi, not English
- On reload, `getDisplayText` parses the JSON and extracts the text, which is Twi — correct for display, but the `content` field contains non-English data contrary to the bilingual storage convention

## Proposed Solutions

### Option 1: Apply bilingual storage to tool-call messages

**Approach:** For tool-call messages in non-English conversations, translate the text content to English before storing in JSON, and also pass `originalContent`/`originalLanguage` to `createMessageMutation`.

**Effort:** 1 hour

**Risk:** Low

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:128-146` — tool-call message persistence

## Acceptance Criteria

- [ ] Tool-call messages with text store English in content blocks and Twi in original_content
- [ ] Bilingual convention (content=English, original_content=original language) is consistent across all message types

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by spec-flow-analyzer (G-05) during flow analysis of demographics collection
