---
status: pending
priority: p1
issue_id: "059"
tags: [bug, pdf, types]
dependencies: []
---

# PDF Sources Render as [object Object]

## Problem Statement

The `exportPDF` controller passes `JSON.parse(conversation.assessment_sources)` to `generatePDF`, which expects `sources?: string[]`. However, `assessment_sources` stores an array of objects with shape `{ source, section, similarity, condition, confidence }`. The template renders each source as `${i + 1}. ${s}` where `s` is an object, producing `[object Object]` in every PDF's References section.

## Findings

- `src/server/controllers/conversation.ts:239` — `JSON.parse(conversation.assessment_sources)` returns `object[]`
- `src/server/services/generatePDF.ts:14` — Function signature declares `sources?: string[]`
- `src/server/services/generatePDF.ts:33` — Template uses `${s}` which calls `.toString()` on objects

## Proposed Solutions

### Option 1: Map objects to formatted strings in the controller (Recommended)

**Approach:** Transform sources to strings before passing to generatePDF.

```typescript
const rawSources = conversation.assessment_sources
  ? JSON.parse(conversation.assessment_sources)
  : undefined;
const sources = rawSources?.map((s: any) => `${s.source} — ${s.section}`);
const base64 = await generatePDF(conversation.assessment, sources);
```

**Effort:** 15 minutes
**Risk:** Low

## Acceptance Criteria

- [ ] PDF References section shows human-readable source citations, not `[object Object]`
- [ ] Sources are HTML-escaped before interpolation (see todo 057)

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)

**Actions:**
- Architecture agent identified type mismatch by tracing data flow from DB to PDF template
