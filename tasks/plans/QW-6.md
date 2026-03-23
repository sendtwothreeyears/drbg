# QW-6: Reduce pg.Pool Connections + Add Pool Config

**Impact:** Frees ~25-50MB RAM from idle connections.
**Effort:** Low
**Risk:** Low.

## Changes

### 1. Pool config (`src/server/db/pool.ts`)
```typescript
const pool = new Pool({
  ...existingConfig,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});
```

## Done When
- [ ] Pool max set to 5
- [ ] Idle timeout configured
- [ ] Connection timeout configured
