# Expert Report 3: PostgreSQL & pgvector Performance Analysis

## Executive Summary

The `guideline_chunks` table has **no vector index** -- every similarity search performs a full sequential scan across ~106,500 rows of 1536-dimension vectors (~650MB of vector data alone). On a 1GB e2-micro VM, this is the single largest performance bottleneck in the system. Each `searchGuidelines` call executes **two** full table scans (condition search + findings search), making this doubly expensive.

---

## 1. Missing Vector Index (Critical)

### Current State

The schema in `src/server/db/schema/schema.sql` creates the table:

```sql
CREATE TABLE IF NOT EXISTS guideline_chunks (
    chunkid TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    section TEXT,
    content TEXT NOT NULL,
    embedding vector(1536),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

There is **no index on the `embedding` column**. No `CREATE INDEX` statement exists anywhere in the codebase (confirmed via grep for `CREATE INDEX`, `HNSW`, and `IVFFlat` across all `.sql`, `.ts`, and `.sh` files). Every query using `ORDER BY embedding <=> $1::vector` performs an O(n) sequential scan, computing cosine distance against all ~106,500 rows.

### The Query (from `guidelines.ts`)

```sql
SELECT chunkid, source, section, content,
    1 - (embedding <=> $1::vector) AS similarity
FROM guideline_chunks
ORDER BY embedding <=> $1::vector
LIMIT $2
```

This computes cosine distance for every row, sorts all results, then returns the top 5. Without an index, PostgreSQL must:
1. Load every 6KB vector from disk/cache
2. Compute cosine distance for each (~106,500 float operations)
3. Sort all results
4. Return top 5

### Impact

Each search requires scanning ~650MB of vector data. The `searchGuidelines` service calls this **twice per request** (once for condition, once for condition+findings), so each user interaction triggers ~1.3GB of sequential reads.

---

## 2. Table Size Estimate

### Row Count

| Source | Chunks |
|--------|--------|
| NICE guidelines (`ng*`, `cg*`) | 23,271 |
| WHO guidelines | 83,247 |
| **Total** | **106,518** |

### Storage Estimate

| Component | Size Per Row | Total |
|-----------|-------------|-------|
| Vector column (1536 dims) | ~6,152 bytes (4 x 1536 + 8) | ~627 MB |
| Text content (avg ~1,200 chars) | ~1,200 bytes | ~122 MB |
| Other columns (chunkid, source, section, timestamps) | ~200 bytes | ~20 MB |
| Row overhead + alignment | ~50 bytes | ~5 MB |
| **Table total** | | **~775 MB** |

This table alone exceeds the total RAM of the e2-micro VM (1GB). The vector data cannot fit in `shared_buffers`, guaranteeing heavy disk I/O on every search.

---

## 3. Memory Budget on e2-micro (1GB RAM)

On a 1GB e2-micro VM, memory is split roughly as follows:

| Consumer | Allocation |
|----------|-----------|
| Linux kernel + OS | ~150-200 MB |
| PostgreSQL (shared_buffers + per-connection) | ~200-300 MB |
| Node.js (PM2 fork, 1 instance) | ~100-200 MB |
| Nginx | ~10-20 MB |
| **Available for pgvector operations** | **~300-500 MB** |

With a 775MB table, PostgreSQL cannot hold the full table in memory. The HNSW index (typically 1.5-2x vector data size) would require an additional 940MB-1.25GB, which is **impossible** on this VM. IVFFlat indexes are more compact (~40-60% of vector data) at ~250-375MB.

### Realistic pgvector Memory Budget

PostgreSQL can realistically use ~250MB of `shared_buffers` on this VM. The `work_mem` setting (per-sort operation) should stay low (~4-8MB) since vector search sorts happen inside the index lookup when an index exists. Without an index, each sort operation on 106K vectors needs significant `work_mem`.

---

## 4. PostgreSQL Configuration Recommendations

### Current State

The `setup-vm.sh` script installs PostgreSQL 18 with pgvector 0.8.1 but applies **zero custom configuration**. PostgreSQL runs with all defaults, which are tuned for a much larger machine.

### Recommended `postgresql.conf` Changes

Add these to `/etc/postgresql/18/main/postgresql.conf` (or via `ALTER SYSTEM`):

```sql
-- Memory settings for 1GB e2-micro
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET work_mem = '4MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';

-- Connection limits (only 1 Node.js instance + pg_pool default of 10)
ALTER SYSTEM SET max_connections = 20;

-- WAL settings for small instance
ALTER SYSTEM SET wal_buffers = '8MB';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- pgvector-specific: parallel workers for index builds
ALTER SYSTEM SET max_parallel_maintenance_workers = 1;
ALTER SYSTEM SET max_parallel_workers_per_gather = 1;

-- Reload config
SELECT pg_reload_conf();
```

| Parameter | Default | Recommended | Why |
|-----------|---------|-------------|-----|
| `shared_buffers` | 128MB | 256MB | 25% of RAM; caches hot data pages |
| `effective_cache_size` | 4GB | 512MB | Tells planner how much OS cache to expect |
| `work_mem` | 4MB | 4MB | Keep default; per-sort allocation |
| `maintenance_work_mem` | 64MB | 128MB | Needed for index builds; max safe on 1GB |
| `max_connections` | 100 | 20 | Each connection uses ~5-10MB; reduce waste |

---

## 5. Index Recommendation: IVFFlat (Not HNSW)

### Why IVFFlat Over HNSW

On a 1GB VM, HNSW is not viable:

| Factor | HNSW | IVFFlat |
|--------|------|---------|
| Index size (106K rows, 1536d) | ~940MB - 1.25GB | ~250-375MB |
| Build memory (`maintenance_work_mem`) | 1-2GB needed | 128-256MB sufficient |
| Build time | ~30-60 min | ~2-5 min |
| Query speed | Faster (log time) | Slightly slower but still 10-50x faster than seq scan |
| Recall at default settings | ~95-99% | ~90-95% (tunable) |

HNSW would require more memory than the entire VM has. IVFFlat is the only viable option.

### Create the IVFFlat Index

```sql
-- Set maintenance memory for index build
SET maintenance_work_mem = '128MB';

-- Create IVFFlat index with cosine distance
-- lists = sqrt(n) is the rule of thumb; sqrt(106518) ~ 326
CREATE INDEX idx_guideline_chunks_embedding
ON guideline_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 326);
```

**Add to `schema.sql`** (after the table creation):

```sql
CREATE INDEX IF NOT EXISTS idx_guideline_chunks_embedding
ON guideline_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 326);
```

**Important**: The index must be created **after** data is loaded. IVFFlat builds cluster centroids from existing data. An empty-table index is useless. The `sync-embeddings.sh` script should add index creation after restore:

```sql
-- Add to sync-embeddings.sh after pg_restore
sudo -u postgres psql -d $REMOTE_DB -c "
  SET maintenance_work_mem = '128MB';
  DROP INDEX IF EXISTS idx_guideline_chunks_embedding;
  CREATE INDEX idx_guideline_chunks_embedding
  ON guideline_chunks
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 326);
"
```

### Tuning IVFFlat Probes

The default `probes = 1` checks only 1 of 326 lists (0.3% of data). Increase for better recall:

```sql
-- Set at session level or in pool initialization
SET ivfflat.probes = 10;
```

| Probes | Data Scanned | Approximate Recall | Latency |
|--------|-------------|-------------------|---------|
| 1 | 0.3% (~327 rows) | ~70-80% | ~2ms |
| 10 | 3% (~3,270 rows) | ~92-96% | ~10-20ms |
| 20 | 6% (~6,530 rows) | ~96-99% | ~20-40ms |
| 40 | 12% (~13,060 rows) | ~99%+ | ~40-80ms |

**Recommendation**: `probes = 10` balances recall and speed for medical guidelines where missing a relevant chunk is acceptable since the LLM can still synthesize from nearby results.

### Set Probes in the Connection Pool

In `src/server/db/index.ts`, configure the pool to set probes on each connection:

```typescript
const pool = new pg.Pool({
  // ...existing config...
});

pool.on('connect', (client) => {
  client.query('SET ivfflat.probes = 10');
});
```

---

## 6. Similarity Threshold Analysis

### Current Threshold: 0.50

From `searchGuidelines.ts`:

```typescript
const MIN_SIMILARITY = 0.50;
```

The log line at line 55 is misleading -- it says "passed 0.85 threshold" but actually filters at 0.50. This is a cosmetic bug in the log message.

### Assessment

A threshold of 0.50 with `text-embedding-3-small` (1536d, cosine similarity) is **quite lenient**. Cosine similarity of 0.50 means vectors are only loosely related. For medical guideline retrieval:

| Threshold | Meaning | Recommendation |
|-----------|---------|----------------|
| 0.40-0.50 | Loosely related content | Too broad; may return irrelevant chunks |
| 0.55-0.65 | Moderately related | Good for broad recall |
| 0.65-0.75 | Strongly related | Good balance for clinical content |
| 0.75+ | Very strong match | May miss relevant but differently-worded content |

**Recommendation**: Raise to **0.60** as a starting point. This reduces the number of chunks passed to the LLM (saving tokens and latency) while still capturing relevant guidelines. The keyword boost mechanism (0.01 per matching finding term) means chunks with exact clinical term matches still get elevated.

### Performance Impact

A higher threshold doesn't reduce database work (the query still scans and sorts all rows), but it reduces:
- Data transferred from PostgreSQL to Node.js
- Processing time in the reranking/dedup loop
- Tokens sent to the LLM in the final prompt

---

## 7. Caching Strategy

### Why Caching Helps Here

Medical guideline searches have a **bounded condition space**. Common conditions (hypertension, diabetes, asthma, chest pain) will produce identical embeddings and thus identical search results. The OpenAI embedding call (~200-500ms) and the database search (~100-2000ms without index) are both worth caching.

### Tier 1: Embedding Cache (High Impact, Easy)

Cache the OpenAI embedding response to avoid redundant API calls:

```typescript
const embeddingCache = new Map<string, number[]>();

const embedQuery = async (text: string): Promise<number[]> => {
  const cached = embeddingCache.get(text);
  if (cached) return cached;

  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  const embedding = res.data[0].embedding;
  embeddingCache.set(text, embedding);
  return embedding;
};
```

**Savings**: Eliminates ~200-500ms OpenAI API call for repeated conditions. On a single-instance fork-mode PM2 process, an in-memory Map is simple and effective.

**Memory cost**: Each 1536-dim float64 array is ~12KB. Caching 1,000 unique queries = ~12MB.

### Tier 2: Search Result Cache (Medium Impact, Easy)

Cache the final guideline search results keyed by condition + findings hash:

```typescript
import { createHash } from 'crypto';

const resultCache = new Map<string, { results: any[]; timestamp: number }>();
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

const searchGuidelines = async (condition, findings, limit = 5) => {
  const cacheKey = createHash('sha256')
    .update(JSON.stringify({ condition, findings, limit }))
    .digest('hex');

  const cached = resultCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
    return cached.results;
  }

  // ...existing search logic...

  resultCache.set(cacheKey, { results: sorted, timestamp: Date.now() });
  return sorted;
};
```

**Savings**: Eliminates both embedding API calls and both database queries for repeated condition+findings combinations.

### Tier 3: PostgreSQL-Level Materialized Approach (Lower Priority)

For the most common conditions, pre-compute and store the top-K results. This is more complex and only worthwhile if the index alone doesn't bring latency to acceptable levels.

---

## 8. Additional Optimizations

### 8a. Reduce Vector Dimensions

OpenAI's `text-embedding-3-small` supports native dimension reduction via the `dimensions` parameter. Reducing from 1536 to 512 dimensions:

- Cuts vector storage by 67% (6KB -> 2KB per row)
- Table shrinks from ~775MB to ~300MB
- IVFFlat index shrinks proportionally
- Recall loss is minimal (~2-3% for 512d vs 1536d per OpenAI benchmarks)

**Requires re-embedding all chunks**, so this is a larger change but very impactful for the e2-micro constraint.

```typescript
const res = await openai.embeddings.create({
  model: "text-embedding-3-small",
  input: text,
  dimensions: 512,  // Native dimension reduction
});
```

Schema change: `embedding vector(512)` instead of `vector(1536)`.

### 8b. Use halfvec for 50% Storage Reduction

pgvector 0.8.1 (installed in `setup-vm.sh`) supports `halfvec` (16-bit floats):

```sql
ALTER TABLE guideline_chunks
ALTER COLUMN embedding TYPE halfvec(1536)
USING embedding::halfvec(1536);
```

This halves storage with negligible recall loss. Can be combined with dimension reduction (halfvec(512)) for a 6x reduction.

### 8c. Pool Configuration

The `pg.Pool` in `db/index.ts` uses all defaults, meaning `max: 10` connections. On a 1GB VM with a single Node.js instance, this is fine but could be reduced:

```typescript
const pool = new pg.Pool({
  // ...existing config...
  max: 5,  // Reduce from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

Each idle PostgreSQL connection uses ~5-10MB of RAM. Reducing from 10 to 5 saves ~25-50MB.

---

## 9. Recommended Implementation Priority

| Priority | Change | Effort | Impact |
|----------|--------|--------|--------|
| **P0** | Create IVFFlat index on embedding column | 1 hour | 10-50x faster queries |
| **P0** | Set `ivfflat.probes = 10` on pool connections | 5 min | Ensures good recall with index |
| **P1** | PostgreSQL memory tuning (`shared_buffers`, etc.) | 30 min | Better cache hit ratio |
| **P1** | Embedding cache (in-memory Map) | 30 min | Eliminates repeated API calls |
| **P1** | Search result cache | 30 min | Eliminates repeated DB queries |
| **P2** | Raise similarity threshold to 0.60 | 5 min | Reduces noise, saves LLM tokens |
| **P2** | Reduce pool max connections to 5 | 5 min | Frees ~25-50MB RAM |
| **P3** | Reduce dimensions to 512 (requires re-embedding) | 2-3 hours | 67% less storage + faster search |
| **P3** | Switch to halfvec (requires column alter + re-index) | 1 hour | 50% less storage |

---

## 10. Quick-Win SQL Script

Run this on the production VM after embeddings are loaded:

```sql
-- Step 1: PostgreSQL tuning for 1GB VM
ALTER SYSTEM SET shared_buffers = '256MB';
ALTER SYSTEM SET effective_cache_size = '512MB';
ALTER SYSTEM SET maintenance_work_mem = '128MB';
ALTER SYSTEM SET max_connections = 20;
ALTER SYSTEM SET work_mem = '4MB';
SELECT pg_reload_conf();

-- Step 2: Create the IVFFlat index (takes 2-5 min on e2-micro)
SET maintenance_work_mem = '128MB';
CREATE INDEX IF NOT EXISTS idx_guideline_chunks_embedding
ON guideline_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 326);

-- Step 3: Verify index is used
EXPLAIN ANALYZE
SELECT chunkid, source, section, content,
    1 - (embedding <=> '[0.1,0.2,...]'::vector) AS similarity
FROM guideline_chunks
ORDER BY embedding <=> '[0.1,0.2,...]'::vector
LIMIT 5;
-- Should show "Index Scan using idx_guideline_chunks_embedding"

-- Step 4: Check table and index sizes
SELECT
    pg_size_pretty(pg_total_relation_size('guideline_chunks')) AS total,
    pg_size_pretty(pg_relation_size('guideline_chunks')) AS table_only,
    pg_size_pretty(pg_indexes_size('guideline_chunks')) AS indexes;
```

---

## Sources

- [pgvector GitHub - Official Documentation](https://github.com/pgvector/pgvector)
- [HNSW Indexes with Postgres and pgvector - Crunchy Data](https://www.crunchydata.com/blog/hnsw-indexes-with-postgres-and-pgvector)
- [Performance Tips Using Postgres and pgvector - Crunchy Data](https://www.crunchydata.com/blog/pgvector-performance-for-developers)
- [Faster similarity search with pgvector indexes - Google Cloud](https://cloud.google.com/blog/products/databases/faster-similarity-search-performance-with-pgvector-indexes)
- [PGVector: HNSW vs IVFFlat Comprehensive Study - Medium](https://medium.com/@bavalpreetsinghh/pgvector-hnsw-vs-ivfflat-a-comprehensive-study-21ce0aaab931)
- [Optimize with pgvector indexing: IVFFlat and HNSW - AWS](https://aws.amazon.com/blogs/database/optimize-generative-ai-applications-with-pgvector-indexing-a-deep-dive-into-ivfflat-and-hnsw-techniques/)
- [Don't use vector, use halfvec - Neon](https://neon.com/blog/dont-use-vector-use-halvec-instead-and-save-50-of-your-storage-cost)
- [Scalar and binary quantization for pgvector - Jonathan Katz](https://jkatz05.com/post/postgres/pgvector-scalar-binary-quantization/)
- [Scaling pgvector: Memory, Quantization, and Index Build Strategies - DEV](https://dev.to/philip_mcclarence_2ef9475/scaling-pgvector-memory-quantization-and-index-build-strategies-8m2)
- [pgvector Guide for DBA Part 2: Indexes (March 2026) - dbi services](https://www.dbi-services.com/blog/pgvector-a-guide-for-dba-part-2-indexes-update-march-2026/)
