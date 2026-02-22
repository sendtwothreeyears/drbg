---
status: pending
priority: p1
issue_id: "057"
tags: [security, pdf, puppeteer, xss]
dependencies: []
---

# Server-Side HTML Injection in Puppeteer PDF Generation

## Problem Statement

The `generatePDF` function converts assessment markdown to HTML using `marked()` with no sanitization, then renders it in a server-side Chromium instance via Puppeteer. This creates a compound vulnerability:

1. **HTML Injection via marked()**: `marked` v17 does not sanitize output by default. If the AI-generated assessment or a future input pipeline produces markdown containing HTML/script tags, it will execute in the Chromium context.
2. **SSRF via networkidle0**: The `waitUntil: 'networkidle0'` option means Chromium will follow any network requests embedded in the HTML (e.g., `<img src="http://169.254.169.254/">` for cloud metadata).
3. **No sandbox**: `--no-sandbox` + `--disable-setuid-sandbox` means Chromium has no process isolation — any code execution in the renderer has full server process privileges.
4. **Sources array unescaped**: The `sources` parameter is interpolated into HTML via `${s}` with no HTML escaping, providing a second injection point.

Combined, an attacker who can influence assessment text (via crafted symptom input leading to prompt injection in the AI output) could achieve SSRF or information disclosure from the server.

## Findings

- `src/server/services/generatePDF.ts:17` — `marked(assessmentMarkdown)` output injected directly into HTML template
- `src/server/services/generatePDF.ts:33` — Sources interpolated without HTML escaping
- `src/server/services/generatePDF.ts:38` — `--no-sandbox` disables Chromium security sandbox
- `src/server/services/generatePDF.ts:42` — `waitUntil: 'networkidle0'` enables outbound requests from rendered HTML

## Proposed Solutions

### Option 1: Sanitize HTML + Block Network + Disable JS (Recommended)

**Approach:** Multi-layered defense: sanitize marked output, intercept network requests, disable JavaScript in Puppeteer page.

```typescript
import sanitizeHtml from 'sanitize-html';

// Sanitize marked output
const rawHtml = marked(assessmentMarkdown);
const htmlContent = sanitizeHtml(rawHtml, {
  allowedTags: sanitizeHtml.defaults.allowedTags.concat(['h1', 'h2', 'h3']),
  allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes },
});

// HTML-escape sources
function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// In page setup:
await page.setJavaScriptEnabled(false);
await page.setRequestInterception(true);
page.on('request', (req) => {
  if (req.url().startsWith('data:')) req.continue();
  else req.abort();
});
```

**Effort:** 1-2 hours
**Risk:** Low

## Acceptance Criteria

- [ ] HTML output from `marked()` is sanitized before injection into Puppeteer
- [ ] Sources array values are HTML-entity-escaped
- [ ] JavaScript is disabled in the Puppeteer page
- [ ] Outbound network requests from Puppeteer are blocked via request interception
- [ ] `waitUntil` changed from `networkidle0` to `domcontentloaded`
- [ ] Chromium sandbox flags documented with rationale

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)

**Actions:**
- Identified compound vulnerability: HTML injection + no sandbox + SSRF via networkidle0
- Cross-referenced with past security fix (SSE streaming pipeline information disclosure)

**Learnings:**
- Defense in depth: sanitize at every layer (input, rendering, network)
- Puppeteer `--no-sandbox` is a known footgun — must be paired with other mitigations
