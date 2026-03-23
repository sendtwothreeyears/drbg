# Expert 2: Node.js & Express Performance Analysis

## Executive Summary

The primary performance bottleneck is **not server-side compute** but rather the **sequential chaining of external API calls** during the assessment pipeline. On an e2-micro (1 GB RAM), the application is viable but needs defensive configuration to prevent memory exhaustion and request hangs. The assessment generation phase alone chains 4-7 sequential external API calls that could be partially parallelized for a significant latency reduction.

---

## 1. Assessment Pipeline Structure: Sequential vs Parallel

### Current Flow (sequential, lines 245-274 in `runStreamOpenAI.ts`)

When `generate_differentials` is called, the post-stream pipeline executes:

```
1. getFindingsByConversationQuery()                          ~5-20ms (DB)
2. FOR EACH differential: searchGuidelines()                 ~400-800ms EACH (2 OpenAI embedding calls + 2 DB vector searches)
3. generateAssessment()                                      ~3-8s (Claude Sonnet, non-streaming)
4. updateAssessmentMutation()                                ~5-20ms (DB)
5. extractFindings()                                         ~1-3s (Claude Haiku)
```

**Critical finding:** Step 2 is already parallelized via `Promise.all` (line 261), which is good. However, **step 5 (`extractFindings`) is completely independent of steps 2-4 and runs sequentially after them.**

### `searchGuidelines` Internal Sequencing (lines 22-33 in `searchGuidelines.ts`)

Each `searchGuidelines` call makes **two sequential embedding requests** followed by **two sequential DB queries**:

```
embedQuery(condition)           ~150-300ms (OpenAI API)
searchGuidelineChunksQuery()    ~10-50ms  (pgvector)
embedQuery(findingsQuery)       ~150-300ms (OpenAI API)
searchGuidelineChunksQuery()    ~10-50ms  (pgvector)
```

The two `embedQuery` calls within a single `searchGuidelines` invocation are independent and should be parallelized.

### Recommendations

**P0 - Parallelize extractFindings with assessment generation** (`runStreamOpenAI.ts`, lines 259-281):

Currently:
```typescript
// Lines 259-270: assessment pipeline runs
// Lines 278-281: extractFindings runs AFTER assessment completes
```

`extractFindings` only depends on the last user message and `conversationId` -- not on the assessment result. These should run concurrently:

```typescript
// Launch extractFindings immediately, don't await yet
const findingsPromise = lastUserMsg
  ? extractFindings(conversationId, lastUserMsg.content)
  : Promise.resolve();

// Run assessment pipeline
const guidelineResults = await Promise.all(
  differentials.map((d) => searchGuidelines(d.condition, findings)),
);
const { text, sources } = await generateAssessment(...);
await updateAssessmentMutation(conversationId, text, sources);

// Now await extractFindings (likely already done)
await findingsPromise;
```

**Estimated savings:** 1-3 seconds (the full Haiku call duration) on assessment requests.

**P1 - Parallelize embedding calls within searchGuidelines** (`searchGuidelines.ts`, lines 22-33):

```typescript
// Current: sequential
const conditionEmbedding = await embedQuery(condition);
const conditionChunks = await searchGuidelineChunksQuery(conditionEmbedding, limit);
const findingsEmbedding = await embedQuery(findingsQuery);
const findingsChunks = await searchGuidelineChunksQuery(findingsEmbedding, limit);

// Proposed: parallel embeddings, then parallel DB queries
const [conditionEmbedding, findingsEmbedding] = await Promise.all([
  embedQuery(condition),
  embedQuery(findingsQuery),
]);
const [conditionChunks, findingsChunks] = await Promise.all([
  searchGuidelineChunksQuery(conditionEmbedding, limit),
  searchGuidelineChunksQuery(findingsEmbedding, limit),
]);
```

**Estimated savings:** 150-300ms per differential (one embedding round trip).

---

## 2. Node.js-Specific Performance Issues on 1 GB RAM

### Memory Concerns

**2a. Multiple SDK client instantiations.** Three separate files instantiate SDK clients at module scope:

- `anthropic.ts` line 6: `new Anthropic()`
- `generateAssessment.ts` line 4: `new Anthropic()` (duplicate!)
- `openai-chat.ts` line 3: `new OpenAI()`
- `translate.ts` line 3: `new OpenAI()` (duplicate!)
- `searchGuidelines.ts` line 5: `new OpenAI()` (triplicate!)

Each SDK instance holds its own HTTP agent with connection pools. On 1 GB RAM, this matters.

**Recommendation:** Create a single shared instance for each SDK in a `clients.ts` module and import from there. This reduces memory overhead and enables connection reuse.

**2b. No `max_old_space_size` configured.** The PM2 config (`ecosystem.config.cjs`) does not set `--max-old-space-size`. Node.js defaults to ~1.4 GB on 64-bit, which on a 1 GB RAM machine will trigger OOM kills before GC can reclaim memory.

**Recommendation:** Add to `ecosystem.config.cjs`:
```javascript
interpreter_args: "--import tsx --max-old-space-size=512",
```

This gives Node.js 512 MB, leaving room for the OS, Nginx, PostgreSQL, and PM2.

**2c. No PM2 memory limit restart.** If a memory leak develops, PM2 will not restart the process until the OS kills it.

**Recommendation:** Add to `ecosystem.config.cjs`:
```javascript
max_memory_restart: "450M",
```

**2d. `pg.Pool` has no connection limit.** The default `pg.Pool` max is 10 connections (`db/index.ts`). On e2-micro with a local PostgreSQL, this is acceptable, but if PostgreSQL is external, each idle connection consumes ~5-10 MB.

**Recommendation:** Explicitly set pool size:
```typescript
const pool = new pg.Pool({
  ...config,
  max: 5,           // sufficient for single-instance fork mode
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

**2e. String concatenation in streaming loop.** `fullText += delta.content` (line 91 in `runStreamOpenAI.ts`) creates a new string on each chunk. For typical response lengths (< 2KB), this is negligible. Not a real concern here.

### Event Loop Blocking

The codebase is clean of CPU-intensive synchronous operations. All heavy work (LLM calls, DB queries, embeddings) is async I/O. The `JSON.parse(fc.arguments)` at line 170 is on small payloads. **No event loop blocking issues detected.**

### GC Pressure

The main GC pressure source is the large number of intermediate string and object allocations during the assessment pipeline. With `--max-old-space-size=512`, the V8 GC will run more frequently but prevent OOM. This is the correct tradeoff for 1 GB RAM.

---

## 3. PM2 Configuration Analysis

### Current Config (`ecosystem.config.cjs`)

```javascript
instances: 1,
exec_mode: "fork",
```

### Assessment: Fork mode with 1 instance is correct for e2-micro

- **Cluster mode is wrong** for this workload. The app is I/O-bound (waiting on external APIs), not CPU-bound. Multiple instances would multiply memory usage without improving throughput since the bottleneck is API latency, not event loop saturation.
- **Fork mode with 1 instance** is the right call. A single Node.js process can handle many concurrent SSE connections because they are non-blocking I/O.
- **tsx runtime in production** (`--import tsx`) adds overhead for TypeScript transpilation. On e2-micro, pre-compiling with `tsc` or `esbuild` and running plain `node dist/main.js` would reduce startup time and memory footprint by ~30-50 MB.

### Recommendations

**P1 - Pre-compile for production.** Replace tsx runtime compilation:
```javascript
// ecosystem.config.cjs
script: "dist/server/main.js",
interpreter: "node",
interpreter_args: "--max-old-space-size=512",
```

Add a build step: `esbuild src/server/main.ts --bundle --platform=node --outdir=dist` or `tsc`.

**P2 - Add PM2 restart policies:**
```javascript
max_memory_restart: "450M",
exp_backoff_restart_delay: 1000,
max_restarts: 10,
```

---

## 4. Missing Timeouts

This is a significant gap. Multiple places lack timeouts, any of which can cause indefinite request hangs.

### 4a. No SSE connection timeout (`conversation.ts`, `initiateStream`)

If the entire `runStreamOpenAI` pipeline stalls (e.g., Claude API hangs), the SSE connection stays open indefinitely.

**Recommendation:** Add a master timeout in `initiateStream`:
```typescript
const STREAM_TIMEOUT_MS = 120_000; // 2 minutes
const timeout = setTimeout(() => {
  if (!closed) {
    send({ error: "Request timed out" });
    res.end();
  }
}, STREAM_TIMEOUT_MS);

// Clear in onDone and onError callbacks
```

### 4b. No timeout on Claude assessment call (`generateAssessment.ts`, line 46)

`client.messages.create()` for Claude Sonnet has no timeout. The Anthropic SDK supports `timeout` as a request option.

**Recommendation:**
```typescript
const response = await client.messages.create({
  ...params,
}, { timeout: 60_000 });
```

### 4c. No timeout on Haiku extraction call (`anthropic.ts`, line 29)

Same issue: `createToolRequest` has no timeout.

### 4d. No timeout on translation calls (`translate.ts`, line 46)

OpenAI `chat.completions.create` has no timeout. The retry-with-2-attempts pattern in `runStreamOpenAI.ts` (lines 123-135) helps but doesn't prevent a single attempt from hanging.

**Recommendation:** OpenAI SDK supports `timeout` in request options:
```typescript
const response = await client.chat.completions.create({
  ...params,
}, { timeout: 15_000 });
```

### 4e. No timeout on embedding calls (`searchGuidelines.ts`, line 8)

`openai.embeddings.create()` can hang indefinitely.

### 4f. No timeout on DB queries

`pg.Pool` queries have no statement timeout. A slow pgvector similarity search on a large table could block.

**Recommendation:** Add `statement_timeout` to the pool config or per-query:
```typescript
await pool.query('SET statement_timeout = 10000'); // 10s
```

Or use `connectionTimeoutMillis` and `query_timeout` in pool config.

---

## 5. Streaming Assessment from Claude

### Current Approach

`generateAssessment.ts` line 46 uses `client.messages.create()` which waits for the **complete** response before returning. The user sees nothing during the 3-8 second Claude Sonnet call. They only see a loading indicator (`onAssessmentLoading`).

### Should It Stream?

**Yes, with caveats.** Streaming the assessment would let the client display text progressively, dramatically improving perceived latency. However, there is an architectural consideration:

The current flow:
1. Wait for full assessment text
2. Persist text + sources to DB
3. Send complete assessment in `onDone` metadata

If streaming:
1. Stream assessment chunks to client in real time
2. Accumulate full text server-side
3. Persist after stream completes

**Recommendation (P1):** Switch `generateAssessment` to streaming:

```typescript
const stream = client.messages.stream({
  model: "claude-sonnet-4-5-20250929",
  max_tokens: 2048,
  system: systemPrompt,
  messages: [{ role: "user", content: prompt }],
});

let fullText = "";
for await (const event of stream) {
  if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
    fullText += event.delta.text;
    onAssessmentText(event.delta.text); // New callback
  }
}
```

This requires:
- Adding an `onAssessmentText` callback to the `runStreamOpenAI` signature
- Adding a new SSE event type (e.g., `{ assessmentText: string }`)
- Client-side handling to render streaming assessment text

**Estimated perceived latency improvement:** User sees first assessment text in ~500ms instead of waiting 3-8 seconds.

---

## 6. Nginx Configuration Improvements

### Current Config (`nginx.conf`)

The config is minimal but functional for SSE. Several important settings are missing.

### 6a. No `proxy_read_timeout`

Default is 60 seconds. If the assessment pipeline takes longer (plausible with multiple API calls), Nginx will close the connection.

```nginx
proxy_read_timeout 300s;   # 5 minutes for long SSE streams
proxy_send_timeout 120s;
```

### 6b. No `proxy_connect_timeout`

Default 60s is fine, but being explicit is better:
```nginx
proxy_connect_timeout 10s;
```

### 6c. No keepalive to upstream

Without keepalive, Nginx opens a new TCP connection to Node.js for every request. On the same machine, this is cheap but still adds latency.

```nginx
upstream boafo {
    server 127.0.0.1:3000;
    keepalive 8;
}

server {
    ...
    location / {
        proxy_pass http://boafo;
        ...
    }

    location /api/conversations/ {
        # SSE-specific settings only for streaming endpoint
        proxy_pass http://boafo;
        proxy_read_timeout 300s;
        proxy_buffering off;
        proxy_cache off;
        chunked_transfer_encoding off;
        proxy_set_header Connection '';
    }
}
```

### 6d. No gzip for non-SSE responses

Static assets and JSON API responses benefit from compression:
```nginx
gzip on;
gzip_types application/json text/css application/javascript;
gzip_min_length 256;
```

### 6e. No `client_max_body_size`

Default is 1 MB. Sufficient for this app's payloads, but should be explicit:
```nginx
client_max_body_size 1m;
```

### 6f. Missing `Upgrade` header for potential WebSocket use

Not critical now, but if you ever move from SSE to WebSocket:
```nginx
proxy_set_header Upgrade $http_upgrade;
```

---

## 7. Server-Side vs External API Latency Breakdown

### Latency Budget for a Typical Streaming Request (English, no assessment)

| Phase | Type | Estimated Duration |
|-------|------|-------------------|
| DB: getConversationQuery | Server | 5-15ms |
| DB: getMessagesByConversationQuery | Server | 5-20ms |
| OpenAI: streaming response (GPT-5.2) | **External API** | **1-5s** |
| OpenAI: translation (if non-English) | **External API** | **300-800ms** |
| DB: createMessageMutation | Server | 5-15ms |
| Anthropic: extractFindings (Haiku) | **External API** | **1-3s** |
| **Total** | | **1.3-9s** |

### Latency Budget for Assessment Request

| Phase | Type | Estimated Duration |
|-------|------|-------------------|
| OpenAI: streaming response | **External API** | **1-5s** |
| DB: getFindingsByConversationQuery | Server | 5-15ms |
| OpenAI: 2 embeddings x N differentials (parallel across differentials, sequential within) | **External API** | **400-800ms** |
| DB: pgvector search x 2N | Server | 20-100ms |
| Anthropic: generateAssessment (Sonnet, non-streaming) | **External API** | **3-8s** |
| DB: updateAssessmentMutation | Server | 5-15ms |
| Anthropic: extractFindings (Haiku) | **External API** | **1-3s** |
| **Total** | | **5.4-17s** |

### Verdict

**~95% of total latency is external API calls.** Server-side compute and DB operations account for roughly 50-180ms total. The e2-micro's limited CPU is not the bottleneck for request latency -- it is pure I/O wait time.

The biggest wins come from:
1. **Parallelizing independent API calls** (extractFindings + assessment, embeddings within searchGuidelines)
2. **Streaming the assessment** to reduce perceived latency
3. **Adding timeouts** to prevent indefinite hangs from API failures

Server CPU/RAM constraints matter for **concurrent users** (memory pressure from multiple in-flight requests) rather than single-request latency.

---

## Summary: Prioritized Recommendations

| Priority | Issue | File(s) | Estimated Impact |
|----------|-------|---------|-----------------|
| **P0** | Parallelize extractFindings with assessment pipeline | `runStreamOpenAI.ts:259-281` | Save 1-3s on assessment requests |
| **P0** | Add master SSE timeout | `conversation.ts:initiateStream` | Prevent indefinite hangs |
| **P0** | Set `--max-old-space-size=512` | `ecosystem.config.cjs` | Prevent OOM kills on 1GB RAM |
| **P1** | Parallelize embeddings in searchGuidelines | `searchGuidelines.ts:22-33` | Save 150-300ms per differential |
| **P1** | Stream assessment from Claude | `generateAssessment.ts:46` | 3-8s perceived latency reduction |
| **P1** | Add timeouts to all external API calls | `generateAssessment.ts`, `anthropic.ts`, `translate.ts`, `searchGuidelines.ts` | Prevent request hangs |
| **P1** | Add `proxy_read_timeout 300s` to Nginx | `nginx.conf` | Prevent Nginx killing long SSE streams |
| **P1** | Add `max_memory_restart: "450M"` to PM2 | `ecosystem.config.cjs` | Auto-recover from memory leaks |
| **P2** | Deduplicate SDK client instances | `anthropic.ts`, `generateAssessment.ts`, `translate.ts`, `searchGuidelines.ts`, `openai-chat.ts` | Reduce baseline memory ~20-40MB |
| **P2** | Pre-compile TypeScript (replace tsx) | `ecosystem.config.cjs` + build step | Reduce memory ~30-50MB, faster startup |
| **P2** | Add Nginx keepalive upstream | `nginx.conf` | Minor latency reduction |
| **P2** | Configure pg.Pool limits | `db/index.ts` | Prevent connection exhaustion |
| **P2** | Add gzip to Nginx | `nginx.conf` | Smaller static asset / JSON transfers |
