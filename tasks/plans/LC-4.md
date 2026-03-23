# LC-4: Deduplicate SDK Client Instances

**Impact:** Saves ~20-40MB from redundant HTTP connection pools.
**Effort:** Low
**Risk:** Low.

## Changes
- Create `src/server/services/clients.ts` exporting single `Anthropic` and `OpenAI` instances
- Update all files that create their own clients

## Done When
- [ ] Single shared Anthropic client
- [ ] Single shared OpenAI client
- [ ] All service files import from clients.ts
