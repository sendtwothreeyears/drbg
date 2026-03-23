# LC-6: Reduce Embedding Dimensions to 512

**Impact:** 67% reduction in vector storage (775MB -> ~300MB). Faster queries.
**Effort:** High (requires re-embedding all 106,500 chunks)
**Risk:** Medium. ~2-3% recall loss. Requires full re-embed.

## Changes
- Update `embedQuery` to pass `dimensions: 512`
- Update schema: `embedding vector(512)`
- Re-embed all guideline chunks
- Rebuild IVFFlat index

## Done When
- [ ] Schema uses vector(512)
- [ ] All chunks re-embedded at 512 dimensions
- [ ] IVFFlat index rebuilt
- [ ] Assessment quality verified
