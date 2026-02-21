---
status: pending
priority: p3
issue_id: "011"
tags: [security, logging, phi]
dependencies: []
---

# Full error objects (may contain PHI) logged to console

## Problem Statement

`console.error("Translation failed:", error)` logs the entire error object. OpenAI SDK errors can contain the request body (patient symptom text). In production with centralized logging, PHI could appear in log aggregation services.

## Findings

- `src/server/controllers/conversation.ts:102,122` — logs full error object

## Proposed Solutions

### Option 1: Log only error message

```typescript
console.error("Translation failed:", error instanceof Error ? error.message : "Unknown error");
```

**Effort:** 5 minutes

## Technical Details

**Affected files:**
- `src/server/controllers/conversation.ts:102,122`
