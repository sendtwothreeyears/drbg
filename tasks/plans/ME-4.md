# ME-4: PostgreSQL Tuning

**Impact:** Better cache hit ratio, fewer disk reads for pgvector queries.
**Effort:** Low (config file)
**Risk:** Low.

## Changes
For e2-micro: `shared_buffers=128MB`, `effective_cache_size=512MB`, `work_mem=4MB`, `max_connections=20`
For e2-small: `shared_buffers=512MB`, `effective_cache_size=1.5GB`, `work_mem=16MB`, `max_connections=20`

Apply via `setup-vm.sh` or a new `deploy/postgresql.conf` template.

## Done When
- [ ] PostgreSQL config tuned for instance size
- [ ] Config applied via deploy script
