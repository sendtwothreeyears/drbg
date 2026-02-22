---
status: pending
priority: p2
issue_id: "063"
tags: [performance, pdf]
dependencies: []
---

# Cache Logo Data URI at Module Load

## Problem Statement

`getLogoDataUri()` calls `readFileSync()` and re-encodes the 4.5KB PNG to base64 on every PDF generation call. This is unnecessary I/O for a static asset that never changes at runtime, and `readFileSync` blocks the event loop.

## Findings

- `src/server/services/generatePDF.ts:6-10` — `readFileSync` called per invocation

## Proposed Solutions

### Option 1: Module-level constant (Recommended)

```typescript
const LOGO_DATA_URI = (() => {
  const buf = readFileSync(path.resolve(__dirname, "../../../assets/kasagreen.png"));
  return `data:image/png;base64,${buf.toString("base64")}`;
})();
```

**Effort:** 10 minutes
**Risk:** Low

## Acceptance Criteria

- [ ] Logo is read and encoded once at module load
- [ ] `getLogoDataUri` function removed

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
