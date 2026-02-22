---
status: pending
priority: p3
issue_id: "069"
tags: [code-quality, ui]
dependencies: []
---

# Extract Inline SVGs to Shared Icon Components

## Problem Statement

Three new inline SVGs (spinner, download, email) are embedded directly in Conversation/index.tsx JSX. Combined with the existing chevron SVG in Accordion, there are 5+ inline SVGs across 2 files. This bloats components and makes icon consistency harder to maintain.

## Findings

- `src/client/components/Conversation/index.tsx:390-409` — Spinner, download, email SVGs
- `src/client/shared/Accordion/index.tsx:34-45` — Chevron SVG

## Proposed Solutions

### Option 1: Create src/client/shared/Icons/ directory

Extract each SVG into a memoized functional component. Low priority but improves readability.

**Effort:** 30 minutes | **Risk:** Low

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
