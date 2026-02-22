---
status: pending
priority: p2
issue_id: "064"
tags: [performance, pdf, api]
dependencies: []
---

# Stream PDF as Binary Instead of Base64 JSON

## Problem Statement

The PDF is base64-encoded into a JSON string, inflating the payload by ~33%. The client then JSON-parses, base64-decodes with the manual `atob` + `charCodeAt` pattern, and creates a Blob. This adds unnecessary complexity and bandwidth waste.

## Findings

- `src/server/services/generatePDF.ts:59` — `Buffer.from(pdf).toString("base64")`
- `src/server/controllers/conversation.ts:239` — `res.json({ pdf: base64 })`
- `src/client/components/Conversation/index.tsx:169` — `atob` + `charCodeAt` manual decode

## Proposed Solutions

### Option 1: Return binary PDF with Content-Type header (Recommended)

**Server:**
```typescript
const pdfBuffer = await generatePDF(assessment, sources);
res.setHeader("Content-Type", "application/pdf");
res.setHeader("Content-Disposition", 'attachment; filename="boafo-assessment.pdf"');
res.send(pdfBuffer);
```

**Client:**
```typescript
const res = await fetch(`/api/conversation/${conversationId}/pdf`, { method: "POST" });
const blob = await res.blob();
const url = URL.createObjectURL(blob);
```

**Effort:** 30 minutes
**Risk:** Low

## Acceptance Criteria

- [ ] Server returns `application/pdf` binary
- [ ] Client uses `res.blob()` instead of JSON + base64 decode
- [ ] PDF download works correctly in Chrome, Firefox, Safari

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
