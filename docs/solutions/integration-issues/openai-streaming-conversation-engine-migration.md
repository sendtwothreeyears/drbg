---
module: Multilingual Conversation & Database
date: 2026-02-20
problem_type: integration_issue
component: OpenAI conversation engine, PostgreSQL schema, bilingual storage layer
symptoms:
  - "Original Twi text lost after patient input — only English translation stored"
  - "Responses streamed in English regardless of patient's native language"
  - "Architecture required dual-streaming (Twi→EN translation before Claude, then EN→Twi translation of response)"
  - "No audit trail of original patient language content"
root_cause: "Previous architecture delegated patient-facing conversation to Claude in English, requiring pre-translation of patient input and post-translation of assistant output. This lost original language text, added latency, and created architectural complexity. No schema support for bilingual storage."
resolution_type: code_fix
severity: high
tags:
  - openai-migration
  - multilingual
  - bidirectional-translation
  - twi-language
  - streaming
  - database-schema
  - conversation-engine
---

# OpenAI Streaming Conversation Engine Migration (Phases 1-3)

## Problem

The Boafo clinical decision support system's MVP translated patient Twi input to English via OpenAI gpt-4o-mini, then streamed a Claude Opus interview in English. This had four key limitations:

1. **Original Twi text lost** — only the English translation was stored, eliminating audit trail and preventing future display in the patient's language
2. **Responses English-only** — Claude responded in English even when the patient typed in Twi, creating a disjointed experience
3. **Translation added latency** — translating input before Claude streaming delayed time-to-first-token
4. **Dual-streaming architecturally complex** — translating Claude's streamed English response back to Twi would require sentence buffering, adding significant complexity

## Root Cause / Feature Need

The original architecture attempted to shoehorn multilingual support into a single-language pipeline. Claude Opus was repurposed for language translation before clinical work, creating coupling and latency. The system needed to:

1. Enable native-language clinical interviews (Twi/Akan)
2. Preserve original patient language data for medical records
3. Improve latency by removing translation from the critical path
4. Split AI responsibility by strength: OpenAI for patient conversation, Claude for clinical analysis

## Architecture

### Before: Coupled Translation-Clinical Flow (MVP)

```
Patient (Twi) → Server → OpenAI translates to EN → Claude (Opus) streams EN → Client
                                                      (Twi lost)
```

### After: Split AI by Strength (Phases 1-3)

```
Patient (Twi) → OpenAI conducts interview in Twi (streams natively) → Client
                     ↓
              Store bilingual:
                original_content (Twi)
                content (English translation)
                     ↓
              Claude (async): findings extraction, RAG, assessment
                     (reads English content column only)
```

### Component Map

| Layer | File | Role |
|-------|------|------|
| DB Schema | `src/server/db/schema/schema.sql` | `original_content`, `original_language`, `content_language` columns |
| Migration | `src/server/scripts/migrate-001-add-language-support.ts` | Adds language columns to existing tables |
| Streaming Engine | `src/server/services/runStreamOpenAI.ts` | **New** — OpenAI native-language conversation with tool calling |
| OpenAI Client | `src/server/services/openai-chat.ts` | Shared OpenAI client and stream factory |
| Translation | `src/server/services/translate.ts` | Enhanced for bidirectional prompts |
| Tool Definitions | `src/server/openaiTools/` | `collect_demographics`, `generate_differentials` |
| Controller | `src/server/controllers/conversation.ts` | Routes to OpenAI engine, bilingual storage |
| DB Operations | `src/server/db/operations/messages.ts` | Extended for `original_content`/`original_language` |
| Types | `src/types/message.ts`, `src/types/conversation.ts` | Added language fields |
| Frontend | `src/client/components/Conversation/index.tsx` | Language-aware streaming UI |

## Working Solution

### 1. Database Schema Evolution

Three new columns for bilingual storage:

```sql
-- messages table
original_content TEXT,       -- Original patient language (Twi, Ewe, etc.)
original_language TEXT,      -- Language code: "ak", "ee", "ga"

-- conversations table
language TEXT NOT NULL DEFAULT 'en'  -- Conversation language preference
```

Migration script (`migrate-001-add-language-support.ts`):

```typescript
await client.query(`
  ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en'
`);
await client.query(`
  ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS original_content TEXT
`);
await client.query(`
  ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS original_language TEXT
`);
```

### 2. OpenAI Streaming Conversation Engine (Core Innovation)

`src/server/services/runStreamOpenAI.ts` — the new conversation engine that replaces Claude Opus for patient-facing interviews.

**A. Language-Aware System Prompt:**

```typescript
function getSystemPrompt(language: string): string {
  const languageInstruction = language === "ak"
    ? "\n\nIMPORTANT: Conduct this entire clinical interview in Twi (Akan). " +
      "The patient speaks Twi. Respond in Twi. If the patient uses English " +
      "medical terms (e.g., 'malaria', 'paracetamol'), acknowledge them naturally " +
      "— this is normal code-switching."
    : "";

  return CLINICAL_INTERVIEW + languageInstruction;
}
```

**B. Bidirectional Message Reconstruction** — sends OpenAI the original Twi content so the model sees the patient's language:

```typescript
const messages: OpenAIMessage[] = dbMessages
  .map((m) => ({
    role: m.role as "user" | "assistant",
    content: (language !== "en" && m.original_content)
      ? m.original_content      // Send Twi if available
      : m.content,              // Otherwise English
  }))
  .filter((_, i, arr) => !(i === 0 && arr[0].role === "assistant"));
```

**C. Incremental Tool Call Handling** — OpenAI streams function arguments as JSON fragments:

```typescript
for await (const chunk of stream) {
  if (delta?.content) {
    fullText += delta.content;
    onText(delta.content);
  }

  if (delta?.tool_calls) {
    for (const tc of delta.tool_calls) {
      const idx = tc.index;
      if (!functionCalls[idx]) {
        functionCalls[idx] = { name: "", arguments: "" };
      }
      if (tc.function?.name) functionCalls[idx].name = tc.function.name;
      if (tc.function?.arguments) functionCalls[idx].arguments += tc.function.arguments;
    }
  }
}
```

**D. Bilingual Storage** — after stream completes, assistant response stored with language metadata:

```typescript
let englishContent = fullText;
let originalContent: string | null = null;
let originalLanguage: string | null = null;

if (language !== "en" && fullText) {
  originalContent = fullText;        // Store Twi response as-is
  originalLanguage = language;       // Mark as "ak"
  englishContent = await translateText(fullText, language, "en");  // Generate English
}

await createMessageMutation(
  conversationId,
  "assistant",
  englishContent,        // English for clinical processing
  originalContent,       // Twi for records
  originalLanguage,      // "ak" language code
);
```

### 3. OpenAI Client Setup

`src/server/services/openai-chat.ts`:

```typescript
export function createOpenAIChatStream(
  messages: OpenAIMessage[],
  system: string,
  tools?: OpenAITool[],
) {
  return client.chat.completions.create({
    model: "gpt-5.2",
    messages: [{ role: "system", content: system }, ...messages],
    stream: true,
    ...(tools && tools.length > 0 ? { tools } : {}),
    max_tokens: 1024,
  });
}
```

### 4. Translation Service (Enhanced for Bidirectional)

`src/server/services/translate.ts` — now supports both inbound (Twi→EN) and outbound (EN→Twi) with language-specific prompts:

```typescript
function getTranslationPrompt(from: string, to: string): string {
  if (to === "en") {
    return `You are translating patient symptom descriptions from ${fromName} to English...`;
  }
  return `You are translating clinical interview text from English to ${toName}...`;
}
```

### 5. OpenAI Tool Definitions

`src/server/openaiTools/` — tools work identically to Claude's tool_use interface:

- `collect_demographics` — collects patient age and biological sex via inline form
- `generate_differentials` — analyzes clinical findings and generates ranked differential diagnoses

### 6. Controller Integration

`src/server/controllers/conversation.ts` — entry points for the new engine:

- Conversation creation: translate inbound → store bilingual → create conversation with language tag
- Stream initiation: SSE endpoint determines which tool to use (demographics or diagnoses), launches `runStreamOpenAI` with callbacks

### 7. Message DB Operations

`src/server/db/operations/messages.ts` — extended signature:

```typescript
const createMessageMutation = async (
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  originalContent?: string | null,    // Twi content
  originalLanguage?: string | null,   // "ak" code
): Promise<string> => { ... };
```

## Investigation Steps / Alternatives Considered

| Approach | Why Not Chosen |
|----------|----------------|
| **Claude Opus for Twi interviews** | Added latency (translation before interview), no native Twi output streaming |
| **Dual streaming (OpenAI translation + Claude interview)** | Complex callback management, client-side SSE handling difficult |
| **Store only English transcripts** | Lost original patient voice, compliance issues, no clinical audit trail |
| **Single-language conversations** | Too restrictive; flexible per-message language support chosen instead |
| **GhanaNLP Khaya** | Free tier limited to 100 calls/month; remains fallback candidate |

### Why OpenAI for Interview Stream

- Native streaming in patient's language — no translation overhead on critical path
- Tool calling matches Claude's interface — minimal frontend changes
- gpt-5.2 handles Twi code-switching naturally (medical terms stay in English)
- Removes translation from time-to-first-token

### Why Bilingual Storage

- **Compliance**: Medical records preserve original patient language
- **Audit trail**: Clinician can verify patient's original statements
- **Future ML**: Can fine-tune on multilingual clinical data
- **Reversibility**: Can add language-specific clinical analysis without re-interview

## Prevention Strategies

### API Failure Modes

- **Add timeout**: OpenAI SDK `timeout` option, 10 seconds recommended for clinical context
- **Add retry**: Use `maxRetries: 2` for transient 429/503 errors
- **Circuit breaker**: After N consecutive failures, reject new requests for cooldown period
- **Fallback**: If OpenAI fails, continue in English with graceful degradation message

### Security

- **Prompt injection**: Input length cap (2000 chars), output ratio validation (3x), `temperature: 0`
- **PHI in logs**: Log error codes only, never request bodies or patient text
- **Language parameter injection**: Allowlist validation at both controller and service level
- **Input sanitization**: Strip control characters before sending to OpenAI

### Data Integrity

- **Bilingual field sync**: If `original_language IS NOT NULL` then `original_content NOT NULL`
- **Quarterly audit**: `SELECT COUNT(*) WHERE original_content IS NULL AND original_language IS NOT NULL` (should be 0)
- **Always set both fields together or neither** in application code

### Rate Limiting

- Apply `express-rate-limit` (10 req/min/IP) to translation endpoints
- Monitor OpenAI token usage against budget

## Test Cases

### Unit Tests (Translation Service)

| Scenario | Expected |
|----------|----------|
| English passthrough (`from="en"`) | Returns input without calling OpenAI |
| Empty/whitespace string | Returns input without calling OpenAI |
| Unsupported language `"es"` | Throws "Unsupported language pair" |
| Input exceeds 2000 chars | Throws max length error |
| Input exactly 2000 chars | Succeeds |
| OpenAI returns empty | Throws "empty response" |
| Output 4x input length | Throws "suspiciously longer" |
| Valid Twi input | Returns English translation |
| Mixed Twi/English code-switching | English portions preserved |
| Unicode/diacritics (ɛ, ɔ) | No encoding corruption |

### Integration Tests (Streaming Engine)

| Scenario | Expected |
|----------|----------|
| Twi conversation — text chunks stream | All chunks arrive in order via SSE |
| Tool call with incremental arguments | Full JSON accumulated before parsing |
| Tool call JSON incomplete on stream close | Error handled, tool not triggered |
| Assistant response in Twi stored bilingual | `original_content` = Twi, `content` = English |
| Client closes tab during stream | Server cleanup via `req.on("close")` |

### Frontend Tests

| Scenario | Expected |
|----------|----------|
| Default state | English selected, English placeholder |
| Select Twi | Placeholder changes, info note appears |
| Language persists to Conversation page | sessionStorage carries state |
| Translation error (502) | Error text visible, input restored |
| Optimistic UI rollback on failure | Message removed from chat |

## Monitoring

### Key Metrics

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Translation latency p95 | < 2s | > 3s for 5 min |
| Translation error rate | < 5% | > 10% for 15 min |
| OpenAI token usage | Budget-aware | > daily budget |
| Streaming first-byte latency | < 500ms | > 1s for 5 min |
| Tool call parse success rate | 99%+ | < 99% |
| Bilingual data consistency | 100% | Any mismatch |

### Clinical Quality

- **Weekly**: Sample 10 translations reviewed by Twi-speaking clinician
- **Monthly**: Back-translation comparison (English → Twi → compare similarity)
- **Continuous**: Flag conversations where patient contradicts system understanding >2x

## Known Issues (Open TODOs)

| ID | Priority | Issue |
|----|----------|-------|
| 004 | P2 | Language state inconsistency on Home mount |
| 005 | P2 | No input length validation at frontend |
| 006 | P2 | Controller-level language validation |
| 008 | P2 | OpenAI API key startup check |
| 009 | P2 | Dead `to` parameter in translateText |
| 010 | P2 | No OpenAI timeout |
| 011 | P3 | PHI in console error logs |
| 015 | P2 | Duplicate OpenAI client instances |
| 016 | P2 | Language switch mid-conversation broken |
| 017 | P3 | Inconsistent API service layer |

See `todos/` directory for full details on each issue.

## Cross-References

- [Twi Input Translation MVP (Phase 1)](./twi-input-translation.md)
- [Bidirectional Migration Plan](../../plans/2026-02-20-feat-twi-bidirectional-openai-migration-plan.md)
- [Bidirectional Migration Brainstorm](../../brainstorms/2026-02-19-feat-twi-bidirectional-openai-migration-brainstorm.md)
- [Twi Input Translation Plan](../../plans/2026-02-19-feat-twi-input-translation-plan.md)
- [Twi Input Translation Brainstorm](../../brainstorms/2026-02-19-feat-twi-input-translation-brainstorm.md)
- [Multilingual Translation Research](../../research/multilingual-translation.md)
