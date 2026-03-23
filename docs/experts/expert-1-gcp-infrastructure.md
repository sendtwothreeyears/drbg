# GCP Infrastructure Analysis: Boafo Clinical Decision-Support App

**Expert:** GCP Infrastructure & Compute Sizing
**Date:** 2026-03-23
**Current Setup:** e2-micro (0.25 vCPU baseline, 1 GB RAM) in GCP Compute Engine

---

## 1. Is an e2-micro Instance Adequate for This Workload?

**No. The e2-micro is critically undersized for this workload.** The app is running five memory-hungry processes on a machine with 1 GB total RAM:

| Process | Estimated Memory | Notes |
|---------|-----------------|-------|
| Node.js (Express + PM2) | 150-250 MB | Single instance, fork mode. Includes SDK clients for OpenAI and Anthropic |
| PostgreSQL 18 + pgvector | 200-350 MB | Depends on shared_buffers config; pgvector indexes must fit in memory for acceptable query speed |
| Nginx | 5-15 MB | Lightweight, not a concern |
| Puppeteer/Chromium (PDF gen) | 200-400 MB | Launches a headless Chromium process per PDF. This alone can OOM the instance |
| Linux OS + kernel | 100-150 MB | Baseline overhead |
| **Total estimated** | **655-1165 MB** | **Exceeds 1 GB under load** |

### The Puppeteer Problem

The app uses Puppeteer (headless Chromium) for PDF generation (`src/server/services/generatePDF.ts`). A single Chromium process typically consumes 200-400 MB of RAM. On a 1 GB machine already running Node.js and PostgreSQL, launching Puppeteer will frequently trigger the Linux OOM killer or force heavy swap usage, causing the entire VM to freeze or crash.

This is likely the single biggest source of slowness and instability.

### CPU Bursting Limitations

The e2-micro provides:
- **Baseline:** 0.25 vCPU (12.5% of one physical core)
- **Burst:** Up to 2 vCPU for short periods (credit-based system)
- **Credit accumulation:** Credits build when CPU is idle; consumed during bursts

The problem: assessment generation involves a sequence of CPU-bound and I/O-bound operations (embedding generation calls, pgvector similarity searches, multiple LLM API calls, SSE streaming). While each individual API call is I/O-wait (good for a small CPU), the pgvector cosine distance calculations (`embedding <=> $1::vector`) are CPU-intensive. Running 2 similarity searches per diagnosis at 0.25 vCPU baseline will be noticeably slow, especially if burst credits are depleted from prior requests.

### Network I/O

The e2-micro has limited network bandwidth (up to 1 Gbps shared). For this workload, network is unlikely to be the bottleneck since LLM API calls are latency-bound (waiting for model inference), not bandwidth-bound. However, the free tier includes only 1 GB of egress per month, which could be exceeded with regular use (SSE streams, PDF downloads, API calls).

---

## 2. Specific Resource Constraints Causing Slowness

### Memory Pressure (Primary Issue)

With 1 GB RAM shared across all processes:
- **PostgreSQL shared_buffers** should be ~25% of RAM (256 MB) but this leaves almost nothing for Node.js and the OS. In practice, shared_buffers is likely set to the default 128 MB or lower, meaning pgvector queries hit disk more often.
- **pgvector index performance** degrades dramatically when indexes don't fit in memory. Each similarity search does a full vector comparison, and without adequate RAM for caching, these queries become I/O-bound against the persistent disk.
- **Puppeteer PDF generation** will push total memory over 1 GB, triggering swap or OOM kills.

### CPU Starvation (Secondary Issue)

- 0.25 vCPU baseline means pgvector similarity searches run at 1/4 speed when burst credits are depleted
- Node.js garbage collection pauses are more impactful on a fractional CPU
- PostgreSQL query planning and execution competes with Node.js for the same 0.25 vCPU

### Disk I/O (Tertiary Issue)

- Standard persistent disk (HDD) provides low IOPS, which compounds memory pressure: when the OS swaps or PostgreSQL reads from disk instead of cache, the slow disk makes everything worse
- pgvector sequential scans on standard HDD are significantly slower than on SSD

### The Compounding Effect

These constraints multiply each other. When memory runs low, the OS swaps to disk. The disk is slow (standard HDD). While swapping, the 0.25 vCPU is consumed by I/O wait. Meanwhile, incoming requests queue up in Node.js's single-threaded event loop. The result is cascading latency that makes the app feel unresponsive for 10-30 seconds during assessment generation.

---

## 3. Recommended GCP Instance

### Primary Recommendation: e2-small

| Spec | e2-micro (current) | e2-small (recommended) | e2-medium (future) |
|------|-------------------|----------------------|-------------------|
| vCPU | 2 (0.25 baseline) | 2 (0.50 baseline) | 2 (1.0 baseline) |
| RAM | 1 GB | 2 GB | 4 GB |
| Monthly cost | ~$6.11 (free tier) | ~$12.23 | ~$24.46 |
| Network | Up to 1 Gbps | Up to 1 Gbps | Up to 1 Gbps |

**Why e2-small:**
- **2 GB RAM** gives enough headroom for Node.js (~200 MB) + PostgreSQL with reasonable shared_buffers (~512 MB) + Puppeteer (~300 MB) + OS (~150 MB) = ~1.16 GB, leaving ~840 MB for OS cache and spikes
- **0.50 vCPU baseline** (double current) means pgvector queries run at a usable speed even without burst credits
- **$12.23/month** is the most cost-efficient upgrade -- you double RAM and baseline CPU for just $6 more than the current (non-free-tier) price
- Still a shared-core instance, so pricing stays very low

### When to Move to e2-medium (~$24.46/month)

Upgrade to e2-medium if:
- You expect more than ~5 concurrent users generating assessments
- PDF generation frequency increases (each Puppeteer launch is a spike)
- You add more guideline data to pgvector (larger indexes need more RAM)
- The e2-small still shows memory pressure under real usage

### Cost Comparison Summary

| Option | Monthly Cost | Delta from Current | RAM | CPU Baseline |
|--------|-------------|-------------------|-----|-------------|
| e2-micro (free tier) | $0 | -- | 1 GB | 0.25 vCPU |
| e2-micro (paid) | $6.11 | +$6.11 | 1 GB | 0.25 vCPU |
| **e2-small** | **$12.23** | **+$6.12** | **2 GB** | **0.50 vCPU** |
| e2-medium | $24.46 | +$18.35 | 4 GB | 1.0 vCPU |
| e2-standard-2 | ~$48.92 | +$42.81 | 8 GB | 2 vCPU (dedicated) |

*Prices for us-central1. Other regions may vary.*

---

## 4. Should PostgreSQL + pgvector Be on a Separate Instance?

### Option A: Keep Co-located (Recommended for Now)

**Pros:**
- Zero network latency between app and database
- No additional instance cost
- Simpler deployment and maintenance
- With e2-small (2 GB), there is enough RAM for both processes

**Cons:**
- Resource contention between Node.js and PostgreSQL
- Puppeteer spikes affect database performance
- No independent scaling

**Verdict:** At the current scale (low concurrent users, small dataset), co-location on an e2-small is the right call. The cost savings (~$10-30/month) outweigh the performance benefits of separation.

### Option B: Cloud SQL (Future Consideration)

| Cloud SQL Tier | Specs | Monthly Cost | Notes |
|---------------|-------|-------------|-------|
| db-f1-micro | Shared CPU, 0.6 GB RAM | ~$10 | No SLA, minimal RAM. Not suitable for pgvector |
| db-g1-small | Shared CPU, 1.7 GB RAM | ~$26 | Barely adequate for pgvector |
| db-custom-1-3840 | 1 vCPU, 3.75 GB RAM | ~$30-50 | First reasonable option for pgvector |

**When to move to Cloud SQL:**
- When you need automated backups, failover, or point-in-time recovery
- When concurrent users exceed ~10-20 and DB queries start queuing
- When the pgvector dataset grows beyond what fits in the co-located instance's memory
- When you need to scale the app server independently (e.g., multiple app instances behind a load balancer)

**Cost reality check:** Cloud SQL's cheapest viable option for pgvector (~$30-50/month) plus an e2-small for the app (~$12/month) totals ~$42-62/month. This is 3-5x the cost of a single e2-small. Only justified at higher traffic levels.

### Option C: Separate Compute Engine VM for PostgreSQL

A dedicated e2-small ($12.23/month) running only PostgreSQL would give the database 2 GB of dedicated RAM (shared_buffers = 512 MB, effective_cache_size = 1.5 GB). Combined with an e2-micro for the app, the total would be ~$18/month. This is a middle ground between co-location and Cloud SQL, but adds operational complexity (two VMs to maintain, network latency between them).

**Not recommended** at current scale. The operational overhead isn't worth the modest performance gain.

---

## 5. GCP-Specific Optimizations

### 5.1 Switch to SSD Persistent Disk (High Impact, Low Cost)

**Current likely setup:** Standard persistent disk (pd-standard)
**Recommended:** Balanced persistent disk (pd-balanced) or SSD persistent disk (pd-ssd)

| Disk Type | $/GB/month | Read IOPS (10 GB) | Write IOPS (10 GB) |
|-----------|-----------|-------------------|-------------------|
| pd-standard | $0.04 | ~0.75/GB | ~1.5/GB |
| pd-balanced | $0.10 | 6/GB | 6/GB |
| pd-ssd | $0.17 | 30/GB | 30/GB |

For a 10 GB disk: pd-standard = $0.40/month, pd-balanced = $1.00/month, pd-ssd = $1.70/month.

The cost difference is negligible ($0.60-1.30/month more), but the IOPS improvement is massive. This directly helps pgvector queries when data doesn't fit in PostgreSQL's buffer cache, and eliminates swap-related latency spikes.

**Recommendation:** Switch to pd-balanced at minimum. The $0.60/month increase pays for itself in reduced latency.

### 5.2 Swap File Configuration (Immediate, Free)

Add a 1-2 GB swap file to prevent OOM kills during Puppeteer launches:

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
sudo sysctl vm.swappiness=10  # Only use swap under pressure
```

This won't make Puppeteer fast, but it prevents hard crashes. Combined with an SSD persistent disk, swap performance is tolerable.

### 5.3 PostgreSQL Tuning for Small Instance (Free)

Optimize `postgresql.conf` for a 2 GB instance (e2-small):

```
shared_buffers = 512MB          # 25% of 2 GB
effective_cache_size = 1.5GB    # 75% of 2 GB
work_mem = 16MB                 # For sorting/hashing in queries
maintenance_work_mem = 128MB    # For VACUUM, index builds
max_connections = 20            # Each connection uses ~5-10 MB
```

For the current e2-micro (1 GB), more conservative settings:

```
shared_buffers = 128MB
effective_cache_size = 512MB
work_mem = 4MB
maintenance_work_mem = 64MB
max_connections = 10
```

### 5.4 Replace Puppeteer with a Lighter PDF Solution (High Impact)

Puppeteer launches an entire Chromium browser. On a small VM, this is the biggest single source of memory pressure and latency. Consider:

- **@react-pdf/renderer** or **pdfkit**: Generate PDFs directly in Node.js without a browser (~10-30 MB vs ~200-400 MB)
- **wkhtmltopdf**: Lighter than Chromium but still significant (~50-100 MB)
- **External PDF service**: Use a Cloud Function or Cloud Run service that only runs during PDF generation, keeping the main VM lean

Replacing Puppeteer with a native PDF library would be the single highest-impact optimization for the e2-micro/e2-small, potentially saving 200-400 MB of peak RAM usage.

### 5.5 Network Tier (Low Priority)

GCP offers Premium and Standard network tiers:
- **Premium (default):** Uses Google's global network. Lower latency to end users.
- **Standard:** Uses public internet. Slightly higher latency but ~30% cheaper for egress.

For this app, network latency to end users is dwarfed by LLM API latency (seconds). Switching to Standard tier would save a small amount on egress but is unlikely to noticeably affect user experience.

### 5.6 Node.js Memory Limit (Free)

Set an explicit memory limit for Node.js to prevent it from consuming all available RAM:

```bash
# In ecosystem.config.cjs, add to interpreter_args:
node --import tsx --max-old-space-size=384
```

This caps Node.js heap at 384 MB (reasonable for e2-small), leaving the rest for PostgreSQL and the OS.

### 5.7 Connection Pooling (Free)

The current `pg.Pool` uses default settings (10 connections). Each idle PostgreSQL connection consumes ~5-10 MB. On a 1 GB machine, reduce the pool size:

```typescript
const pool = new pg.Pool({
  // ... existing config
  max: 5,              // Reduce from default 10
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

---

## 6. Recommended Migration Path

### Phase 1: Immediate (Free Optimizations)

1. Add a 2 GB swap file
2. Tune PostgreSQL for 1 GB RAM (shared_buffers=128MB, max_connections=10)
3. Reduce pg.Pool max connections to 5
4. Set Node.js --max-old-space-size=384

### Phase 2: Low-Cost Upgrades (~$7/month increase)

1. **Upgrade to e2-small** ($12.23/month vs $6.11 or free tier)
2. **Switch to pd-balanced disk** (+$0.60/month for 10 GB)
3. Re-tune PostgreSQL for 2 GB RAM

### Phase 3: Application Changes (Development Effort)

1. **Replace Puppeteer** with pdfkit or @react-pdf/renderer (saves 200-400 MB peak RAM)
2. Consider pre-generating PDFs asynchronously and caching them

### Phase 4: Scale When Needed

1. Upgrade to e2-medium if e2-small shows strain under real usage (~$24/month)
2. Move PostgreSQL to Cloud SQL when you need managed backups/HA or concurrent users exceed ~10-20 (~$30-50/month additional)

---

## 7. Summary

| Question | Answer |
|----------|--------|
| Is e2-micro adequate? | **No.** 1 GB RAM is insufficient for Node.js + PostgreSQL/pgvector + Puppeteer + Nginx |
| Primary bottleneck? | **Memory.** Puppeteer alone can consume 200-400 MB, leaving nothing for PostgreSQL caching |
| Secondary bottleneck? | **CPU.** 0.25 vCPU baseline makes pgvector similarity searches slow when burst credits are depleted |
| Recommended instance? | **e2-small** ($12.23/month) -- doubles RAM and CPU baseline for minimal cost increase |
| Separate the database? | **Not yet.** Co-location on e2-small is fine at current scale. Revisit at ~10-20 concurrent users |
| Highest-impact change? | **Replace Puppeteer** with a native PDF library. This single change could make e2-micro viable |
| Best cost/performance ratio? | **e2-small + pd-balanced disk + Puppeteer replacement** -- total ~$13/month, dramatically better performance |

---

## Sources

- [GCP General-Purpose Machine Family Documentation](https://cloud.google.com/compute/docs/general-purpose-machines)
- [GCP Machine Families Resource and Comparison Guide](https://docs.cloud.google.com/compute/docs/machine-resource)
- [e2-micro Specifications (gcloud-compute.com)](https://gcloud-compute.com/e2-micro.html)
- [e2-micro Pricing ($6.11/month)](https://www.economize.cloud/resources/gcp/pricing/compute-engine/e2-micro/)
- [e2-small Pricing ($12.23/month)](https://www.economize.cloud/resources/gcp/pricing/compute-engine/e2-small/)
- [e2-medium Specifications (gcloud-compute.com)](https://gcloud-compute.com/e2-medium.html)
- [GCP Compute Engine Free Tier](https://cloud.google.com/free)
- [GCP Free Tier Compute Documentation](https://cloud.google.com/free/docs/compute-getting-started)
- [Cloud SQL Pricing](https://cloud.google.com/sql/pricing)
- [Cloud SQL Editions Overview](https://docs.cloud.google.com/sql/docs/postgres/editions-intro)
- [GCP Persistent Disk Performance](https://docs.cloud.google.com/compute/docs/disks/performance)
- [GCP Disk and Image Pricing](https://cloud.google.com/compute/disks-image-pricing)
- [pgvector Performance Tips (Crunchy Data)](https://www.crunchydata.com/blog/pgvector-performance-for-developers)
- [pgvector Memory Consumption Discussion](https://github.com/pgvector/pgvector/issues/144)
- [PostgreSQL Tuning Wiki](https://wiki.postgresql.org/wiki/Tuning_Your_PostgreSQL_Server)
- [PostgreSQL shared_buffers Documentation](https://postgresqlco.nf/doc/en/param/shared_buffers/)
- [EDB: How to Tune PostgreSQL for Memory](https://www.enterprisedb.com/postgres-tutorials/how-tune-postgresql-memory)
- [GCP Instance Types Comparison (DoiT)](https://gcpinstances.doit.com/)
- [e2-micro Spare Cores Benchmarks](https://sparecores.com/server/gcp/e2-micro)
- [VPSBenchmarks: Burstable CPU Performance](https://www.vpsbenchmarks.com/posts/performance_of_burstable_cpu_vm_instances)
