---
title: "fix: TOS persistence, i18n sync, assessment translation, demographics timing"
type: fix
status: completed
date: 2026-02-21
---

# Fix: TOS Persistence, i18n Sync, Assessment Translation, Demographics Timing

## Overview

Four independent bugs affecting conversation UX and assessment generation. All have clear root causes identified from code analysis and existing solution documentation.

---

## Bug 1: TOS Checkbox Persists After Acceptance

### Problem

The TOS consent checkbox always renders in the conversation view, even after the user checks it. It should disappear once accepted for the duration of the conversation.

### Root Cause

The checkbox JSX at `src/client/components/Conversation/index.tsx:379-402` always renders. The `tosAccepted` state correctly persists to sessionStorage but the UI doesn't conditionally hide the checkbox.

### Fix

Wrap the TOS `<label>` block in a conditional: `{!tosAccepted && ( ... )}`.

### Acceptance Criteria

- [x] After checking the TOS checkbox, it disappears from the UI
- [x] The send button remains enabled (since `tosAccepted` is still `true` in state)
- [x] On page refresh within the same session, the checkbox stays hidden (sessionStorage persists)
- [x] Starting a new conversation shows the checkbox again (scoped by conversationId)

### Implementation

**`src/client/components/Conversation/index.tsx`** (~line 379)

```tsx
// BEFORE (always renders):
<label className="flex items-start gap-2 px-1 mb-2 cursor-pointer">
  <input type="checkbox" checked={tosAccepted} ... />
  <span>...</span>
</label>

// AFTER (conditional render):
{!tosAccepted && (
  <label className="flex items-start gap-2 px-1 mb-2 cursor-pointer">
    <input type="checkbox" checked={tosAccepted} ... />
    <span>...</span>
  </label>
)}
```

---

## Bug 2: i18n Language Not Applied on Page Refresh

### Problem

On the Home page, selecting "Twi" and refreshing the page: the toggle correctly shows "Twi" (from sessionStorage), but all `t()` translated strings render in English because i18next's internal locale was never updated.

### Root Cause

`src/client/i18n/config.ts:12` hardcodes `lng: "en"`. The Home component initializes React state from sessionStorage but never calls `i18n.changeLanguage()` on mount — it only calls it in the `onLanguageChange` handler.

### Fix

Read sessionStorage during i18n initialization in `config.ts`, with a guard for SSR safety.

### Acceptance Criteria

- [x] Select "Twi" on Home page, refresh — all UI strings render in Twi
- [x] Select "English", refresh — all UI strings render in English
- [x] First visit (no sessionStorage) defaults to English
- [x] Conversation page still correctly syncs language from server data

### Implementation

**`src/client/i18n/config.ts`** (line 12)

```typescript
// BEFORE:
lng: "en",

// AFTER:
lng: (typeof sessionStorage !== "undefined" && sessionStorage.getItem("boafo-language")) || "en",
```

The `typeof` guard prevents a `ReferenceError` if this module is ever evaluated in a non-browser context (SSR, tests). This reads the persisted preference at i18n initialization time, before any React component mounts.

### Known Limitation

`sessionStorage` is tab-scoped — a new tab won't have the preference. This is acceptable since the Home page has a visible language selector.

---

## Bug 3: Assessment Generation Fails (Two Sub-issues)

### Problem

Two errors occur when generating an assessment for a non-English conversation:

1. **Translation exceeds 2000 char limit** — `translateText()` is called with default `maxLength` of 2000, but assessments are typically longer
2. **Missing DB column** — `assessment_translated` column doesn't exist in the live database (schema.sql defines it, but no migration was run)

### Root Cause

**Error 1:** `generateAssessment.ts:95` calls `translateText(text, "en", language)` without passing a custom `maxLength`. Compare with `runStreamOpenAI.ts:119` which correctly passes `8000`.

**Error 2:** The `assessment_translated` column was added to `schema.sql` but never migrated to the running database. The existing migration (`migrate-001-add-language-support.ts`) only adds `language`, `original_content`, and `original_language`.

### Fix

1. Pass `8000` as `maxLength` to `translateText()` in `generateAssessment.ts`
2. Increase `max_tokens` in `translateText()` to handle longer inputs (1024 → 4096)
3. Create `migrate-002-add-assessment-translated.ts` following the existing migration pattern

### Acceptance Criteria

- [x] Assessment translation works for assessments up to 8000 characters
- [x] Translation output is not truncated mid-sentence (sufficient output tokens)
- [x] `assessment_translated` column exists in the live database after running migration
- [x] Non-English conversations store both English and translated assessments
- [x] Existing data (conversations, embeddings) is preserved — migration only adds a column
- [x] English-only conversations are unaffected (column defaults to NULL)

### Implementation

**`src/server/services/generateAssessment.ts`** (~line 95)

```typescript
// BEFORE:
translatedText = await translateText(text, "en", language);

// AFTER:
translatedText = await translateText(text, "en", language, 8000);
```

**`src/server/services/translate.ts`** (~line 53)

The current `max_tokens: 1024` will silently truncate translations of long assessments. An 8000-char English input can produce 2000-3000+ tokens in Twi. Increase to match the input capacity:

```typescript
// BEFORE:
max_tokens: 1024,

// AFTER:
max_tokens: 4096,
```

**New file: `src/server/scripts/migrate-002-add-assessment-translated.ts`**

```typescript
import pool from "../db/index";

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN IF NOT EXISTS assessment_translated TEXT
    `);

    await client.query("COMMIT");
    console.log("Migration 002 complete: assessment_translated column added");
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Migration 002 failed:", error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

migrate()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
```

**Run with:** `npx tsx src/server/scripts/migrate-002-add-assessment-translated.ts`

This adds the column without dropping any tables — all existing data and embeddings are preserved.

---

## Bug 4: Demographics Prompt Fires Immediately

### Problem

After the user sends their chief complaint, the demographics form appears instantly with no explanatory message. The system prompt instructs the AI to send a warm acknowledgment message first, then call the tool — but the controller overrides this by only providing `collect_demographics` as the available tool.

### Root Cause

`src/server/controllers/conversation.ts:62-64` — when no profile exists, `toolName` is set to `"collect_demographics"`. This is passed to `runStreamOpenAI`, which provides it as the **only** tool via `createOpenAIChatStream`. With only one tool available, the AI jumps straight to the tool call without sending text first.

### Fix

Provide all tools when demographics haven't been collected (instead of restricting to one), and add a **server-side guard** on `generate_differentials` execution to prevent premature differential generation without a profile. The system prompt instructs the AI to acknowledge the patient first, then call `collect_demographics`.

### Acceptance Criteria

- [x] After chief complaint, AI first sends a warm message acknowledging the patient
- [x] AI then calls `collect_demographics` tool, rendering the inline form
- [x] The two-step flow (message → tool) happens in a single stream response
- [x] `generate_differentials` cannot execute without a profile (server-side guard)
- [x] `generate_differentials` tool forcing is unchanged when profile exists but diagnoses don't
- [x] Demographics are still collected before differential diagnosis generation

### Implementation

**Step 1: `src/server/controllers/conversation.ts`** (~lines 62-67)

Stop forcing a single tool when demographics are needed. Instead, let the AI choose naturally:

```typescript
// BEFORE:
let toolName: string | undefined;
if (!profile) {
  toolName = "collect_demographics";
} else if (diagnoses.length === 0) {
  toolName = "generate_differentials";
}

// AFTER:
let toolName: string | undefined;
if (!profile) {
  // Don't force a single tool — let AI acknowledge the patient first,
  // then call collect_demographics naturally per system prompt instructions.
  // All tools will be available; server-side guard prevents premature differentials.
  toolName = undefined;
} else if (diagnoses.length === 0) {
  toolName = "generate_differentials";
}
```

**Step 2: `src/server/services/runStreamOpenAI.ts`** (~lines 64-72)

When `toolName` is undefined, currently no tools are provided. Change to provide all tools so the AI can call `collect_demographics`:

```typescript
// BEFORE:
const tool = toolName ? openaiTools[toolName] : undefined;
// ...
const stream = await createOpenAIChatStream(
  messages,
  systemPrompt,
  tool ? [tool] : undefined,
);

// AFTER:
const allTools = Object.values(openaiTools);
const tools = toolName
  ? [openaiTools[toolName]]  // Specific tool requested
  : allTools.length > 0
    ? allTools                // All tools available (AI decides)
    : undefined;
// ...
const stream = await createOpenAIChatStream(
  messages,
  systemPrompt,
  tools,
);
```

**Step 3: `src/server/services/runStreamOpenAI.ts`** (~line 220)

Add a server-side guard to prevent differential generation without a profile. This is the safety net that prevents the AI from skipping demographics:

```typescript
// BEFORE:
if (differentialsCall) {
  const { differentials } = differentialsCall.input as { ... };
  await createDiagnosesMutation(conversationId, differentials);
  // ...
}

// AFTER:
if (differentialsCall) {
  // Safety guard: don't generate differentials without patient demographics
  const profile = await getProfileByConversationQuery(conversationId);
  if (!profile) {
    console.warn("[runStreamOpenAI] AI called generate_differentials without demographics — skipping");
  } else {
    const { differentials } = differentialsCall.input as { ... };
    await createDiagnosesMutation(conversationId, differentials);
    // ... rest unchanged
  }
}
```

This ensures that even if the AI ignores the system prompt and calls `generate_differentials` prematurely, the server silently ignores it.

### Risk Notes

- LLMs don't follow instructions 100% of the time. The server-side guard is the true safety mechanism — the prompt is for UX quality.
- With all tools available, the AI might call `generate_differentials` before demographics. The guard catches this.
- The `tool_choice` is `"auto"` by default (`openai-chat.ts:22`), so the AI can produce both text and tool calls in one response.

---

## Implementation Order

All 4 fixes are independent. Suggested order for efficiency:

1. **Bug 3 — Migration** (run first so DB is ready)
2. **Bug 3 — translateText limit + max_tokens** (2 changes)
3. **Bug 1 — TOS conditional render** (1-line wrapper)
4. **Bug 2 — i18n config** (1-line change)
5. **Bug 4 — Demographics timing** (3 changes: controller, tools logic, server guard)

## Files Changed

| File | Bug | Change |
|------|-----|--------|
| `src/client/components/Conversation/index.tsx` | 1 | Conditional render TOS checkbox |
| `src/client/i18n/config.ts` | 2 | Read sessionStorage for initial language |
| `src/server/services/generateAssessment.ts` | 3 | Pass `8000` to `translateText()` |
| `src/server/services/translate.ts` | 3 | Increase `max_tokens` to 4096 |
| `src/server/scripts/migrate-002-add-assessment-translated.ts` | 3 | New migration script |
| `src/server/controllers/conversation.ts` | 4 | Remove forced tool for demographics |
| `src/server/services/runStreamOpenAI.ts` | 4 | Provide all tools when no specific tool forced; add profile guard on differentials |

## References

- Brainstorm: `docs/brainstorms/2026-02-21-bug-fixes-brainstorm.md`
- Existing solutions docs: `docs/solutions/integration-issues/i18n-language-sync-and-preference-restoration.md`
- Migration pattern: `src/server/scripts/migrate-001-add-language-support.ts`
- Error stack trace: conversation `86ab1046-8724-4c86-9036-8eb9514e2ef3`
- `openaiTools` index: `src/server/openaiTools/index.ts` (2 tools: `collect_demographics`, `generate_differentials`)
