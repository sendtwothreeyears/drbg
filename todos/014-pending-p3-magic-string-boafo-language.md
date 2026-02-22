---
status: pending
priority: p3
issue_id: "014"
tags: [maintainability, frontend]
dependencies: []
---

# sessionStorage key "boafo-language" duplicated as magic string

## Problem Statement

The storage key `"boafo-language"` appears in 3 places across 2 files. If one is changed without the others, persistence breaks silently.

## Findings

- `src/client/components/Home/index.tsx:64`
- `src/client/components/Conversation/index.tsx:42,50`

## Proposed Solutions

Extract to a shared constant (e.g., `src/client/constants.ts`).

**Effort:** 5 minutes

## Technical Details

**Affected files:**
- `src/client/components/Home/index.tsx`
- `src/client/components/Conversation/index.tsx`
