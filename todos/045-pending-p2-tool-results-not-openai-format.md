---
status: pending
priority: p2
issue_id: "045"
tags: [reliability, backend, openai, data-integrity]
dependencies: []
---

# Tool result messages not sent in OpenAI function calling format

## Problem Statement

When demographics are submitted, the tool result is stored as a user message with content `JSON.stringify([{type: "tool_result", tool_use_id: ..., content: ...}])` (Anthropic format). In `runStreamOpenAI.ts`, all messages are mapped to simple `{role, content}` — so OpenAI sees a user message containing raw JSON text instead of a proper function call result. OpenAI interprets it by reading the JSON text, but this does not follow the function calling protocol and may cause unexpected behavior as models change.

## Findings

- `src/server/controllers/conversation.ts:177-184` — tool result stored as Anthropic-format JSON
- `src/server/services/runStreamOpenAI.ts:53-61` — maps all messages to `{role, content}`, no special handling for tool results
- OpenAI expects `role: "tool"` with `tool_call_id` for function results
- Currently works because GPT reads the JSON, but fragile

## Proposed Solutions

### Option 1: Map tool result messages to OpenAI format during history construction

**Approach:** Detect tool result messages (by parsing content) and map them to OpenAI's `role: "tool"` format with proper `tool_call_id`.

**Effort:** 2-3 hours

**Risk:** Medium (needs testing with OpenAI API)

## Acceptance Criteria

- [ ] Tool result messages sent in correct OpenAI function calling format
- [ ] Conversation history is correctly reconstructed
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review agent)
