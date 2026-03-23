# ME-6: Batch Embedding Calls

**Impact:** Saves 200-300ms by eliminating redundant HTTP round-trips.
**Effort:** Medium (refactor searchGuidelines interface)
**Risk:** Low.

## Changes
- Refactor `searchGuidelines` to accept all diagnoses at once
- Make a single `openai.embeddings.create({ input: [...allInputs] })` call
- Distribute results back to per-diagnosis searches

## Done When
- [ ] Single embedding API call for all diagnoses
- [ ] Results correctly mapped back to individual diagnoses
- [ ] Latency reduced vs per-diagnosis calls
