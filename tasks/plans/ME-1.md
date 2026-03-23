# ME-1: Stream Claude Sonnet Assessment to Client

**Impact:** Perceived wait drops from 5-8s to ~1.2s (time to first token).
**Effort:** Medium (server + client changes)
**Risk:** Medium. Partial text on stream failure; need accumulation + completion event.

## Changes

### Server
- `generateAssessment.ts`: Switch from `client.messages.create()` to `client.messages.stream()`
- Accept a callback `onChunk(text: string)` to forward partial text via SSE
- Accumulate full text server-side; only persist to DB after stream completes

### Client
- Handle new `assessmentText` SSE event type
- Render streaming assessment text progressively
- Show `assessment_complete` event to finalize

## Done When
- [ ] Assessment streams to client via SSE
- [ ] Client renders partial assessment as it arrives
- [ ] Full assessment persisted to DB after stream completes
- [ ] Error during stream handled gracefully (client shows error, server doesn't persist partial)
