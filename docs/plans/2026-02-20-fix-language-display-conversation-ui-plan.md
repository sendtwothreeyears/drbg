---
title: "Fix Language Display & Selector Bugs in Conversation UI"
type: fix
status: completed
date: 2026-02-20
brainstorm: docs/brainstorms/2026-02-20-language-display-fixes-brainstorm.md
---

# Fix Language Display & Selector Bugs in Conversation UI

## Overview

Twi conversations are broken: messages render in English, the language selector stays interactive mid-conversation (allowing state mismatch), and the system prompt hardcodes `"ak"`. This plan fixes the bugs, adds a read-only language badge, and makes the system prompt language-generic.

## Problem Statement

Three interconnected issues prevent Twi from working:

1. **Messages display in English** — `renderMessages()` calls `getDisplayText(msg.content)` which always shows the English translation. The `original_content` field (Twi) is returned from the API but never rendered.

2. **Language selector active mid-conversation** — `LanguageSelector` is interactive on the conversation page, letting users change language after it's locked at creation time. This desynchronizes frontend state (sessionStorage) from backend state (DB).

3. **Hardcoded language check** — `runStreamOpenAI.ts:18` checks `language === "ak"` for the Twi system prompt. Adding any new language requires a code change.

**Root cause:** The conversation API doesn't return the `language` field, so the frontend has no way to know the conversation's language and falls back to sessionStorage.

## Proposed Solution

Four changes, all minimal and non-breaking:

1. **Return `language` from API** — Add `language` field to `getConversationAndMessages` response
2. **Display `original_content`** — Show Twi text when available, fall back to English
3. **Read-only badge** — Replace interactive selector with a non-interactive pill on conversation page
4. **Generic system prompt** — Replace hardcoded `"ak"` with `LANGUAGE_NAMES` lookup

## Technical Considerations

### Critical: JSON vs Plain Text Mismatch

`getDisplayText()` parses content as JSON blocks (for OpenAI structured responses). But `original_content` is stored as **plain text** (`runStreamOpenAI.ts:102`). Calling `getDisplayText()` on `original_content` would silently return the raw string (caught by try/catch), but this is fragile.

**Solution:** For non-English conversations with `original_content` available, display it directly without `getDisplayText()`. Only use `getDisplayText()` for `content` (English, which may be JSON-formatted).

### Null original_content Fallback

Some messages in Twi conversations will have `original_content: null`:
- The initial AI greeting (hardcoded English in `conversation.ts:109`)
- Messages created before the bilingual schema migration

**Solution:** Fall back to `msg.content` (English) when `original_content` is null, even in Twi conversations.

### Race Condition on Page Load

Language state currently initializes from sessionStorage before the API response arrives. With the badge, this could flash the wrong language.

**Solution:** Initialize language as `null`, set it from API response, and render badge only after loading.

## Acceptance Criteria

- [x] Twi conversations display `original_content` (Twi text) for user and assistant messages
- [x] Messages with null `original_content` fall back to `content` (English) gracefully
- [x] Conversation page shows a non-interactive language badge instead of the selector
- [x] Badge shows correct language name (e.g., "Twi" not "ak")
- [x] Language selector on Home page remains fully interactive (no regression)
- [x] Conversation page no longer writes to sessionStorage for language
- [x] System prompt works for any language in `LANGUAGE_NAMES`, not just `"ak"`
- [x] Info text ("Your message will be translated...") removed from conversation page
- [x] No flash of incorrect language on conversation page load

## Implementation Plan

### Phase 1: Backend — Return Language from API

**File:** `src/server/controllers/conversation.ts:196-203`

Add `language` field to the `getConversationAndMessages` response object.

```typescript
// src/server/controllers/conversation.ts
res.json({
  conversationId,
  createdAt: conversation?.created_at,
  completed: conversation?.completed,
  assessment: conversation?.assessment,
  assessmentSources: conversation?.assessment_sources,
  language: conversation?.language || "en",  // ADD THIS
  messages,
});
```

### Phase 2: Backend — Generic System Prompt

**File:** `src/server/services/runStreamOpenAI.ts:17-23`

Replace hardcoded `=== "ak"` check with a lookup against `LANGUAGE_NAMES` from `translate.ts`.

```typescript
// src/server/services/runStreamOpenAI.ts
import { LANGUAGE_NAMES } from "./translate";

function getSystemPrompt(language: string): string {
  if (language === "en") return CLINICAL_INTERVIEW;

  const langName = LANGUAGE_NAMES[language] || language;
  const languageInstruction =
    `\n\nIMPORTANT: Conduct this entire clinical interview in ${langName}. ` +
    `The patient speaks ${langName}. Respond in ${langName}. ` +
    `If the patient uses English medical terms, acknowledge them naturally — this is normal code-switching.`;

  return CLINICAL_INTERVIEW + languageInstruction;
}
```

**Requires:** Export `LANGUAGE_NAMES` from `src/server/services/translate.ts` (currently not exported).

### Phase 3: Frontend — Initialize Language from API

**File:** `src/client/components/Conversation/index.tsx:41-51`

- Change language state to initialize as `null` (loading state)
- Set language from API response in the `useEffect` load function
- Remove `onLanguageChange` handler and sessionStorage writes

```typescript
// Before
const [language, setLanguage] = useState(
  () => sessionStorage.getItem("boafo-language") || "en",
);

// After
const [language, setLanguage] = useState<string | null>(null);

// In useEffect load:
const { data } = await axios.get(`/api/conversation/${conversationId}`);
setLanguage(data.language || "en");
```

### Phase 4: Frontend — Display original_content

**File:** `src/client/components/Conversation/index.tsx:141-161`

Update `renderMessages()` to display `original_content` when the conversation is non-English and the field is present.

```typescript
// Display logic per message:
const displayText = (language !== "en" && msg.original_content)
  ? msg.original_content           // Plain text Twi — use directly
  : getDisplayText(msg.content);   // English (possibly JSON) — parse
```

### Phase 5: Frontend — Read-Only Language Badge

**File:** `src/client/components/Conversation/index.tsx:339-349`

Replace `<LanguageSelector>` and the info text with a read-only badge. Uses the existing pill/badge pattern from `DiagnosisPanel.tsx:37-41`.

```tsx
// Replace LanguageSelector + info text with:
{language && (
  <span className="font-fakt text-sm px-3 py-1 rounded-full bg-gray-100 text-gray-600">
    {language === "en" ? "English" : language === "ak" ? "Twi" : language}
  </span>
)}
```

**Better approach:** Import `LANGUAGE_NAMES` equivalent on the client, or create a small inline map. The badge renders only after `language` loads from the API (no flash).

**Remove:**
- `<LanguageSelector>` import and usage on conversation page
- Info text conditional (`language === "ak" && ...`)
- `onLanguageChange` handler

**Keep unchanged:**
- `src/client/components/Home/index.tsx` — LanguageSelector stays interactive here
- `src/client/components/LanguageSelector/index.tsx` — No changes needed to the component itself

## Affected Files

| File | Change | Phase |
|------|--------|-------|
| `src/server/controllers/conversation.ts` | Add `language` to API response | 1 |
| `src/server/services/translate.ts` | Export `LANGUAGE_NAMES` | 2 |
| `src/server/services/runStreamOpenAI.ts` | Generic system prompt using `LANGUAGE_NAMES` | 2 |
| `src/client/components/Conversation/index.tsx` | Init language from API, display `original_content`, read-only badge | 3-5 |

## Dependencies & Risks

| Risk | Mitigation |
|------|-----------|
| Home page LanguageSelector breaks | No changes to LanguageSelector component itself; only usage in Conversation changes |
| `original_content` null for some messages | Explicit fallback to `content` |
| `LANGUAGE_NAMES` export breaks translate module | Simple `export` addition, no logic change |
| Unknown language codes in badge | Fallback to raw code string; `LANGUAGE_NAMES` lookup with fallback |

## References

- Brainstorm: `docs/brainstorms/2026-02-20-language-display-fixes-brainstorm.md`
- OpenAI migration plan: `docs/plans/2026-02-20-feat-twi-bidirectional-openai-migration-plan.md`
- Related TODO: `todos/016-pending-p2-language-switch-mid-conversation-broken.md`
- Badge pattern: `src/client/components/Conversation/DiagnosisPanel.tsx:37-41`
- Type definitions: `src/types/message.ts`, `src/types/conversation.ts`
- DB schema: `src/server/db/schema/schema.sql:8-29`
