# Consensus Report: Assessment Generation Performance

**Date:** 2026-03-23
**Synthesized from:** 4 domain expert reports (GCP Infrastructure, Node.js Performance, PostgreSQL/pgvector, API Orchestration)

---

## 1. Executive Summary

The e2-micro is undersized but it is **not the main cause** of assessment generation slowness. The primary bottleneck is the sequential chaining of external LLM API calls (Claude Sonnet assessment at 5-8s, embedding calls, Haiku extraction at 1-2s) which together account for roughly 95% of total latency. However, the e2-micro **compounds** the problem through a critical missing pgvector index (forcing full sequential scans of ~106,500 rows on a machine that cannot cache the 775MB table in RAM), memory pressure from Puppeteer/Chromium PDF generation risking OOM kills, and 0.25 vCPU baseline throttling pgvector cosine distance calculations when burst credits are depleted. On a properly indexed and optimized codebase, the e2-micro could handle low-traffic single-user workloads acceptably; without those fixes, even a larger instance would still be slow due to the missing index and sequential API orchestration.

---

## 2. Consensus Summary

All four experts agree on the following:

1. **The assessment pipeline is too sequential.** Steps that are independent (finding extraction, embedding calls within `searchGuidelines`) run one after another instead of in parallel. Every expert flagged this.

2. **The Claude Sonnet assessment call is the single largest latency contributor** at 5-8 seconds, and it should stream to the client to reduce perceived wait time from ~8s to ~1.2s (time to first token).

3. **`extractFindings` (Haiku) is independent of the assessment pipeline** and should run concurrently -- either alongside the assessment steps or during the GPT-5.2 stream itself.

4. **The embedding calls within `searchGuidelines` should be parallelized.** Currently two sequential `embedQuery` calls run per diagnosis; they are independent and should use `Promise.all`.

5. **Node.js needs `--max-old-space-size` configured** to prevent V8 from attempting to use more memory than the VM has.

6. **`pg.Pool` connections should be explicitly limited** to 5, and PM2 should have `max_memory_restart` set.

7. **Timeouts are missing everywhere** -- no timeout on Claude calls, OpenAI calls, embedding calls, SSE connections, or database queries. Any of these can hang indefinitely.

8. **Nginx needs `proxy_read_timeout`** extended beyond the 60s default for long SSE streams.

9. **An embedding cache and guideline result cache** would eliminate redundant API calls for common conditions.

10. **The current model selections are appropriate** -- Claude Sonnet 4.5 for assessment quality, Haiku 4.5 for extraction speed, text-embedding-3-small for embeddings, GPT-4o-mini for translation.

---

## 3. Disagreements & Resolution

### 3a. Primary Bottleneck: Infrastructure vs. API Latency vs. Missing Index

| Expert | Position |
|--------|----------|
| **Expert 1 (GCP)** | Memory pressure is the primary issue. Puppeteer OOM risk and 0.25 vCPU make the instance fundamentally too small. |
| **Expert 2 (Node.js)** | ~95% of latency is external API calls. Server-side compute is ~50-180ms total. The e2-micro's CPU is not the bottleneck. |
| **Expert 3 (pgvector)** | The missing vector index is the single largest performance bottleneck. Every search does a full scan of ~106,500 rows across ~650MB of vector data. |
| **Expert 4 (API)** | Claude Sonnet's 5-8s non-streaming call dominates. Parallelization and streaming are the highest-impact fixes. |

**Resolution:** All four are correct about different aspects. The root causes stack:

- **For single-request latency:** Expert 4 is right -- API calls dominate at 95%. But Expert 3 identified that the "~10-50ms pgvector query" estimate from Experts 2 and 4 assumes an index exists. Without the index, each pgvector search is 200-2000ms (not 10-50ms), adding 0.4-4s to the pipeline. Expert 2's latency budget understates the DB component because it assumed indexed queries.
- **For reliability and concurrency:** Expert 1 is right -- the e2-micro's 1GB RAM cannot hold the 775MB guideline_chunks table, Puppeteer, Node.js, and PostgreSQL simultaneously. OOM kills and swap thrashing are real risks.
- **For perceived latency:** Expert 4 is right -- streaming the Sonnet assessment is the single biggest UX improvement regardless of infrastructure.

**Final call:** The root causes in priority order are: (1) missing pgvector index, (2) sequential API orchestration, (3) non-streaming assessment, (4) memory constraints of e2-micro. Fix #1-3 first (all free code changes), then evaluate whether the e2-micro is still a problem.

### 3b. Node.js `--max-old-space-size` Value

| Expert | Recommended Value |
|--------|-------------------|
| Expert 1 | 384 MB |
| Expert 2 | 512 MB |

**Resolution:** Use **384 MB** on the e2-micro (1GB RAM), **512 MB** on the e2-small (2GB RAM). Expert 1's lower number accounts for the tighter memory budget on the current instance. If upgrading to e2-small, Expert 2's value is appropriate.

### 3c. `shared_buffers` Setting

| Expert | Recommended Value |
|--------|-------------------|
| Expert 1 | 128 MB (for e2-micro), 512 MB (for e2-small) |
| Expert 3 | 256 MB (for e2-micro) |

**Resolution:** Use **128 MB** on e2-micro. Expert 3's 256MB leaves too little for Node.js + Puppeteer + OS on a 1GB machine. On an e2-small, use 512MB per Expert 1.

### 3d. Whether to Replace Puppeteer

| Expert | Position |
|--------|----------|
| Expert 1 | Replace Puppeteer with pdfkit/@react-pdf/renderer. This is the single highest-impact optimization for memory. |
| Experts 2-4 | Did not address Puppeteer. |

**Resolution:** Expert 1 is right that Puppeteer is a major memory concern (200-400MB per PDF generation). However, PDF generation is not on the assessment generation hot path -- it happens on a separate user action. Replacing Puppeteer improves overall VM stability and reduces OOM risk, but it will not directly speed up assessment generation. **Prioritize it as a medium-term stability fix, not an assessment latency fix.**

### 3e. pgvector Query Latency Estimates

| Expert | Estimate per query |
|--------|-------------------|
| Expert 2 | 10-50ms |
| Expert 4 | 10-50ms |
| Expert 3 | 200-2000ms (without index on e2-micro) |

**Resolution:** Experts 2 and 4 assumed an index exists. Expert 3 correctly identified that no index exists, making the actual query time orders of magnitude higher. **Expert 3's estimate is correct for the current state.** With the IVFFlat index, Experts 2 and 4's estimates would become accurate (10-50ms).

---

## 4. Root Cause Breakdown

Rank-ordered by estimated latency contribution to a typical English assessment request (4 diagnoses):

| Rank | Root Cause | Estimated Latency Contribution | Category |
|------|-----------|-------------------------------|----------|
| 1 | **Claude Sonnet 4.5 non-streaming assessment** | 5-8s (perceived, not actual wall-clock savings) | API orchestration |
| 2 | **Missing pgvector IVFFlat index** | 0.4-4s added (2 full scans per diagnosis, ~106K rows each, on constrained RAM) | Database |
| 3 | **Sequential Haiku extraction after assessment** | 1-2s on critical path | API orchestration |
| 4 | **Sequential embedding calls within searchGuidelines** | 0.15-0.3s per differential (one wasted round-trip) | API orchestration |
| 5 | **No embedding/result caching** | 0.2-1.1s per cache-miss on repeated conditions | Application logic |
| 6 | **CPU starvation (0.25 vCPU) on pgvector queries** | 0.1-0.5s added when burst credits depleted | Infrastructure |
| 7 | **Memory pressure causing swap/OOM** | 0-30s (intermittent, catastrophic when triggered) | Infrastructure |

**Total current assessment tail (post-stream): ~7-15s**
**Total with all optimizations applied: ~5-8s actual, ~1.2s perceived (streaming)**

---

## 5. Recommended Action Plan

### Quick Wins (Code Changes, Free)

**QW-1. Create IVFFlat index on guideline_chunks** -- **Highest impact single fix**

- File: `src/server/db/schema/schema.sql`
- Add after the `CREATE TABLE guideline_chunks` block:
```sql
CREATE INDEX IF NOT EXISTS idx_guideline_chunks_embedding
ON guideline_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 326);
```
- Also add to `sync-embeddings.sh` after `pg_restore`:
```sql
SET maintenance_work_mem = '128MB';
DROP INDEX IF EXISTS idx_guideline_chunks_embedding;
CREATE INDEX idx_guideline_chunks_embedding
ON guideline_chunks USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 326);
```
- Set probes in `src/server/db/index.ts` via `pool.on('connect', (client) => { client.query('SET ivfflat.probes = 10'); });`
- **Impact:** pgvector queries drop from 200-2000ms to 10-50ms each. Total pipeline saves 0.4-4s.

**QW-2. Parallelize extractFindings with assessment pipeline**

- File: `src/server/services/runStreamOpenAI.ts`, lines 259-281
- Move `extractFindings` to fire concurrently with the GPT-5.2 stream (before the assessment pipeline), or at minimum use `Promise.all` to run it alongside `generateAssessment`.
- Expert 4's recommendation to fire it during Step 1 (GPT-5.2 streaming) is the most aggressive and correct approach -- it hides the entire 1-2s Haiku call behind the already-running stream.
- **Impact:** Saves 1-2s from the critical path.

**QW-3. Parallelize embedding calls within searchGuidelines**

- File: `src/server/services/searchGuidelines.ts`, lines 22-33
- Replace sequential `embedQuery` calls with `Promise.all`:
```typescript
const [conditionEmbedding, findingsEmbedding] = await Promise.all([
  embedQuery(condition),
  embedQuery(findingsQuery),
]);
const [conditionChunks, findingsChunks] = await Promise.all([
  searchGuidelineChunksQuery(conditionEmbedding, limit),
  searchGuidelineChunksQuery(findingsEmbedding, limit),
]);
```
- **Impact:** Saves 150-300ms per differential.

**QW-4. Add timeouts to all external API calls**

- `src/server/services/generateAssessment.ts` (line 46): Add `{ timeout: 60_000 }` to `client.messages.create()`
- `src/server/services/anthropic.ts` (line 29): Add `{ timeout: 30_000 }` to Haiku call
- `src/server/services/translate.ts` (line 46): Add `{ timeout: 15_000 }` to OpenAI call
- `src/server/services/searchGuidelines.ts` (line 8): Add `{ timeout: 10_000 }` to embedding call
- `src/server/routes/conversation.ts` (`initiateStream`): Add a master 120s SSE timeout
- **Impact:** Prevents indefinite request hangs. No latency improvement, but critical for reliability.

**QW-5. Set Node.js memory limit and PM2 restart policy**

- File: `ecosystem.config.cjs`
- Add `--max-old-space-size=384` to `interpreter_args` (or 512 if on e2-small)
- Add `max_memory_restart: "450M"`
- **Impact:** Prevents OOM kills.

**QW-6. Reduce pg.Pool connections and add pool config**

- File: `src/server/db/index.ts`
- Set `max: 5`, `idleTimeoutMillis: 30000`, `connectionTimeoutMillis: 5000`
- **Impact:** Frees ~25-50MB RAM from idle connections.

### Medium Effort (Config Changes, Small Cost)

**ME-1. Stream Claude Sonnet assessment to client** -- **Highest perceived latency improvement**

- File: `src/server/services/generateAssessment.ts`
- Switch from `client.messages.create()` to `client.messages.stream()`
- Add `onAssessmentText` callback to forward chunks via SSE
- Requires client-side changes to render streaming assessment text
- **Impact:** Perceived wait drops from 5-8s to ~1.2s (time to first token). Total wall-clock time unchanged.

**ME-2. Add embedding cache**

- File: `src/server/services/searchGuidelines.ts`
- Add in-memory `Map<string, number[]>` cache for `embedQuery` results
- ~12KB per cached entry, 1000 entries = ~12MB
- **Impact:** Eliminates 200-500ms per cache hit on repeated conditions.

**ME-3. Add guideline result cache**

- File: `src/server/services/searchGuidelines.ts`
- Cache full search results with a 30-minute TTL keyed on condition + findings hash
- **Impact:** Eliminates 500-1100ms for repeated condition+findings combinations.

**ME-4. PostgreSQL tuning**

- For e2-micro: `shared_buffers=128MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `max_connections=20`
- For e2-small: `shared_buffers=512MB`, `effective_cache_size=1.5GB`, `work_mem=16MB`, `max_connections=20`
- **Impact:** Better cache hit ratio, fewer disk reads for pgvector queries.

**ME-5. Nginx configuration hardening**

- File: `nginx.conf`
- Add `proxy_read_timeout 300s` for SSE endpoints
- Add `keepalive 8` to upstream block
- Add `gzip on` for JSON/CSS/JS responses
- **Impact:** Prevents Nginx from killing long SSE connections; minor latency improvement from keepalive.

**ME-6. Batch embedding calls**

- Refactor `searchGuidelines` to accept all diagnoses and make a single `openai.embeddings.create({ input: [...allInputs] })` call
- **Impact:** Saves 200-300ms by eliminating redundant HTTP round-trips.

### Larger Changes (Infrastructure, Higher Cost)

**LC-1. Upgrade to e2-small ($12.23/month, +$6.12 from free tier)**

- Doubles RAM to 2GB, doubles CPU baseline to 0.50 vCPU
- Allows PostgreSQL to use 512MB shared_buffers (enough to cache the IVFFlat index)
- Gives headroom for Puppeteer PDF generation without OOM
- **Impact:** Eliminates memory pressure, faster pgvector queries from better caching.

**LC-2. Switch to SSD persistent disk (+$0.60-1.30/month)**

- Replace pd-standard with pd-balanced or pd-ssd
- **Impact:** Dramatically improves IOPS for any disk-bound pgvector operations and swap performance.

**LC-3. Replace Puppeteer with native PDF library**

- Replace `src/server/services/generatePDF.ts` to use `pdfkit` or `@react-pdf/renderer`
- Eliminates 200-400MB peak RAM from headless Chromium
- **Impact:** Major stability improvement; does not directly affect assessment latency.

**LC-4. Deduplicate SDK client instances**

- Create `src/server/services/clients.ts` exporting single `Anthropic` and `OpenAI` instances
- Update all files: `anthropic.ts`, `generateAssessment.ts`, `translate.ts`, `searchGuidelines.ts`, `openai-chat.ts`
- **Impact:** Saves ~20-40MB from redundant HTTP connection pools.

**LC-5. Pre-compile TypeScript for production**

- Replace tsx runtime with esbuild/tsc build step
- Update `ecosystem.config.cjs` to run `dist/server/main.js` with plain `node`
- **Impact:** Saves ~30-50MB memory, faster cold start.

**LC-6. Reduce embedding dimensions to 512 (requires re-embedding)**

- Change `embedQuery` to pass `dimensions: 512`
- Update schema: `embedding vector(512)`
- Re-embed all ~106,500 guideline chunks
- **Impact:** 67% reduction in vector storage (775MB -> ~300MB), proportionally smaller index, faster queries. Minimal recall loss (~2-3%).

---

## 6. Infrastructure Recommendation

### Verdict: Start with Code Fixes, Then Upgrade to e2-small

The code-level fixes (QW-1 through QW-6, ME-1 through ME-3) should be applied **first**. They are free, address the actual root causes, and may make the e2-micro viable for single-user, low-traffic use.

After applying code fixes, the remaining infrastructure constraint is memory. The 775MB guideline_chunks table exceeds the e2-micro's total RAM, and even with an IVFFlat index (~250-375MB), the index plus PostgreSQL buffers plus Node.js plus OS will be tight on 1GB.

**Recommended path:**

| Timeline | Action | Monthly Cost |
|----------|--------|-------------|
| **Now** | Apply QW-1 through QW-6 on e2-micro | $0 (free tier) |
| **Week 1-2** | Apply ME-1 through ME-6 | $0 (free tier) |
| **After validation** | Upgrade to e2-small + pd-balanced | ~$13/month |
| **If needed (5+ concurrent users)** | Upgrade to e2-medium | ~$25/month |
| **If needed (10+ concurrent users)** | Separate DB to Cloud SQL | ~$42-62/month total |

### Cost Comparison

| Configuration | Monthly Cost | Assessment Tail Latency (perceived) |
|--------------|-------------|--------------------------------------|
| e2-micro, no changes | $0 | 7-15s spinner |
| e2-micro + all code fixes | $0 | ~1.2s to first text, then streaming |
| e2-small + all code fixes + pd-balanced | ~$13 | ~1.2s to first text, more reliable |
| e2-medium + all code fixes + pd-balanced | ~$25 | ~1.2s to first text, handles concurrency |

The jump from "no changes" to "all code fixes on e2-micro" is far larger than the jump from "e2-micro" to "e2-small" with the same code. **Optimize the code first.**

---

## 7. Risk Factors

| Recommendation | Risk | Mitigation |
|---------------|------|------------|
| **IVFFlat index** | Index build on e2-micro may take 5-15 minutes and consume significant memory. Could OOM during build. | Set `maintenance_work_mem = '128MB'`. Build during low-traffic window. If OOM, build on a local machine and `pg_dump`/`pg_restore` the indexed table. |
| **IVFFlat index** | Recall may drop vs. full sequential scan (~92-96% at probes=10 vs 100%). Some relevant guideline chunks may be missed. | Set `probes = 10` (not default 1). For clinical use, monitor whether assessment quality degrades. Can increase probes to 20-40 if needed, trading latency for recall. |
| **Parallelizing extractFindings** | If a future code change makes `extractFindings` output a dependency of the assessment pipeline, parallelization would introduce a race condition. | Document the data independence assumption. Add a comment in the code explaining why parallel execution is safe. |
| **Streaming Sonnet assessment** | More complex error handling -- if the stream fails mid-way, the client has partial text. Current non-streaming approach is atomic (all or nothing). | Accumulate full text server-side. Only persist to DB after stream completes. Send a final "assessment_complete" SSE event so the client knows when to stop rendering. |
| **Embedding/result caching** | Stale cache entries if guideline data is updated. Medical guidelines change infrequently but correctness is critical. | Use a conservative TTL (30 min for results, no expiry needed for embeddings since the model is deterministic). Invalidate caches when `sync-embeddings.sh` runs. |
| **Raising similarity threshold** | May exclude marginally relevant guideline chunks that contain important clinical nuance. | Start at 0.55 (conservative bump from 0.50) rather than jumping to 0.60. Monitor assessment quality before going higher. |
| **e2-micro staying on free tier** | All optimizations may still not prevent OOM during concurrent PDF generation + assessment generation. | Add a 2GB swap file as an immediate safety net. Replace Puppeteer medium-term. Upgrade to e2-small if OOM events persist. |
| **Replacing Puppeteer** | PDF layout/styling may differ from current Chromium-rendered output. Clinical PDFs must be accurate and professional. | Build the pdfkit/react-pdf replacement to match existing output. Test thoroughly with clinicians before deploying. |
| **Reducing dimensions to 512** | Requires re-embedding all 106,500 chunks. If the embedding API is temporarily unavailable or the process fails partway through, the database could be left in an inconsistent state. | Run re-embedding as a batch job with checkpointing. Keep the old 1536-dimension column until the new 512-dimension column is fully populated and validated. |
| **Pre-compiling TypeScript** | Adds a build step to the deployment pipeline. Source maps may not work correctly, making production debugging harder. | Use esbuild with `--sourcemap` flag. Test the compiled output locally before deploying. |

---

## Appendix: Expected Timeline of Improvements

Applying fixes cumulatively:

| After Applying | Perceived Assessment Wait | Actual Wall-Clock (post-stream) | Reliability |
|---------------|--------------------------|--------------------------------|-------------|
| Nothing (current) | 7-15s spinner | 7-15s | OOM risk, no timeouts |
| QW-1 (pgvector index) | 6-12s spinner | 6-12s | Same |
| + QW-2, QW-3 (parallelization) | 5-10s spinner | 5-10s | Same |
| + QW-4, QW-5, QW-6 (timeouts, memory) | 5-10s spinner | 5-10s | Much improved |
| + ME-1 (streaming assessment) | **~1.2s to first text** | 5-10s | Much improved |
| + ME-2, ME-3 (caching) | **~1.2s to first text** | 4-8s (cache hits) | Much improved |
| + LC-1 (e2-small) | **~1.2s to first text** | 4-8s | Excellent |
