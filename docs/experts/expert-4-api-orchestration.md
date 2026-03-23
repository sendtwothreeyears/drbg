# Expert 4: API Orchestration & Latency Analysis

## Role
AI/LLM API orchestration expert specializing in optimizing multi-model inference pipelines for latency.

## Pipeline Architecture (Current State)

The assessment pipeline in `runStreamOpenAI.ts` executes the following steps **sequentially**:

```
[Step 1] GPT-5.2 streaming chat (differential diagnoses via tool call)
    |
    v
[Step 2] Per diagnosis (3-5x): 2x embedding calls + 2x pgvector searches (Promise.all)
    |
    v
[Step 3] Claude Sonnet 4.5 assessment generation (non-streaming, full response)
    |
    v
[Step 4] Claude Haiku 4.5 clinical finding extraction (sequential)
    |
    v
[Step 5] (conditional) GPT-4o-mini translation
```

**Key observation:** Steps 2-3-4 are the "assessment tail" -- they all execute *after* the GPT-5.2 stream completes and *before* `onDone()` fires. The client sees a loading state during this entire window.

---

## Q1: Estimated Latency Breakdown Per Step

| Step | Operation | Model / Service | Estimated Latency | Notes |
|------|-----------|----------------|-------------------|-------|
| 1 | Streaming chat + tool call | GPT-5.2 | **3-8s total** (TTFT ~0.6-1.0s, streaming ~20ms/token) | User sees tokens immediately; total wall time depends on output length. Tool call arguments stream incrementally. |
| 2 | Embedding (per diagnosis) | text-embedding-3-small | **~200-500ms per call** (p90) | 2 calls per diagnosis, but all diagnoses run in Promise.all |
| 2 | pgvector search (per diagnosis) | PostgreSQL pgvector | **~10-50ms per query** | Sub-100ms at 99% recall for typical dataset sizes |
| 3 | Assessment generation | Claude Sonnet 4.5 | **3-8s** (TTFT ~1.15s, output ~63 tok/s, ~2048 max tokens) | Non-streaming. Client waits for full response. This is the single largest blocking call. |
| 4 | Finding extraction | Claude Haiku 4.5 | **1-2s** (TTFT ~0.68s, output ~106 tok/s) | Tool-use forced response, typically short output. |
| 5 | Translation | GPT-4o-mini | **1-3s** | Only for non-English. TTFT ~2s, short output. |

### Step 2 Deep Dive: Embedding + Search Per Diagnosis

For a typical 4-diagnosis case:
- 4 diagnoses x 2 embedding calls = 8 embedding calls total
- But `Promise.all` parallelizes across diagnoses, so the 2 calls *within* each diagnosis run sequentially
- **Within each `searchGuidelines` call:** `embedQuery(condition)` then `searchGuidelineChunksQuery`, then `embedQuery(findingsQuery)` then `searchGuidelineChunksQuery` -- these are **sequential** (not parallelized within a single diagnosis)
- Net wall time: ~2 sequential embedding calls (~400-1000ms) + 2 pgvector queries (~20-100ms) = **~500-1100ms**
- Since all diagnoses run in parallel via `Promise.all`, the total is the max of any single diagnosis, not the sum

---

## Q2: Biggest Latency Contributors

**Ranked by wall-clock contribution to the post-stream "assessment tail":**

1. **Claude Sonnet 4.5 assessment (Step 3): 3-8s** -- The single largest contributor. Non-streaming, so the client sees nothing until the entire ~1000-2000 token response is generated. At 63 tok/s, a 1500-token assessment takes ~24s of generation time after a 1.15s TTFT. *Correction: this means a realistic assessment could take 5-8s total, not 3-8s.*

2. **Embedding calls (Step 2): 0.5-1.1s** -- Moderate but compounding. Each `searchGuidelines` call makes 2 sequential embedding API round-trips.

3. **Haiku extraction (Step 4): 1-2s** -- Small but adds up since it runs *after* the assessment.

4. **Translation (Step 5): 1-3s** -- Conditional, only for non-English users. Also runs sequentially at the end.

**Total estimated "assessment tail" latency (English): ~5-11s**
**Total estimated "assessment tail" latency (non-English): ~7-14s**

---

## Q3: Can Step 4 (Finding Extraction) Run in Parallel with Step 3 (Assessment)?

**Yes, absolutely. This is the highest-impact quick win.**

Looking at the code in `runStreamOpenAI.ts` (lines 259-281):

```typescript
// Current: sequential
const findings = await getFindingsByConversationQuery(conversationId);
const guidelineResults = await Promise.all(
  differentials.map((d) => searchGuidelines(d.condition, findings)),
);
const { text, sources } = await generateAssessment(findings, differentials, guidelineResults);
await updateAssessmentMutation(conversationId, text, sources);

// ... then later (line 278-281):
const lastUserMsg = dbMessages.findLast((m: Message) => m.role === "user");
if (lastUserMsg) {
  await extractFindings(conversationId, lastUserMsg.content);
}
```

**Critical insight:** `extractFindings` (Step 4) operates on the *current user message* and existing findings. It does NOT depend on the assessment output. It writes new findings to the database for future turns.

However, there is a **data dependency to consider**: `searchGuidelines` (Step 2) reads findings via `getFindingsByConversationQuery`. If `extractFindings` from the *current* turn hasn't run yet, Step 2 uses findings from *previous* turns only.

**Current behavior:** Step 4 runs AFTER Steps 2-3, so findings from the current user message are NOT used in the current assessment's guideline search anyway. This means moving Step 4 to run in parallel with Steps 2-3 changes nothing about data correctness -- the current assessment already doesn't use the current turn's findings.

**Recommended change:**
```typescript
// Optimized: parallel
const [assessmentResult, _extractionResult] = await Promise.all([
  (async () => {
    const findings = await getFindingsByConversationQuery(conversationId);
    const guidelineResults = await Promise.all(
      differentials.map((d) => searchGuidelines(d.condition, findings)),
    );
    const result = await generateAssessment(findings, differentials, guidelineResults);
    await updateAssessmentMutation(conversationId, result.text, result.sources);
    return result;
  })(),
  (async () => {
    const lastUserMsg = dbMessages.findLast((m) => m.role === "user");
    if (lastUserMsg) await extractFindings(conversationId, lastUserMsg.content);
  })(),
]);
```

**Estimated savings: 1-2s** (the full Haiku extraction time is removed from the critical path).

---

## Q4: Should Step 3 Use Streaming for Partial Assessment Results?

**Yes, strongly recommended.** This is the second highest-impact optimization.

Currently, `generateAssessment` uses `client.messages.create()` (non-streaming). The client sees a loading spinner for the entire 5-8s generation time. Switching to streaming would:

1. **Reduce perceived latency by 4-7s** -- The client starts receiving assessment text after ~1.15s TTFT instead of waiting 5-8s for the full response.
2. **Improve UX dramatically** -- Users read at ~250 words/minute. By the time the full assessment is generated, they've already absorbed the first paragraphs.

**Implementation approach:**
- Change `generateAssessment` to use `client.messages.stream()` instead of `client.messages.create()`
- Pass a callback (e.g., `onAssessmentText`) to forward chunks to the client via SSE
- Accumulate the full text for database persistence after stream completes
- Source extraction still happens after completion (it depends on `guidelineResults`, not the assessment text)

**Trade-off:** Minor increase in code complexity. The `onAssessmentLoading()` callback already exists, suggesting the client-side infrastructure for progressive updates may be partially in place.

---

## Q5: Faster Model Alternatives

### Assessment (Step 3): Claude Sonnet 4.5 -> alternatives

| Alternative | Quality Impact | Speed Impact | Recommendation |
|------------|---------------|-------------|----------------|
| Claude Haiku 4.5 | Moderate quality drop for clinical reasoning | ~3-4x faster (TTFT 0.68s, 106 tok/s) | **Not recommended.** Clinical assessment requires frontier-level reasoning. Quality is paramount here. |
| GPT-5.2 | Comparable quality | Similar latency (~1s TTFT, ~50 tok/s) | Neutral. Would consolidate to a single provider but no clear latency win. |
| Claude Sonnet 4.5 with streaming | Same quality | Same total time, but perceived latency drops from ~6s to ~1.2s | **Strongly recommended.** Best of both worlds. |

### Finding Extraction (Step 4): Claude Haiku 4.5

Haiku 4.5 is already the optimal choice here. It is the fastest model with adequate tool-use capability. No change recommended.

### Embedding (Step 2): text-embedding-3-small

| Alternative | Quality Impact | Speed Impact | Recommendation |
|------------|---------------|-------------|----------------|
| text-embedding-3-large | Higher retrieval quality | Slightly slower, higher cost | Consider if retrieval quality is insufficient |
| Cohere embed-v4 | Competitive quality | Lower median latency per benchmarks | Worth testing if OpenAI embedding latency is a bottleneck |
| Local embedding (e.g., all-MiniLM) | Moderate quality drop | ~5-10ms per embedding (no network) | **Worth considering** if deployed on a machine with GPU. Eliminates network round-trips entirely. |

### Translation (Step 5): GPT-4o-mini

Already a good choice for speed/cost. No change needed.

---

## Q6: Would Batching Embedding Calls Reduce Latency?

**Yes. The OpenAI embeddings API accepts an array of inputs in a single request.**

Currently, `searchGuidelines` makes 2 separate embedding API calls per diagnosis:
1. `embedQuery(condition)` -- single string
2. `embedQuery(findingsQuery)` -- single string

For 4 diagnoses, that is 8 separate HTTP round-trips (though parallelized at the diagnosis level).

**Optimization: Batch all embeddings into a single API call.**

```typescript
// Current: 8 separate API calls (4 diagnoses x 2 queries each)
// Optimized: 1 API call with 8 inputs
const allInputs = diagnoses.flatMap(d => [
  d.condition,
  [d.condition, ...findings.map(f => `${f.category}: ${f.value}`)].join(". ")
]);

const res = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: allInputs,  // array of strings in single request
});

// Then distribute embeddings back to their respective pgvector queries
```

**Estimated savings:**
- Current: ~500ms (2 sequential calls, max across parallel diagnoses)
- Optimized: ~200-300ms (1 API call for all inputs, then parallel pgvector queries)
- **Net saving: ~200-300ms**

The saving comes from eliminating redundant TCP/TLS handshakes and HTTP round-trips. The embedding computation itself is fast; it is the network overhead that dominates for short inputs.

---

## Q7: Caching Strategy for Guideline Searches

**Yes, a multi-layer caching strategy would significantly help for common conditions.**

### Layer 1: Embedding Cache (High Impact)

Cache the embedding vector for common condition strings. Many patients will present with the same top conditions (e.g., "Type 2 Diabetes", "Hypertension", "Upper Respiratory Infection").

```typescript
// LRU cache: condition string -> embedding vector
const embeddingCache = new Map<string, number[]>();  // or Redis

const embedQueryCached = async (text: string): Promise<number[]> => {
  const cached = embeddingCache.get(text);
  if (cached) return cached;
  const embedding = await embedQuery(text);
  embeddingCache.set(text, embedding);
  return embedding;
};
```

**Impact:** Eliminates ~200-500ms per cache hit. Condition-only queries (the first embedding per diagnosis) are highly cacheable since GPT-5.2 generates standardized condition names.

### Layer 2: Full Guideline Result Cache (Moderate Impact)

Cache the final guideline chunks for a given condition. Since the guideline corpus changes infrequently (updated when new guidelines are ingested), cached results remain valid for days/weeks.

```typescript
// Cache: condition string -> guideline chunks (with TTL)
const guidelineCache = new Map<string, { chunks: GuidelineChunk[]; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
```

**Impact:** For cache hits, the entire `searchGuidelines` call drops from ~500-1100ms to ~0ms. The findings-augmented search adds patient-specific context, so consider caching only the condition-only results and always running the findings-augmented search fresh.

### Layer 3: Assessment Template Cache (Lower Impact, Higher Risk)

For identical (condition set + confidence levels), consider caching assessment templates. However, this is **not recommended** because:
- Assessments should be personalized to patient findings
- Clinical accuracy could suffer from stale/generic templates
- The risk/reward ratio is poor for a medical application

### Recommended Implementation Priority

1. **Embedding cache** -- Simple, safe, high impact. Use an in-memory LRU (e.g., `lru-cache` npm package) with 1000-entry capacity.
2. **Guideline result cache** -- Moderate complexity, good impact for repeated conditions. Use Redis with a 24h TTL, keyed on normalized condition string.
3. Skip assessment caching.

---

## Q8: Expected Total Pipeline Latency

### Current Pipeline (English, 4 diagnoses)

| Phase | Duration | Running Total | User Sees |
|-------|----------|--------------|-----------|
| GPT-5.2 stream (TTFT) | ~0.6-1.0s | 1.0s | First token appears |
| GPT-5.2 stream (full) | ~3-8s | 8s | Streaming text + tool call |
| Assessment loading signal | ~0ms | 8s | Loading spinner appears |
| DB: fetch findings | ~10-50ms | 8.1s | Loading spinner |
| Embeddings + pgvector (Step 2) | ~0.5-1.1s | 9.2s | Loading spinner |
| Claude Sonnet assessment (Step 3) | ~5-8s | 17s | Loading spinner |
| Update assessment in DB | ~10-50ms | 17.1s | Loading spinner |
| Haiku finding extraction (Step 4) | ~1-2s | 19s | Loading spinner |
| `onDone()` fires | 0ms | **~19s** | Assessment appears |

**Total time from user message to assessment visible: ~15-19s**
**Time spent on loading spinner (post-stream): ~7-11s**

### Current Pipeline (Non-English, add translation steps)

- Add ~1-3s for assistant response translation (after stream, before persistence)
- Add ~1-3s if translation needed for fallback text
- **Total: ~17-25s**

---

## Recommended Optimized Pipeline

### Changes (ordered by impact)

| # | Optimization | Estimated Saving | Complexity |
|---|-------------|-----------------|------------|
| 1 | **Stream Claude Sonnet assessment** to client | **4-7s perceived** (actual time same, but user sees text at 1.2s instead of 8s) | Medium |
| 2 | **Parallelize Haiku extraction with assessment pipeline** | **1-2s actual** | Low |
| 3 | **Batch embedding calls** into single API request | **0.2-0.3s actual** | Low |
| 4 | **Cache embeddings** for common conditions | **0.2-0.5s per cache hit** | Low |
| 5 | **Cache guideline search results** for common conditions | **0.5-1.1s per cache hit** | Medium |
| 6 | **Pre-extract findings** during streaming (overlap Step 4 with Step 1) | **1-2s actual** | Medium |

### Optimization #6 Detail: Pre-extract Findings During Streaming

Currently, `extractFindings` runs after the entire pipeline. But it only needs the last user message, which is available *before* the stream starts. It could run concurrently with Step 1 (GPT-5.2 streaming):

```typescript
// Fire-and-forget extraction while stream runs
const extractionPromise = (async () => {
  const lastUserMsg = dbMessages.findLast((m) => m.role === "user");
  if (lastUserMsg) await extractFindings(conversationId, lastUserMsg.content);
})();

// ... stream processing ...

// Await at the end only if needed
await extractionPromise;
```

This completely hides the Haiku extraction latency behind the GPT-5.2 streaming time, which is always longer.

### Optimized Pipeline Timeline (English, 4 diagnoses, cache miss)

| Phase | Duration | Running Total | User Sees |
|-------|----------|--------------|-----------|
| GPT-5.2 stream (TTFT) | ~0.6-1.0s | 1.0s | First token appears |
| GPT-5.2 stream (full) | ~3-8s | 8s | Streaming text |
| *Haiku extraction runs in background during stream* | (hidden) | -- | -- |
| Assessment loading signal | ~0ms | 8s | Loading spinner |
| Batched embeddings + pgvector | ~0.3-0.6s | 8.6s | Loading spinner |
| Claude Sonnet assessment (streaming TTFT) | ~1.2s | 9.8s | **First assessment text appears** |
| Claude Sonnet assessment (streaming complete) | ~4-7s | 15s | Progressive text rendering |
| DB persistence | ~10-50ms | 15.1s | -- |
| `onDone()` fires | 0ms | **~15s** | Full assessment visible |

### Optimized Pipeline Timeline (Cache Hit on Common Conditions)

| Phase | Duration | Running Total | User Sees |
|-------|----------|--------------|-----------|
| GPT-5.2 stream (full) | ~3-8s | 8s | Streaming text |
| *Haiku extraction hidden during stream* | (hidden) | -- | -- |
| Cached embeddings + pgvector | ~0.05s | 8.1s | Loading spinner |
| Claude Sonnet assessment (streaming TTFT) | ~1.2s | 9.3s | **First assessment text appears** |
| Claude Sonnet assessment (streaming complete) | ~4-7s | 15s | Progressive text rendering |
| `onDone()` fires | 0ms | **~15s** | Full assessment visible |

### Summary of Improvements

| Metric | Current | Optimized | Improvement |
|--------|---------|-----------|-------------|
| **Time to first assessment text** | 15-19s | 9-10s | **~6-9s faster** |
| **Perceived assessment wait (spinner)** | 7-11s | 1.2s (then streaming) | **~6-10s perceived improvement** |
| **Total pipeline wall time** | 15-19s | 13-15s | **~2-4s actual reduction** |
| **Total pipeline (cache hit)** | 15-19s | 13-15s | Same (Sonnet dominates) |

The most impactful optimization is **streaming the Claude Sonnet assessment**. It does not reduce total wall-clock time, but it transforms the user experience from "wait 8+ seconds staring at a spinner" to "see assessment text appearing within 1.2 seconds of the loading state."

---

## Implementation Priority

1. **Immediate (low effort, high impact):** Parallelize Haiku extraction with assessment, or better yet, run it concurrently with GPT-5.2 streaming. This is a ~5-line code change.
2. **Short-term (medium effort, highest perceived impact):** Stream Claude Sonnet assessment to the client. Requires changes to `generateAssessment.ts`, `runStreamOpenAI.ts`, and the SSE event format.
3. **Short-term (low effort, moderate impact):** Batch embedding calls into a single API request. Refactor `searchGuidelines` to accept all conditions at once.
4. **Medium-term (low effort, moderate impact):** Add LRU embedding cache and guideline result cache.
5. **Do not change:** Model selections are already well-chosen for their respective tasks. Claude Sonnet 4.5 for assessment and Claude Haiku 4.5 for extraction are optimal choices.

---

## Sources

- [LLM Latency Benchmark by Use Cases in 2026](https://research.aimultiple.com/llm-latency-benchmark/)
- [GPT-5.2 Benchmarks - LLM Benchmarks](https://llm-benchmarks.com/models/openai/gpt52)
- [Claude 4.5 Sonnet - Intelligence, Performance & Price Analysis](https://artificialanalysis.ai/models/claude-4-5-sonnet)
- [Claude 4.5 Haiku - API Provider Performance Benchmarking](https://artificialanalysis.ai/models/claude-4-5-haiku/providers)
- [Claude 4.5 Haiku - Intelligence, Performance & Price Analysis](https://artificialanalysis.ai/models/claude-4-5-haiku)
- [LLM API Latency Benchmarks 2026: 5 Models Tested](https://www.kunalganglani.com/blog/llm-api-latency-benchmarks-2026)
- [Benchmarking API latency of embedding providers](https://nixiesearch.substack.com/p/benchmarking-api-latency-of-embedding)
- [GPT-4o mini - API Provider Performance Benchmarking](https://artificialanalysis.ai/models/gpt-4o-mini/providers)
- [PostgreSQL Vector Search with pgvector: Complete Guide 2026](https://calmops.com/database/postgresql-vector-search-pgvector-2026/)
- [Postgres Vector Search with pgvector: Benchmarks](https://medium.com/@DataCraft-Innovations/postgres-vector-search-with-pgvector-benchmarks-costs-and-reality-check-f839a4d2b66f)
- [OpenAI Latency Optimization Guide](https://developers.openai.com/api/docs/guides/latency-optimization)
- [Reducing Latency - Claude API Docs](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-latency)
- [OpenAI Embeddings API Reference](https://platform.openai.com/docs/api-reference/embeddings)
- [Azure OpenAI Embedding Latency Discussion](https://learn.microsoft.com/en-us/answers/questions/2153840/azure-openai-embedding-api-takes-1-2-sec-how-to-re)
