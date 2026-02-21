---
date: 2026-02-19
topic: twi-bidirectional-openai-migration
---

# Twi Bidirectional Translation & OpenAI Conversation Migration

## What We're Building

A full bidirectional Twi experience for Boafo patients, achieved by migrating the patient-facing conversation layer from Claude to OpenAI while retaining Claude for async clinical processing. Patients type in Twi, see responses in Twi, and receive assessments in both Twi and English. Doctors receive the English versions.

This builds on the existing MVP (Twi input translation via OpenAI gpt-4o-mini) and replaces the "translate at the boundaries" pattern with a cleaner split: OpenAI owns the conversation, Claude owns the clinical reasoning.

## Why This Approach

- **OpenAI handles Twi natively** — no translation layer needed for the conversation, no streaming hacks (sentence buffering, chunk translation), no added latency
- **Claude excels at background clinical processing** — findings extraction, RAG pipeline, assessment generation are all async tasks where Claude's reasoning strength matters and streaming doesn't
- **Industry alignment** — OpenAI is positioned for patient-facing clinical work; Claude is positioned for back-end clinical reasoning (rules, structure, large data processing)
- **Eliminates the dual-streaming problem** — the MVP's biggest architectural challenge (how to stream translated responses) disappears entirely

## Architecture

**Current state (MVP):**
```
Patient (Twi) → Server → OpenAI translates to EN → Claude (Opus) streams EN → Client
```

**Target state:**
```
Patient (Twi) → OpenAI conducts interview in Twi (streams natively) → Client
                     ↓
              English transcript stored alongside Twi
                     ↓
              Claude (async): findings extraction → RAG → assessment
                     ↓
              Assessment stored in English
              Assessment translated to Twi via OpenAI, stored
                     ↓
              Patient sees Twi assessment, Doctor sees English assessment
```

## Key Decisions

- **OpenAI owns the patient-facing conversation.** It handles multilingual streaming natively — no translation infrastructure needed for the chat layer.
- **Claude owns async clinical processing.** Findings extraction (Haiku), RAG pipeline, and assessment generation (Sonnet) remain on Claude, operating on English transcripts.
- **English is always the canonical clinical version.** Translated versions are derived copies. If translation quality is questioned, the English original is the reference.
- **Both transcripts are always stored.** Messages store original language + English. Assessments store English + translated version.
- **Conversations have an associated language.** Set at creation, persists for the lifetime of the conversation.
- **Assessments are bilingual.** Patient reads their language, doctor reads English. Both are accessible from the client.

## Implementation Phases

Each phase is independently deployable and testable.

### Phase 1: Database Schema Changes
Add language support to conversations and bilingual storage to messages/assessments.
- Add `language` column to `conversations` table (default: `"en"`)
- Add `original_content` and `original_language` columns to `messages` table
- Add translated assessment storage (English + selected language)
- Migrate existing data: all existing conversations are `language: "en"`, existing `content` is English

### Phase 2: Swap Conversation Layer to OpenAI
Replace Claude streaming with OpenAI for the patient-facing interview. OpenAI handles the conversation in the patient's selected language natively — no translation layer.
- Port the clinical interview system prompt from Claude to OpenAI
- OpenAI streams responses in the patient's language (Twi or English) natively
- For English conversations: OpenAI streams English, stored directly
- For Twi conversations: OpenAI streams Twi, English translation also generated and stored
- Validate interview quality: does OpenAI ask the same caliber of clinical follow-up questions?
- Claude pipeline (findings extraction, RAG, assessment) continues unchanged on English transcripts

### Phase 3: Store Both Transcripts
When the conversation language is not English, save both the original and English versions.
- Update conversation creation to set `language` from the frontend
- For user messages: store original Twi in `original_content`, English translation in `content`
- For assistant messages: store Twi response in `original_content`, English version in `content`
- English conversations are unaffected (`content` = `original_content`)
- Validate that existing clinical pipeline (findings extraction, assessment) still operates on `content` (English)

### Phase 4: Render Messages in Original Language
UI shows messages in the language the user selected, not the English translation.
- Client reads `original_content` for display when conversation language is not English
- Falls back to `content` (English) when no original exists
- Optimistic UI renders in the language the user typed in

### Phase 5: Bilingual Assessment Storage
Store assessments in English + translated to selected language.
- Claude generates English assessment (unchanged)
- If conversation language is not English, OpenAI translates assessment to selected language
- Store both versions
- Client can display either version
- Patient sees assessment in their language, doctor sees English

## Open Questions

- What OpenAI model should handle the conversation? GPT-4o for quality, or GPT-4o-mini for cost/speed?
- Does the clinical interview system prompt transfer cleanly to OpenAI, or does it need significant rework?
- How do we handle the English transcript generation in Phase 5 — does OpenAI respond in both languages, or do we translate the Twi response to English for storage?
- What is the assessment UI — how does the patient/doctor toggle between languages?

## Next Steps

→ `/workflows:plan` for Phase 1 (Database Schema Changes) implementation details
