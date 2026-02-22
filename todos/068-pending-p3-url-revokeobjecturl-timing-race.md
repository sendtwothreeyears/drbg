---
status: pending
priority: p3
issue_id: "068"
tags: [bug, pdf, browser-compat]
dependencies: []
---

# URL.revokeObjectURL Called Immediately May Race with Download

## Problem Statement

In `handleDownloadPDF`, `URL.revokeObjectURL(url)` is called synchronously right after `a.click()`. Some browsers (particularly Firefox) may not have finished reading from the blob URL by the time it is revoked, resulting in a failed download.

## Findings

- `src/client/components/Conversation/index.tsx:177` — `URL.revokeObjectURL(url)` immediately after `a.click()`

## Proposed Solutions

### Option 1: Defer revocation with setTimeout (Recommended)

```typescript
a.click();
setTimeout(() => URL.revokeObjectURL(url), 10000);
```

**Effort:** 5 minutes | **Risk:** Low

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
