# QW-1: Create IVFFlat Index on guideline_chunks.embedding

**Impact:** Highest single fix. Drops pgvector query time from 200-2000ms to 10-50ms.
**Effort:** Low
**Risk:** Index build may take 5-15min on e2-micro; OOM possible during build.

## Problem
No vector index exists on `guideline_chunks`. Every `searchGuidelines` call does 2 full sequential scans of ~106,500 rows (~775MB of vector data) per diagnosis.

## Changes

### 1. Add index to schema (`src/server/scripts/setup.ts` or schema SQL)
```sql
CREATE INDEX IF NOT EXISTS idx_guideline_chunks_embedding
ON guideline_chunks
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 326);
```

### 2. Set probes on pool connect (`src/server/db/pool.ts`)
```typescript
pool.on('connect', (client) => {
  client.query('SET ivfflat.probes = 10');
});
```

### 3. Add index build to embed scripts
After bulk insert in `who:embed` and `nice:embed`, create the index with `maintenance_work_mem = '128MB'`.

## Done When
- [ ] IVFFlat index exists in schema setup
- [ ] `ivfflat.probes = 10` set on every new connection
- [ ] Embed scripts rebuild index after bulk insert
- [ ] Verified locally that setup.ts applies the index
