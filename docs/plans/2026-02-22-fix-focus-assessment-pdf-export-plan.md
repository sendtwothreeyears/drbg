---
title: "fix: Textarea focus, English-only assessment, PDF export"
type: fix
status: active
date: 2026-02-22
---

# Fix: Textarea Focus, English-Only Assessment, PDF Export

## Overview

Three changes to the conversation experience: (1) auto-focus textarea after AI responses, (2) remove assessment translation for speed — English-only with localized CTA, (3) add PDF download and email icons to the assessment accordion.

## Problem Statement / Motivation

- **Focus**: After AI finishes streaming, focus does not return to the textarea — users must click to type again, breaking conversational flow.
- **Assessment speed**: The full assessment pipeline (guideline retrieval + Sonnet generation + translation) is slow. Translation is a removable bottleneck since the assessment targets clinicians who read English.
- **PDF/Email**: Users have no way to export or share the assessment with their doctor. Adding download and email actions makes the assessment actionable.

---

## Bug #1: Textarea Focus Management

### Root Cause

In `src/client/components/Conversation/index.tsx`, focus is set on mount (~line 195) and when stream completes without diagnoses (~line 94), but there is no consistent focus restoration after every completed AI response, especially after assessment generation completes.

### Proposed Fix

Add a `useEffect` that watches `streaming` state — when it transitions from `true` to `false`, focus the textarea. Gate it so focus goes to the demographics form's age input when that form is visible, not the textarea.

### Focus Flow

1. User sends message → textarea disabled during streaming
2. AI finishes streaming → `streaming` set to `false` → `useEffect` fires → `textAreaRef.current?.focus()`
3. **Exception**: If demographics form is visible, skip textarea focus (demographics form handles its own autofocus on the age input via `DemographicsForm.tsx:15-17`)
4. After demographics form is submitted and disappears → textarea focus resumes on next render cycle

### Implementation

**`src/client/components/Conversation/index.tsx`**

```tsx
// Add useEffect after existing refs/state declarations (~line 50)
const prevStreamingRef = useRef(streaming);

useEffect(() => {
  // Focus textarea when streaming ends, unless demographics form is showing
  if (prevStreamingRef.current && !streaming && !showDemographicsForm) {
    textAreaRef.current?.focus();
  }
  prevStreamingRef.current = streaming;
}, [streaming, showDemographicsForm]);
```

Also add a focus call when demographics form is dismissed:

```tsx
// In the demographics submit handler, after setShowDemographicsForm(false):
setTimeout(() => textAreaRef.current?.focus(), 0);
```

### Acceptance Criteria

- [x] After every AI response completes, textarea is focused and user can immediately type
- [x] When demographics form appears, focus goes to the age input (not textarea)
- [x] After demographics form is submitted, focus returns to textarea
- [x] Error states (stream error) also return focus to textarea

---

## Bug #2: English-Only Assessment + Localized CTA

### Root Cause

`src/server/services/generateAssessment.ts:92-99` translates the assessment when language !== "en", adding latency. The dual-accordion pattern in `Conversation/index.tsx:338-358` renders both translated and English versions.

### Proposed Fix

Remove the translation call. Render a single English accordion. For non-English users, show a localized CTA message below the assessment directing them to download/email the PDF.

### Implementation

**Server-side:**

**`src/server/services/generateAssessment.ts`** (~lines 92-99)

Remove the translation block:

```diff
- if (language !== "en" && text) {
-   try {
-     translatedText = await translateText(text, "en", language, 8000);
-   } catch (e) {
-     console.error("[generateAssessment] translation failed:", e);
-   }
- }
```

Return `translatedText` as `null` always.

**`src/server/services/runStreamOpenAI.ts`** (~line 275)

Stop setting `meta.assessmentTranslated`:

```diff
- meta.assessmentTranslated = translatedText;
```

**Client-side:**

**`src/client/components/Conversation/index.tsx`**

1. Remove `assessmentTranslated` state (~line 40)
2. Remove `setAssessmentTranslated` calls (~lines 91, 192)
3. Replace dual-accordion block (~lines 338-358) with single accordion:

```tsx
{assessment && (
  <Accordion title={t("assessmentTitle")} defaultOpen>
    <ReactMarkdown>{assessment}</ReactMarkdown>
    {language !== "en" && (
      <p className="mt-4 text-sm text-gray-600 italic">
        {t("assessmentCTA")}
      </p>
    )}
  </Accordion>
)}
```

**i18n files:**

Add `assessmentCTA` key:

- `en.json`: `"assessmentCTA": "You can download this assessment as a PDF or email it to your doctor using the icons above."`
- `ak.json`: `"assessmentCTA": "Wubɛtumi a-download saa nhwehwɛmu yi sɛ PDF anaasɛ wo de email abrɛ wo dɔkota denam icons a ɛwɔ soro no so."` (Twi equivalent)

Remove `assessmentTitleEnglish` key from both files if it exists.

**Database:** Leave `assessment_translated` column in schema — just stop writing to it.

### Acceptance Criteria

- [x] Assessment is generated in English only (no `translateText` call)
- [x] Single accordion displays the English assessment
- [x] Non-English users see a localized CTA message below the assessment
- [x] Existing conversations with translated assessments still load (column ignored, not deleted)
- [x] Assessment generation is noticeably faster for non-English conversations

---

## Feature #1: PDF Download + Email Icons on Accordion

### Architecture

```
Client                          Server
──────                          ──────
Click download icon
  → POST /api/conversation/:id/pdf
     { assessment, sources }
                                → generatePDF.ts
                                  → Puppeteer renders HTML → PDF
                                  → Returns base64
  ← { pdf: "base64..." }
  → Create Blob, trigger download

Click email icon
  → window.open(mailto:?subject=...)
  → User attaches downloaded PDF manually
```

### Implementation

#### Phase 1: Accordion Header Actions

**`src/client/shared/Accordion/index.tsx`**

Add optional `headerActions` prop:

```tsx
interface AccordionProps {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  headerActions?: React.ReactNode;  // NEW
  children: React.ReactNode;
}
```

Render actions to the left of the chevron, with `e.stopPropagation()` to prevent toggling:

```tsx
<button onClick={() => setIsOpen(!isOpen)} className="...">
  <span>{title}</span>
  {subtitle && <span>{subtitle}</span>}
  <div className="flex items-center gap-2">
    {headerActions && (
      <span onClick={(e) => e.stopPropagation()}>
        {headerActions}
      </span>
    )}
    <ChevronIcon />
  </div>
</button>
```

#### Phase 2: PDF Generation Service

**New file: `src/server/services/generatePDF.ts`**

Adapted from existing KasaMD implementation at `/Users/Shared/Code/KasaMD/server/graphql/resolvers/session.ts:337-455`:

```typescript
import puppeteer from "puppeteer";
import { readFileSync } from "fs";
import path from "path";
import { marked } from "marked";

function getLogoDataUri(): string {
  const logoPath = path.resolve(__dirname, "../../../assets/kasagreen.png");
  const buffer = readFileSync(logoPath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function generatePDF(
  assessmentMarkdown: string,
  sources?: string[]
): Promise<string> {
  const logoUri = getLogoDataUri();
  const htmlContent = marked(assessmentMarkdown);

  const html = `<!DOCTYPE html>
    <html><head><meta charset="utf-8">
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; line-height: 1.5; padding: 40px; color: #1f2937; }
      h1 { font-size: 22px; color: #065f46; }
      h2 { font-size: 18px; color: #065f46; margin-top: 24px; }
      h3 { font-size: 15px; margin-top: 16px; }
      p { margin: 8px 0; }
      ul, ol { margin: 8px 0 8px 20px; }
      .sources { margin-top: 30px; border-top: 1px solid #d1d5db; padding-top: 16px; }
      .source { font-size: 12px; color: #6b7280; margin: 4px 0; }
    </style></head>
    <body>
      ${htmlContent}
      ${sources?.length ? `<div class="sources"><h3>References</h3>${sources.map((s, i) => `<div class="source">${i + 1}. ${s}</div>`).join("")}</div>` : ""}
    </body></html>`;

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdf = await page.pdf({
    format: "letter",
    margin: { top: "0.5in", right: "0.5in", bottom: "0.75in", left: "0.5in" },
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `
      <div style="display:flex; width:100%; justify-content:center; align-items:center; font-size:10px; padding:0 0.5in; opacity:0.7;">
        <span>Generated by</span>
        <img src="${logoUri}" style="height:16px; margin:0 4px;" />
        <span>Boafo • ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}</span>
      </div>`,
  });

  await browser.close();
  return Buffer.from(pdf).toString("base64");
}
```

#### Phase 3: Server Endpoint

**`src/server/routes/conversation.ts`** — Add route:

```typescript
router.post("/conversation/:conversationId/pdf", (req, res) => {
  conversationService.exportPDF(req, res);
});
```

**`src/server/controllers/conversation.ts`** — Add method:

```typescript
async exportPDF(req: Request<{ conversationId: string }>, res: Response) {
  const { conversationId } = req.params;

  try {
    const conversation = await getConversationQuery(conversationId);
    if (!conversation?.assessment) {
      return res.status(404).json({ error: "No assessment found" });
    }

    const base64 = await generatePDF(
      conversation.assessment,
      conversation.assessment_sources ? JSON.parse(conversation.assessment_sources) : undefined
    );

    res.json({ pdf: base64 });
  } catch (error) {
    console.error("[exportPDF] error:", error);
    res.status(500).json({ error: "PDF generation failed" });
  }
}
```

#### Phase 4: Client Download + Email Handlers

**`src/client/components/Conversation/index.tsx`**

```tsx
const handleDownloadPDF = async () => {
  setPdfLoading(true);
  try {
    const res = await fetch(`/api/conversation/${conversationId}/pdf`, {
      method: "POST",
    });
    const { pdf } = await res.json();
    const blob = new Blob(
      [Uint8Array.from(atob(pdf), (c) => c.charCodeAt(0))],
      { type: "application/pdf" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "boafo-assessment.pdf";
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error("PDF download failed:", err);
  } finally {
    setPdfLoading(false);
  }
};

const handleEmail = () => {
  const subject = encodeURIComponent("Boafo AI Clinical Assessment");
  const body = encodeURIComponent(
    "Please find the attached clinical assessment generated by Boafo AI.\n\nNote: Please download the PDF using the download button and attach it to this email."
  );
  window.open(`mailto:?subject=${subject}&body=${body}`);
};
```

Pass to Accordion:

```tsx
<Accordion
  title={t("assessmentTitle")}
  defaultOpen
  headerActions={
    <>
      <button onClick={handleDownloadPDF} disabled={pdfLoading} title={t("downloadPDF")}>
        {pdfLoading ? <Spinner size="sm" /> : <DownloadIcon />}
      </button>
      <button onClick={handleEmail} title={t("emailAssessment")}>
        <EmailIcon />
      </button>
    </>
  }
>
```

### Dependencies

- `puppeteer` — new npm dependency for server-side PDF generation
- `marked` — new npm dependency to convert assessment markdown → HTML for Puppeteer (unless already available)
- `assets/kasagreen.png` — Kasa logo for PDF footer (verify path exists in Boafo or copy from parent project)

### Acceptance Criteria

- [x] Download icon in accordion header generates and downloads a styled PDF
- [x] PDF includes assessment content, sources/references, Kasa branded footer with logo
- [x] Email icon opens default email client with pre-filled subject and body
- [x] Icons do not trigger accordion open/close
- [x] Loading spinner shows while PDF generates
- [x] Works for all assessments (short and long)

---

## Technical Considerations

- **Puppeteer cold start**: First PDF request will be slower (~2-3s). Subsequent requests are faster. Acceptable for infrequent use.
- **Puppeteer in production**: May need `puppeteer-core` + system Chromium depending on deployment environment. For now, `puppeteer` (bundled Chromium) is simplest.
- **Backward compatibility**: Existing conversations with `assessment_translated` in the DB will still load — the column is just ignored, not deleted.
- **Asset path**: Verify `assets/kasagreen.png` exists in Boafo project root or copy from `/Users/Shared/Code/KasaMD/assets/kasagreen.png`.

## Success Metrics

- Textarea is always focused after AI response (zero extra clicks to continue typing)
- Assessment generation is faster for non-English conversations (no translation wait)
- Users can download assessment as PDF in one click

## Implementation Order

1. **Bug #1: Textarea Focus** — smallest scope, immediate UX improvement
2. **Bug #2: English-Only Assessment** — removes translation, simplifies accordion rendering
3. **Feature #1: PDF Export** — builds on the simplified single-accordion from Bug #2

## References

- Brainstorm: `docs/brainstorms/2026-02-22-focus-assessment-pdf-brainstorm.md`
- Existing Puppeteer PDF: `/Users/Shared/Code/KasaMD/server/graphql/resolvers/session.ts:337-455`
- Assessment translation fix: `docs/solutions/integration-issues/tos-persistence-assessment-translation-demographics-timing.md`
- i18n patterns: `docs/solutions/integration-issues/i18n-language-sync-and-preference-restoration.md`
