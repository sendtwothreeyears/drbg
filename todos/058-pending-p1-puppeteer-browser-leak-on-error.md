---
status: pending
priority: p1
issue_id: "058"
tags: [reliability, pdf, puppeteer, resource-leak]
dependencies: []
---

# Puppeteer Browser Process Leak on Error

## Problem Statement

In `generatePDF`, if any operation between `puppeteer.launch()` and `browser.close()` throws an exception (e.g., `page.setContent()` fails on malformed HTML, `page.pdf()` times out), `browser.close()` is never called. Each leaked Chromium process consumes ~100-300MB of RAM. Under repeated error conditions, the server will accumulate zombie processes until it is OOM-killed.

## Findings

- `src/server/services/generatePDF.ts:36-58` — No try/finally wrapping `browser.close()`
- The controller's catch block (conversation.ts:245) catches the error and returns 500, but the Chromium process is already orphaned

## Proposed Solutions

### Option 1: Wrap in try/finally (Recommended)

**Approach:** Guarantee browser cleanup regardless of success or failure.

```typescript
const browser = await puppeteer.launch({
  headless: true,
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});

try {
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });
  const pdf = await page.pdf({ ... });
  return Buffer.from(pdf).toString("base64");
} finally {
  await browser.close();
}
```

**Effort:** 15 minutes
**Risk:** Low

## Acceptance Criteria

- [ ] `browser.close()` is called in a `finally` block
- [ ] Verified that errors in `page.setContent()` and `page.pdf()` do not leak Chromium processes

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)

**Actions:**
- Identified missing cleanup pattern in generatePDF
- All 4 review agents independently flagged this issue
