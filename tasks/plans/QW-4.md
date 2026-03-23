# QW-4: Add Timeouts to All External API Calls

**Impact:** Prevents indefinite request hangs. Critical for reliability.
**Effort:** Low
**Risk:** Low. Timeouts are safety nets.

## Problem
No timeouts configured on any external call. Any API hang causes an indefinite request hang.

## Changes

| File | Call | Timeout |
|------|------|---------|
| `generateAssessment.ts` | Claude Sonnet | 60s |
| `anthropic.ts` | Haiku extraction | 30s |
| `translate.ts` | OpenAI translation | 15s |
| `searchGuidelines.ts` | OpenAI embedding | 10s |
| `openai-chat.ts` | GPT-5.2 streaming | 120s |
| SSE route | Master connection timeout | 120s |

## Done When
- [ ] All API calls have explicit timeouts
- [ ] SSE connection has a master timeout
- [ ] Timeout errors are caught and returned to client gracefully
