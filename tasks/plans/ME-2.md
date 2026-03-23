# ME-2: Add Embedding Cache

**Impact:** Eliminates 200-500ms per cache hit on repeated conditions.
**Effort:** Low-Medium
**Risk:** Low. Embeddings are deterministic for same model+input.

## Changes
- `searchGuidelines.ts`: Add in-memory `Map<string, number[]>` cache for `embedQuery` results
- ~12KB per entry, 1000 entries = ~12MB
- No TTL needed (deterministic)

## Done When
- [ ] Embedding results cached in memory
- [ ] Cache hit skips API call
- [ ] Cache doesn't grow unbounded (LRU or max size)
