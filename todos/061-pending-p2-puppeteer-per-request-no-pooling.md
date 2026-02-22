---
status: pending
priority: p2
issue_id: "061"
tags: [performance, pdf, puppeteer]
dependencies: ["058"]
---

# Puppeteer Launches New Chromium Per Request

## Problem Statement

Every call to `generatePDF` spawns a full Chromium browser process (~100-300MB). Under concurrent load (5-10 simultaneous PDF requests), the server will exhaust memory. There is no pooling, no concurrency limit, and no reuse. The `puppeteer` package also adds ~400MB+ to the deployment artifact due to the bundled Chromium binary.

## Findings

- `src/server/services/generatePDF.ts:36` — `puppeteer.launch()` called on every invocation
- `package.json` — `puppeteer` v24.37.5 bundles full Chromium
- No concurrency limiting anywhere in the route chain

## Proposed Solutions

### Option 1: Singleton browser with page pooling (Recommended)

**Approach:** Launch browser once at startup, reuse it across requests, create/close pages per request. Add a concurrency semaphore.

**Effort:** 2-3 hours
**Risk:** Medium (need to handle browser crash recovery)

### Option 2: Replace Puppeteer with lightweight PDF library

**Approach:** Use `pdfkit` or `pdf-lib` to generate PDFs without a browser. The assessment is mostly headings, paragraphs, and lists.

**Effort:** 4-6 hours
**Risk:** Medium (need to replicate styling)

## Acceptance Criteria

- [ ] PDF generation does not launch a new browser per request
- [ ] Concurrent PDF requests are bounded (e.g., max 3 simultaneous)
- [ ] Server memory usage stays stable under repeated PDF generation

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
