---
status: pending
priority: p1
issue_id: "060"
tags: [ux, error-handling, pdf]
dependencies: []
---

# PDF Download Has No Error Handling or User Feedback

## Problem Statement

The client-side `handleDownloadPDF` function does not check `res.ok` before parsing the response JSON. If the server returns 404 or 500, `pdf` will be `undefined`, and `atob(undefined)` throws a DOMException. The catch block only does `console.error` — the clinician sees no feedback that the download failed. In a clinical context, silent failures undermine trust.

## Findings

- `src/client/components/Conversation/index.tsx:164-167` — No `res.ok` check
- `src/client/components/Conversation/index.tsx:178-179` — Error only logged to console, no user-facing feedback
- The component already has a `setError` state that could be reused

## Proposed Solutions

### Option 1: Check res.ok and show error via setError (Recommended)

**Approach:**

```typescript
const handleDownloadPDF = async () => {
  setPdfLoading(true);
  try {
    const res = await fetch(`/api/conversation/${conversationId}/pdf`, {
      method: "POST",
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `PDF export failed (${res.status})`);
    }
    const { pdf } = await res.json();
    if (!pdf) throw new Error("Empty PDF response");
    // ... rest of download logic
  } catch (err) {
    console.error("PDF download failed:", err);
    setError(t("conversation.pdfError"));
  } finally {
    setPdfLoading(false);
  }
};
```

Add i18n keys:
- `en.json`: `"pdfError": "PDF download failed. Please try again."`
- `ak.json`: `"pdfError": "PDF download no yɛ. Yɛsrɛ wo bɔ mmɔden bio."`

**Effort:** 30 minutes
**Risk:** Low

## Acceptance Criteria

- [ ] Server error responses (404, 500) produce user-facing error message
- [ ] Empty/invalid PDF response produces user-facing error message
- [ ] Error message is localized (en + ak)

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)

**Actions:**
- Quality and security agents both identified missing error handling
