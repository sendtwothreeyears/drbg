# RAG Implementation Plan

## Overview
Use clinical findings extracted during conversations to retrieve relevant clinical guidelines at diagnosis time.

## Flow

### One-time prep
Guidelines → chunk → embed → store in vector DB

### At diagnosis
Clinical findings → embed as query → search vector DB → retrieve relevant guideline chunks → feed to Claude → surface relevant guideline to user

### How the search works
Text in, text out. Vectors are just the search engine in between.

1. Clinical findings (text) are embedded into a vector at query time (not stored)
2. That query vector is compared against all stored `embedding` vectors in `guideline_chunks`
3. Postgres returns the rows with the closest matching vectors
4. The `content` (raw guideline text) is read from those rows
5. That text is fed to Claude as context for the response

Vectors are never surfaced to Claude or the user — they only exist to power the similarity search.

### How vectors and chunks relate
The vector sits within the chunk row, and the row describes the vector by virtue of its other properties. The vector can't describe itself — but it doesn't need to. The row it lives in provides all the context:

- `content` — the text the vector was made from
- `source` — which guideline it came from
- `section` — where in that guideline

The vector does one job: find this row when something similar is searched. Everything else about what it represents comes from the other columns in the same row.

### DB operations

Two functions power the RAG pipeline, used at different times:

**`createGuidelineChunkMutation` (used first, one-time)**
Used by the ingestion script when loading guidelines into the DB. Takes the raw text, metadata (source, section), and the pre-computed embedding from the guideline text, and inserts a row. Called once per chunk when processing guidelines — not during conversations.

**`searchGuidelineChunksQuery` (used later, every diagnosis)**
Takes an embedding from the clinical findings and a limit (default 5 results). Uses pgvector's `<=>` cosine distance operator to find the closest matching guideline chunks. Returns rows sorted by similarity, where 1.0 = perfect match and 0.0 = completely unrelated.

Both functions must use the same embedding model — if different models are used, the vectors wouldn't be in the same "space" and the distance math would be meaningless.

## Steps

### 1. Parse and chunk guidelines
- Determine source format of clinical guidelines
- Define chunking strategy (by section, by condition, by paragraph)
- Chunking strategy directly affects retrieval quality

### 2. Set up vector storage
- pgvector extension on existing Postgres instance keeps the stack simple
- Create table for storing guideline chunks + their vector embeddings

### 3. Write embedding + ingestion script
- One-time script to embed all guideline chunks and insert into vector DB
- Choose embedding model (e.g. OpenAI, Anthropic, or open-source)

### 4. Build the query flow
- Take clinical findings from DB as the search query
- Embed the findings at query time
- Perform similarity search against stored guideline vectors
- Return top-k relevant chunks

### 5. Integrate with stream
- Feed retrieved guideline chunks into Claude's context at diagnosis time
- Format as: "Here's a clinical guideline that might be relevant to this specific condition or concern"

### 6. Determine the diagnosis trigger
- Define when RAG fires — tool call, findings threshold, or other mechanism
- Only surface guidelines once AI has reached a diagnosis, not during the interview

## Guideline Sources

### Primary: WHO Clinical Guidelines (~500 total, filter to ~100-200)
- Universal base covering conditions applicable to all humans
- Strong coverage of infectious diseases prevalent in Africa (malaria, TB, HIV)
- Primary care management, maternal health, cardiovascular, respiratory, GI
- Freely available at https://www.who.int/publications/who-guidelines

### Secondary: Ghana Standard Treatment Guidelines (STGs)
- Published by Ghana's Ministry of Health
- Covers locally appropriate treatments based on drug availability in Ghana
- Accounts for region-specific disease burden (e.g. sickle cell prevalence)
- Addresses local antimicrobial resistance patterns

### Filtering Strategy
- Start with WHO guidelines covering the most common conditions in Ghana
- Prioritize: malaria, respiratory infections, hypertension, diabetes, maternal health, GI issues, HIV/TB
- Cross-reference with clinical findings data as conversations grow to identify gaps
- Layer in Ghana STGs when available for locally-specific treatment context
- Expand incrementally — don't try to cover everything upfront

### Phased Approach
1. Start with ~20-30 high-impact WHO guidelines, get RAG pipeline working end-to-end
2. Expand to ~100-200 WHO guidelines covering common primary care conditions
3. Add Ghana STGs for local treatment context

## Key Decisions
- [x] Guideline sources — WHO (primary) + Ghana STGs (secondary)
- [ ] Chunking strategy
- [ ] Embedding model
- [ ] Diagnosis trigger mechanism
