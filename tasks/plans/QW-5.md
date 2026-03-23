# QW-5: Set Node.js Memory Limit + PM2 Restart Policy

**Impact:** Prevents OOM kills.
**Effort:** Low (config change)
**Risk:** Low.

## Changes

### 1. PM2 config (`deploy/ecosystem.config.cjs`)
- Add `--max-old-space-size=384` to Node args (512 if on e2-small)
- Add `max_memory_restart: "450M"`

## Done When
- [ ] `--max-old-space-size` set in PM2 config
- [ ] `max_memory_restart` set in PM2 config
