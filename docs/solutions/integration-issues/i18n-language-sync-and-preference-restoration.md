---
title: "Translation Switching Bugs - i18n Language Sync & Preference Restoration"
date: 2026-02-21
category: "integration-issues"
component:
  - "Client: Conversation Component (i18n sync on load)"
  - "Client: Home Component (language preference restoration)"
  - "Client: DemographicsForm (i18n translation keys)"
  - "Client: TextArea (disabled state during streaming)"
  - "Client: i18n config (react-i18next setup)"
  - "Client: Utils (locale-aware date formatting)"
  - "Server: Translation Service (configurable max length)"
  - "Server: Assessment Generator (bilingual output)"
  - "Server: Stream Pipeline (JSON.parse safety, assessment piping)"
  - "Server: Conversation Controller (input validation)"
  - "Server: Express Middleware (global error handler)"
  - "Server: Database (SSL support, assessment_translated column)"
severity: "High"
symptoms:
  - "Language preference resets to English on Home page return"
  - "i18n translation state not syncing on conversation load"
  - "UI strings stay in English for Twi conversations"
  - "Clinical assessment only available in English for non-English patients"
  - "Translation fails for assessment text exceeding 2000 characters"
  - "Empty or invalid message inputs trigger unhandled errors"
  - "Malformed tool call JSON causes unhandled exceptions"
  - "Users can type during active stream response"
  - "No TOS consent required before messaging"
tags:
  - "i18n"
  - "twi"
  - "translation"
  - "react-i18next"
  - "language-switching"
  - "session-storage"
  - "bilingual-assessment"
  - "input-validation"
  - "error-handling"
  - "streaming"
  - "tos-consent"
---

# Translation Switching Bugs - i18n Language Sync & Preference Restoration

## Problem Symptoms

After adding Twi (Akan) language support to Boafo, multiple translation-switching bugs surfaced:

1. Loading an existing Twi conversation showed all UI strings in English
2. Navigating back to the Home page reset the language selector to English
3. Clinical assessments were only generated in English, even for Twi-speaking patients
4. Hardcoded English strings throughout the UI (placeholders, buttons, error messages, dates)
5. Translating long assessment text failed due to a 2000-character hard limit
6. No server-side input validation on messages, demographics, or tool use IDs
7. No global Express error handler
8. Users could type during an active streaming response
9. No terms-of-service consent gate before messaging
10. `JSON.parse` on OpenAI tool call arguments had no try-catch

## Root Cause

### 1. i18n Not Synced on Conversation Load

The `i18next` library maintains its own internal language state independently of React component state. When `Conversation/index.tsx` loaded an existing conversation from the API, it called `setLanguage(data.language)` to update local React state but never called `i18n.changeLanguage()`. Since `i18next` still held `"en"` as its active locale, all `t()` translation calls continued rendering in English regardless of the conversation's stored language.

### 2. Session Language Not Restored on Home Page

The `Home` component initialized its `language` state with a plain `useState("en")` default. Every page load or navigation back to the home route reset the language selector to English, discarding any previously chosen language written to `sessionStorage`.

### 3. Assessment Generated Only in English

`generateAssessment.ts` called the Anthropic API and returned a single `text` string. It had no awareness of the conversation's language and no call to `translateText`. The result stored in the database was always English markdown, and `runStreamOpenAI.ts` passed no `language` argument to it.

### 4. Hardcoded English Strings

Placeholder text (`"Describe your symptoms..."`), button labels (`"Get Started"`), emergency disclaimer, date labels, and error messages were all raw English string literals in JSX. There was no `t()` wrapper and no corresponding keys in `ak.json`.

### 5. `translateText` Max Length Too Short for Assessments

`translate.ts` had a single module-level constant `MAX_INPUT_LENGTH = 2000`. A clinical assessment with findings, differential diagnoses, numbered plan steps, and guideline citations routinely exceeds 2,000 characters.

### 6-10. Missing Server Hardening

Input validation, error handling, streaming UX, consent gates, and JSON parsing safety were all absent from the initial implementation.

## Solution

### Fix 1: Sync i18n on Conversation Load

```ts
// src/client/components/Conversation/index.tsx — load() effect
const { data } = await axios.get(`/api/conversation/${conversationId}`);
setMessages(data.messages);
setLanguage(data.language || "en");
i18n.changeLanguage(data.language || "en");  // added — drives all t() calls
```

### Fix 2: Restore Session Language on Home Page

```ts
// src/client/components/Home/index.tsx
const [language, setLanguage] = useState(() =>
  sessionStorage.getItem("boafo-language") || "en"
);

const onLanguageChange = (lang: string) => {
  setLanguage(lang);
  i18n.changeLanguage(lang);
  sessionStorage.setItem("boafo-language", lang);
};
```

### Fix 3: Bilingual Assessment Generation

`generateAssessment.ts` now accepts a `language` parameter, generates the English assessment first, then conditionally translates it:

```ts
// src/server/services/generateAssessment.ts
let translatedText: string | null = null;
if (language !== "en" && text) {
  try {
    translatedText = await translateText(text, "en", language);
  } catch (err) {
    console.warn("[generateAssessment] Translation failed, falling back to English-only:", err);
  }
}
return { text, translatedText, sources };
```

`runStreamOpenAI.ts` passes the conversation language and threads `translatedText` through:

```ts
const { text, translatedText, sources } = await generateAssessment(
  findings, differentials, guidelineResults, language
);
await updateAssessmentMutation(conversationId, text, sources, translatedText);
meta.assessment = text;
meta.assessmentTranslated = translatedText;
```

The client renders both accordions when a translated assessment exists:

```tsx
{assessment && assessmentTranslated && (
  <>
    <Accordion title={t("conversation.assessmentTitle")} defaultOpen={true}>
      <ReactMarkdown>{assessmentTranslated}</ReactMarkdown>
    </Accordion>
    <Accordion title={t("conversation.assessmentTitleEnglish")} defaultOpen={false}>
      <ReactMarkdown>{assessment}</ReactMarkdown>
    </Accordion>
  </>
)}
```

### Fix 4: Externalize All UI Strings via i18n

All hardcoded English strings replaced with `t()` calls backed by keys in `en.json` and `ak.json`:

```tsx
// Before → After
placeholder="Describe your symptoms..."  →  placeholder={t("conversation.placeholder")}
"If this is an emergency, call 911..."   →  {t("conversation.emergency")}
"Get Started"                            →  {t("home.getStarted")}
```

### Fix 5: Configurable Max Length for `translateText`

```ts
// src/server/services/translate.ts
export async function translateText(
  text: string, from: string, to: string,
  maxLength: number = MAX_INPUT_LENGTH,  // default 2000, overridable
): Promise<string> {
  if (text.length > maxLength) {
    throw new Error(`Input exceeds maximum length of ${maxLength} characters`);
  }
  // ...
}

// Usage for long assessments:
englishContent = await translateText(fullText, language, "en", 8000);
```

### Fix 6: Server-Side Input Validation

```ts
// src/server/controllers/conversation.ts
if (typeof message !== "string" || !message.trim()) {
  return res.status(400).json({ error: "Message is required" });
}

if (typeof age !== "number" || !Number.isInteger(age) || age < 0 || age > 150) {
  return res.status(400).json({ error: "Invalid age" });
}
if (!["male", "female"].includes(biologicalSex)) {
  return res.status(400).json({ error: "Invalid biological sex" });
}
if (typeof toolUseId !== "string" || !toolUseId) {
  return res.status(400).json({ error: "Invalid tool use ID" });
}
```

### Fix 7: Global Express Error Handler

```ts
// src/server/main.ts
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error("[server]", err);
  res.status(500).json({ error: "Internal server error" });
});
```

### Fix 8: Disable Textarea During Streaming

```tsx
<TextArea
  ref={textAreaRef}
  value={message}
  onChange={setMessage}
  onSubmit={handleSend}
  placeholder={t("conversation.placeholder")}
  disabled={streaming}
/>
```

### Fix 9: TOS Consent Gate

```ts
const [tosAccepted, setTosAccepted] = useState(() =>
  sessionStorage.getItem(`boafo-tos-${conversationId}`) === "true"
);

const handleSend = async () => {
  if (!message.trim() || streaming || !tosAccepted) return;
  // ...
};
```

### Fix 10: try-catch Around JSON.parse for Tool Arguments

```ts
for (const fc of functionCalls) {
  if (!fc?.name) continue;
  let input;
  try {
    input = JSON.parse(fc.arguments);
  } catch {
    console.error(`[runStreamOpenAI] Failed to parse tool arguments for ${fc.name}`);
    continue;
  }
  const call: ToolCall = { id: randomUUID(), name: fc.name, input };
  // ...
}
```

## Investigation Steps

1. **Reproduced the UI language mismatch** by loading an existing Twi conversation and observing all `t()` strings in English. Traced `useTranslation()` calls to confirm i18next's internal locale was still `"en"`. Found no `changeLanguage` call in the Conversation component.

2. **Traced the session storage gap** by logging `sessionStorage.getItem("boafo-language")` on Home mount — it returned the correct value, but `useState("en")` ignored it.

3. **Identified English-only assessment** by examining `generateAssessment.ts` — no `language` parameter, no `translateText` call, single-field return type.

4. **Found the max length constraint** by tracing `translateText` for a long assessment string hitting the 2000-character hard limit.

5. **Audited all JSX** for raw string literals outside `t()` wrappers.

6. **Reviewed route handlers** for input guards — none existed.

7. **Checked `main.ts`** for Express error middleware — none found.

8. **Verified streaming race condition** — `TextArea` had no `disabled` binding tied to `streaming` state.

9. **Searched for TOS checkpoint** in `handleSend` — none existed.

10. **Audited `JSON.parse` calls** in `runStreamOpenAI.ts` — found unguarded parse of `fc.arguments`.

## Prevention Strategies

1. **Always sync i18n state on component mount**: Call `i18n.changeLanguage(language)` after reading language preference from storage or API. Don't assume i18n starts with the correct language just because React state has it.

2. **Persist language preference immediately**: Write language selection to sessionStorage at the moment of selection. On app load, read from storage before setting React state using lazy initializers.

3. **Use i18n keys for all user-facing text**: Replace every user-visible English string with an i18n translation key, including backend-generated clinical content.

4. **Test max length constraints with real clinical text**: When setting character limits on translation API calls, test with actual assessment text in target languages.

5. **Validate at API boundaries**: Add validation for all incoming fields before touching the database. Don't trust client-side validation alone.

6. **Add global error handling early**: Register Express error middleware before any routes are added to production.

7. **Disable input during async operations**: When streaming or performing long operations, disable textarea and buttons. Re-enable only after completion.

8. **Require consent before clinical features**: Implement TOS consent that must be accepted before users can send messages.

9. **Wrap all external JSON.parse in try-catch**: Any `JSON.parse()` call processing external data (API responses, tool outputs) must be wrapped in try-catch.

10. **Test multilingual workflows end-to-end**: Create test cases covering language change, page reload, data load, and results display — verify all text is in the correct language at each step.

## Checklist for Adding New Language Features

- [ ] Language preference is read from storage on app load
- [ ] `i18n.changeLanguage()` is called to sync i18n state after reading preference
- [ ] All user-facing text in the new workflow uses i18n translation keys
- [ ] Clinical content (assessments, results) has translation support in data structure
- [ ] Translation service API is tested with actual clinical text lengths
- [ ] All API endpoints validate input before processing
- [ ] Express error middleware catches and logs unhandled errors
- [ ] Input fields are disabled during async operations
- [ ] TOS consent is required before clinical features are accessible
- [ ] All `JSON.parse()` calls are wrapped in try-catch with error logging
- [ ] Language switching is tested with page reload to verify persistence
- [ ] New assessments or long text are tested in all supported languages
- [ ] Error messages to users are translated or language-independent

## Related Documentation

- [Twi Input Translation MVP](../integration-issues/twi-input-translation.md) — Foundation for language support. Established the initial unidirectional Twi-to-English translation pattern, language parameter handling in frontend (`sessionStorage`), and translation service integration.

- [OpenAI Streaming Conversation Engine Migration](../integration-issues/openai-streaming-conversation-engine-migration.md) — Direct parent issue. Introduced bilingual storage (`original_content`, `original_language`), bidirectional message reconstruction, and OpenAI-native language streaming. Contains open TODOs #004, #005, #006 related to language state management and switching that this fix resolves.

- [SSE Streaming Pipeline Information Disclosure](../security-issues/sse-streaming-pipeline-information-disclosure.md) — Security boundary enforcement. Established safe error message patterns that translation switching flows depend on during language negotiation and fallback behavior.

## Commits

- `4853b5d` — [fix] fix bugs in translation switching
- `287ad99` — [add] added UX changes and language support features
- `0ea8ae9` — [add] resolved streaming security issues and pending bugs
- `98ac954` — [add] added check in case message doesnt go through, make sure user is prompted to try again
- `719d4f3` — [add] added language features for twi to streamline conversations
