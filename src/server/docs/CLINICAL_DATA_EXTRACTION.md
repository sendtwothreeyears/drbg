# Structured Clinical Data Extraction

## Context

The app collects demographics via an explicit form (tool_use → client UI → tool_result). The `record_clinical_finding` tool **silently** extracts structured clinical data (symptoms, severity, duration, etc.) from the patient's messages. The model calls this tool automatically — the user never sees it. The server handles the tool loop internally and streams only the conversational text to the client.

## Key Design Decisions

- **Extraction tool only available after demographics are collected** (inverted gating from demographics). This avoids mixed tool responses in a single turn.
- **Server-side tool loop**: when the model calls `record_clinical_finding`, the server saves findings, creates the tool_result, and calls Anthropic again — all within the same SSE connection. Client is untouched.
- **Max loop depth of 3** to prevent runaway API calls.
- **Findings array per call** — model can batch multiple findings in one tool invocation.

## Files

### `src/server/db/schema.sql`
Defines the `clinical_findings` table with columns: `findingid`, `conversationid`, `category` (CHECK constraint enum), `value`, `created_at`. Categories: symptom, location, onset, duration, severity, character, aggravating_factor, relieving_factor, associated_symptom, medical_history, medication, allergy.

### `src/server/db/queries/findings.ts`
Batch insert and query for clinical findings. Follows the pattern of `queries/profiles.ts`.

### `src/server/tools/extraction.ts`
Tool definition for `record_clinical_finding`. Input schema: `{ findings: [{ category, value }] }` with category as enum. Follows the pattern of `tools/demographics.ts`.

### `src/server/prompts/CLINICAL_INTERVIEW.ts`
System prompt extended with extraction instructions telling the model to use the tool silently. Already-recorded findings are injected into the prompt so the model doesn't re-extract them. Extraction instructions only included when a profile exists (after demographics).

### `src/server/main.ts`
Core change. The stream handler is an async loop that:
1. Rebuilds history from DB each iteration
2. Fetches profile + findings, builds prompt, sets tools
3. Streams text to client via SSE and collects tool_use blocks
4. Classifies blocks as silent (`record_clinical_finding`) vs client (`collect_demographics`)
   - **Silent tools**: saves findings to DB, creates tool_result message, loops (if depth < 3)
   - **Client tools**: forwards tool_use to client via SSE
   - **No tools**: done
5. Exposes a `/findings` API endpoint for the client-side visualization

### `src/client/components/FindingsPanel/index.tsx`
Renders extracted findings grouped by category in a side panel. Polls for updates every 5 seconds.

### `src/client/components/Conversation/index.tsx`
Detects the `?findings` query string and renders the findings panel alongside the chat when present.

### `src/client/services/api.ts`
API call to fetch findings for a conversation.

## Verification

1. Start fresh conversation, complete demographics, describe a symptom
2. Check `clinical_findings` table has entries: `sqlite3 src/server/db/cb.db "SELECT * FROM clinical_findings"`
3. Verify chat UI shows only doctor's conversational response (no tool artifacts)
4. Describe a complex symptom — verify multiple findings extracted
5. Continue conversation — verify model doesn't re-extract same data
6. Append `?findings` to conversation URL — verify side panel shows grouped findings
7. Reload page mid-conversation — verify history displays correctly
