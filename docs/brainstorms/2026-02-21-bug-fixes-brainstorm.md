# Bug Fixes Brainstorm — 2026-02-21

## What We're Fixing

Four bugs affecting conversation UX and assessment generation:

### 1. TOS Checkbox Persists After Acceptance

**Current:** Checkbox always renders even after user checks it.
**Expected:** Once accepted, the checkbox should disappear for the duration of the conversation.
**Root cause:** The checkbox UI always renders regardless of `tosAccepted` state — it should be conditionally hidden.
**Key file:** `src/client/components/Conversation/index.tsx` (lines 379-402)

### 2. i18n Language Not Applied on Page Refresh

**Current:** Selecting "Twi", then refreshing — toggle shows "Twi" but page content is English.
**Expected:** Page content should render in the selected language after refresh.
**Root cause:** `i18n/config.ts` hardcodes `lng: "en"`. Home component reads sessionStorage into React state but never calls `i18n.changeLanguage()` on mount.
**Key files:**
- `src/client/i18n/config.ts`
- `src/client/components/Home/index.tsx` (lines 58-66)

### 3. Assessment Generation Fails (Two Sub-issues)

**Error 1 — Translation length:** `translateText()` defaults to 2000 chars, but assessments can be longer. The call in `generateAssessment.ts:95` doesn't pass a higher `maxLength` (unlike `runStreamOpenAI.ts:119` which passes 8000).
**Error 2 — Missing DB column:** `assessment_translated` column doesn't exist in the actual database. Schema.sql defines it but the migration hasn't been run.
**Key files:**
- `src/server/services/translate.ts` (line 43)
- `src/server/services/generateAssessment.ts` (line 95)
- `src/server/db/operations/conversations.ts` (lines 43-53)
- `src/server/db/schema/schema.sql`

### 4. Demographics Prompt Fires Immediately (No Explanatory Message)

**Current:** After chief complaint, the demographics form appears instantly with no explanation.
**Expected:** AI sends a warm message explaining why demographics are needed, THEN triggers the tool/form.
**Root cause:** `conversation.ts:63` forces the `collect_demographics` tool on the next stream, overriding the AI's ability to send a text message first.
**Key file:** `src/server/controllers/conversation.ts` (lines 59-67)

## Approach

- **Simplest fixes preferred** — these are all well-understood bugs
- Database migration needed for issue #3 (add `assessment_translated` column without dropping data/embeddings)
- All fixes are independent and can be implemented in any order

## Key Decisions

- Hide (not remove) the TOS checkbox after acceptance — use conditional rendering based on existing `tosAccepted` state
- Sync i18n on mount from sessionStorage — call `i18n.changeLanguage()` during initialization
- Increase translateText limit for assessments OR chunk the translation
- Run `ALTER TABLE` to add missing column rather than full DB reset
- Remove forced tool calling for demographics; let the AI follow its prompt instructions naturally

## Open Questions

None — all issues have clear root causes and fixes.
