---
title: "TOS Persistence, Assessment Translation, and Demographics Timing Fixes"
date: 2026-02-21
category: "integration-issues"
component:
  - "Client: Conversation Component (TOS conditional render)"
  - "Client: i18n Config (sessionStorage language initialization)"
  - "Server: Conversation Controller (tool selection)"
  - "Server: OpenAI Streaming Pipeline (tool calling, differentials guard)"
  - "Server: Translation Service (max_tokens, maxLength limits)"
  - "Server: Assessment Generator (translation integration)"
severity: "Medium"
symptoms:
  - "TOS checkbox persists in UI after user has already accepted terms of service"
  - "i18n language resets to English on page refresh despite prior Twi selection"
  - "Assessment translation fails silently for text exceeding 2000 characters"
  - "Demographics collection tool fires immediately without a warm greeting message"
  - "max_tokens capped at 1024 truncates translated assessment output"
tags:
  - "tos"
  - "i18n"
  - "twi"
  - "translation"
  - "session-storage"
  - "openai"
  - "tool-calling"
  - "demographics"
  - "assessment"
  - "streaming"
  - "conditional-render"
  - "token-limits"
---

# TOS Persistence, Assessment Translation, and Demographics Timing Fixes

## Problem Symptoms

Four independent bugs were identified affecting the Boafo conversation UX and clinical assessment pipeline:

1. **TOS checkbox persisted after acceptance** — After a user checked the Terms of Service checkbox, it remained visible in the conversation input area for the entire session, cluttering the interface.

2. **i18n language reset on page refresh** — Selecting Twi as the language, then refreshing: the toggle correctly showed "Twi" (from sessionStorage), but all `t()` translated strings rendered in English because i18next's internal locale was never updated from storage at init time.

3. **Assessment translation failed for non-English languages** — Clinical assessments exceeding 2000 characters could not be translated. The translation service either threw a length error or truncated the output mid-sentence due to a 1024 max_tokens limit.

4. **Demographics form appeared immediately without greeting** — After a patient's chief complaint, the demographics form rendered instantly with no conversational opening. The AI jumped straight to the tool call, producing an abrupt and impersonal experience.

## Root Cause

### Bug 1: Unconditional TOS Render

The `<label>` containing the TOS checkbox in `src/client/components/Conversation/index.tsx` was always rendered in the JSX tree. The `tosAccepted` state correctly persisted to sessionStorage but the UI had no conditional guard to hide the checkbox once accepted.

### Bug 2: Hardcoded i18n Language

`src/client/i18n/config.ts` hardcoded `lng: "en"` during i18next initialization. The Home component wrote the language preference to sessionStorage but i18next never read it back at startup — it only received `changeLanguage()` calls from user interaction handlers.

### Bug 3: Fixed Translation Limits

Two compounding issues:
- `translateText()` in `src/server/services/translate.ts` had a default `maxLength` of 2000 characters. Clinical assessments routinely exceed this.
- `max_tokens` was set to 1024, insufficient for translating long clinical text into non-Latin scripts like Twi.

### Bug 4: Forced Single Tool

`src/server/controllers/conversation.ts` set `toolName = "collect_demographics"` when no profile existed, which was passed to `runStreamOpenAI`. With only one tool available, the AI had no option to produce conversational text first — it jumped directly to the tool call. The system prompt instructed the AI to greet the patient first, but the forced tool override prevented it from following those instructions.

## Solution

### Fix 1: Conditional TOS Checkbox Render

Wrapped the TOS `<label>` in a conditional guard so it unmounts from the DOM once accepted.

**Before** (`src/client/components/Conversation/index.tsx`):
```tsx
<label className="flex items-start gap-2 px-1 mb-2 cursor-pointer">
  <input type="checkbox" checked={tosAccepted} onChange={(e) => { ... }} className="mt-1 shrink-0" />
  <span className="font-fakt text-xs text-gray-500">
    <Trans i18nKey="tos.consent" components={{ ... }} />
  </span>
</label>
```

**After:**
```tsx
{!tosAccepted && (
  <label className="flex items-start gap-2 px-1 mb-2 cursor-pointer">
    <input type="checkbox" checked={tosAccepted} onChange={(e) => { ... }} className="mt-1 shrink-0" />
    <span className="font-fakt text-xs text-gray-500">
      <Trans i18nKey="tos.consent" components={{ ... }} />
    </span>
  </label>
)}
```

### Fix 2: Read sessionStorage at i18n Init

Replaced the hardcoded language with an expression that reads the persisted preference at module evaluation time.

**Before** (`src/client/i18n/config.ts`, line 12):
```ts
lng: "en",
```

**After:**
```ts
lng: (typeof sessionStorage !== "undefined" && sessionStorage.getItem("boafo-language")) || "en",
```

The `typeof` guard prevents a `ReferenceError` if the module is evaluated in a non-browser context (SSR, tests).

### Fix 3: Increase Translation Limits

Two changes to handle assessment-length clinical text:

**`src/server/services/generateAssessment.ts` (line 95):**
```ts
// Before:
translatedText = await translateText(text, "en", language);

// After — pass 8000 maxLength for assessment text:
translatedText = await translateText(text, "en", language, 8000);
```

**`src/server/services/translate.ts` (line 53):**
```ts
// Before:
max_tokens: 1024,

// After — sufficient for long non-Latin translations:
max_tokens: 4096,
```

The default `maxLength` of 2000 remains unchanged for short user message translations. Only assessment and AI response paths pass the 8000 override.

### Fix 4: Natural Demographics Flow with Server Guard

Three changes across two files:

**Step 1 — Stop forcing a single tool** (`src/server/controllers/conversation.ts`):
```ts
// Before:
if (!profile) {
  toolName = "collect_demographics";

// After — let AI acknowledge patient first:
if (!profile) {
  toolName = undefined;
```

**Step 2 — Provide all tools when none is forced** (`src/server/services/runStreamOpenAI.ts`):
```ts
// Before:
const tool = toolName ? openaiTools[toolName] : undefined;
const stream = await createOpenAIChatStream(messages, systemPrompt, tool ? [tool] : undefined);

// After — all tools available for AI to choose:
const allTools = Object.values(openaiTools);
const tools = toolName
  ? [openaiTools[toolName]]
  : allTools.length > 0
    ? allTools
    : undefined;
const stream = await createOpenAIChatStream(messages, systemPrompt, tools);
```

**Step 3 — Server-side guard on differentials** (`src/server/services/runStreamOpenAI.ts`):
```ts
if (differentialsCall) {
  // Safety guard: don't generate differentials without patient demographics
  const profile = await getProfileByConversationQuery(conversationId);
  if (!profile) {
    console.warn("[runStreamOpenAI] AI called generate_differentials without demographics — skipping");
  } else {
    // ... process differentials, assessment, guidelines
  }
}
```

This ensures that even if the AI ignores the system prompt and calls `generate_differentials` prematurely, the server blocks it.

## Investigation Steps

1. **TOS persistence:** Observed checkbox remained visible after clicking. Inspected `Conversation/index.tsx` — found the `<label>` rendered without any conditional wrapper despite `tosAccepted` state being tracked.

2. **i18n reset:** Observed English UI after refresh despite Twi selection. Traced `sessionStorage.getItem("boafo-language")` — it returned the correct value, but `i18n/config.ts` had `lng: "en"` hardcoded, never reading the stored value.

3. **Assessment translation:** Checked server logs after a Twi conversation assessment attempt. Found `"Translation failed, falling back to English-only"` warning. Traced to `translateText()` default `maxLength: 2000` and `max_tokens: 1024` — both too small for clinical assessments.

4. **Demographics timing:** Observed immediate tool call with no greeting in new conversations. Traced from `conversation.ts:63` where `toolName = "collect_demographics"` was forced, through to `runStreamOpenAI.ts` where only that single tool was passed to OpenAI, preventing any text generation before the tool call.

## Prevention Strategies

### 1. Conditional Rendering for Stateful UI

Treat every stateful UI element as having a lifecycle tied to its governing condition. Before implementing any component that depends on a boolean state (accepted/pending, visible/hidden), define the full state matrix: what renders in each state, what does not. Use conditional rendering (`{condition && <Component />}`) rather than CSS hiding for components that should be absent from the DOM after a state transition.

### 2. Initialization Must Respect Persistence

Any subsystem that stores user preferences must read those preferences back at startup. Hardcoded defaults should be the last resort in a clearly defined fallback chain: (1) check persisted store (sessionStorage/localStorage), (2) check detected value (browser locale), (3) hardcoded default. Document this chain at the initialization site.

### 3. Configurable, Not Hardcoded Limits

Never hardcode capacity limits for operations that process variable-length content. Make limits configurable with sensible defaults. For any service processing clinical text (translation, summarization, LLM calls), test with the longest realistic content the system will encounter — not just short sample strings.

### 4. Guide the AI, Don't Force It; Then Verify on the Server

Use `tool_choice: "auto"` as the default to preserve the model's contextual reasoning. When specific tool invocation is critical, implement server-side precondition checks rather than client-side forcing. This defense-in-depth approach lets the AI make contextually appropriate decisions while the server validates preconditions before executing tool actions.

## Checklist for Similar Changes

### UI State and Rendering
- [ ] Every stateful UI element is conditionally rendered based on its governing state
- [ ] Components that have fulfilled their purpose are fully unmounted from the DOM

### Persistence and Initialization
- [ ] Library initialization reads persisted user preferences before falling back to defaults
- [ ] A test simulates page refresh and verifies persisted preferences are restored
- [ ] Any new sessionStorage key has a corresponding read at initialization time

### External Service Limits
- [ ] All processing limits (maxLength, max_tokens, timeouts) are configurable
- [ ] Default limits are validated against maximum realistic input sizes
- [ ] The system logs a warning when inputs approach or exceed limits

### AI Tool Orchestration
- [ ] `tool_choice` is `"auto"` unless there is a documented reason to force a specific tool
- [ ] Server-side guards validate preconditions before executing tool actions
- [ ] Changes to tool configuration include end-to-end conversation flow testing

## Related Documentation

- [i18n Language Sync & Preference Restoration](./i18n-language-sync-and-preference-restoration.md) — Covers the broader i18n architecture including Fix #2 context. Established patterns for language persistence, `changeLanguage()` sync, and bilingual assessment display.

- [OpenAI Streaming Conversation Engine Migration](./openai-streaming-conversation-engine-migration.md) — Parent architecture for the streaming pipeline. Introduced tool calling for demographics and differentials, bilingual storage columns, and the `runStreamOpenAI` service.

- [Twi Input Translation MVP](./twi-input-translation.md) — Foundation for language support. Established the `translateText()` service, `sessionStorage` persistence pattern, and input length validation.

- [SSE Streaming Pipeline Information Disclosure](../security-issues/sse-streaming-pipeline-information-disclosure.md) — Security boundary enforcement. Error message sanitization patterns that this fix's streaming changes depend on.

- [Bug Fixes Brainstorm](../../brainstorms/2026-02-21-bug-fixes-brainstorm.md) — Root cause analysis document for all four bugs.

- [Implementation Plan](../../plans/2026-02-21-fix-tos-i18n-assessment-demographics-bugs-plan.md) — Detailed plan with acceptance criteria, implementation steps, and risk notes.

## Commits

- `d5e3b9f` — [fix] TOS persistence, i18n sync, assessment translation, demographics timing
