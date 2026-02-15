# RAG Implementation Plan

## Overview
Use clinical findings extracted during conversations to retrieve relevant clinical guidelines at diagnosis time.

## Flow

### One-time prep
Guidelines → chunk → embed → store in vector DB

### At diagnosis
Interview → clinical findings → diagnosis (Claude's knowledge) → condition + clinical findings as query → search vector DB → retrieve relevant guideline chunks → feed to Claude → surface treatment recommendation

RAG fires **after** Claude reaches a diagnosis, not during the interview. The guidelines don't help Claude figure out what's wrong — they help it recommend what to do about it based on WHO protocols.

### Why the query is condition + clinical findings

The query combines the diagnosed condition with the patient's clinical findings. Both are needed:

- **Condition alone** ("malaria") retrieves all malaria guideline chunks — general treatment, severe treatment, prevention, pregnancy, children, drug resistance. Too broad.
- **Condition + clinical findings** ("malaria + pregnant + first trimester + no drug allergies") retrieves the pregnancy-specific treatment subsection. The clinical findings act as a filter within the condition.

This is why the chunking strategy uses hierarchical section-based splitting with title prefixes. Sections like `Malaria > Treatment > Uncomplicated malaria in pregnancy` have focused embeddings that match precisely when clinical findings include pregnancy context.

The condition gets you to the right guideline. The clinical findings get you to the right *section* of that guideline. Without clinical findings, you have a search engine for WHO guidelines. With them, you have a system that returns the relevant WHO protocol for *this specific patient*.

### How the search works
Text in, text out. Vectors are just the search engine in between.

1. The diagnosed condition + clinical findings (text) are combined into a query and embedded into a vector at query time (not stored)
2. That query vector is compared against all stored `embedding` vectors in `guideline_chunks`
3. Postgres returns the rows with the closest matching vectors
4. The `content` (raw guideline text) is read from those rows
5. That text is fed to Claude as context for the treatment recommendation

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

### How RAG works — Retrieve then Generate

RAG is always two steps:

1. **Retrieve** — search a knowledge base (the vector DB) for relevant context. This is `searchGuidelines` — it embeds the query, searches `guideline_chunks`, and returns the top-k matching chunks. The vector DB's job ends here.

2. **Generate** — pass that retrieved context into an LLM prompt to produce a grounded response. This is `generateAssessment` — it takes the chunks as input alongside findings and diagnoses, and Claude generates the Assessment & Plan.

The "augmented" in Retrieval-Augmented Generation means the prompt is augmented with retrieved documents. Step 2 is always a prompt — the LLM reads the retrieved text as context and generates from it. Without the retrieved chunks, Claude generates from general knowledge and may hallucinate dosages or miss protocols. With them, it generates grounded in specific WHO text that the vector DB surfaced.

Every RAG system works this way — ChatGPT with file uploads, Perplexity searching the web, or a clinical tool searching guidelines. The vector DB finds the relevant context; the LLM consumes it.

### What gets embedded at query time

Two vectors are created per diagnosis at query time using a dual-query strategy:

1. **Primary query** — the condition name alone (e.g. `"Concussion"`) for focused, high-similarity matches
2. **Secondary query** — the condition + all clinical findings combined (e.g. `"Concussion. symptom: headache. severity: 8/10. duration: 3 days"`) for broader contextual matches

Example for one diagnosis:

```
"Concussion" + [symptom: headache, severity: 8/10, duration: 3 days]
                    ↓
        TWO queries:
        Query 1: "Concussion" (condition only — focused)
        Query 2: "Concussion. symptom: headache. severity: 8/10. duration: 3 days" (broad)
                    ↓
        Each embedded into a vector (via OpenAI text-embedding-3-small)
                    ↓
        Each vector compared against all 83,247 stored guideline vectors
                    ↓
        Results merged, deduped (highest similarity kept per chunk)
                    ↓
        Re-ranked: +0.01 boost per patient finding keyword found in chunk
                    ↓
        Filtered: only chunks with similarity >= 0.50
                    ↓
        Top 5 chunks returned — raw WHO guideline text
```

The query vectors are ephemeral — they're not stored. They exist only to perform the similarity search. The result is guideline text, not vectors. If there are 3 differential diagnoses, this runs 3 times (in parallel), each producing its own set of matching chunks.

Those retrieved chunks are then passed into the final Claude prompt as context — alongside the clinical findings and differential diagnoses. This is the "augmented" part of RAG. Claude reads the actual WHO guideline text and uses it to generate the Assessment & Plan, grounding its recommendations in specific protocols rather than general knowledge.

### Why RAG instead of just Claude + chat history

**Claude's training knowledge is frozen and general.** Claude knows about concussions in general. But it doesn't know the specific WHO 2024 imaging criteria thresholds, the exact dosage protocols for a given patient population, or the latest updated guidelines. The retrieved chunks give Claude current, specific protocol text it can reference directly — not a vague recollection from training data.

**The chat history is a patient conversation, not clinical guidelines.** The chat history is "my head hurts", "it's an 8/10", "I fell 3 days ago." That's symptom collection. The guideline chunks are clinical protocols: "For suspected intracranial injury post-trauma, obtain CT head without contrast within 1 hour if GCS < 13..." — structured medical knowledge the patient never provided and Claude may not reproduce accurately from memory.

**Without RAG:** You'd pass the entire chat history to Claude and say "generate an assessment." Claude reads the raw conversation ("my head hurts", "it's an 8/10", "I fell") and tries to piece together what's relevant, what the diagnoses should be, and what to recommend — all from its general training knowledge. The raw conversation is noisy, unstructured, and Claude has to do everything at once.

**With RAG (what we built):** Claude never sees the chat history at the assessment step. Instead it receives three pre-processed inputs:
- **Clinical findings** — structured, extracted data (not raw chat). Already distilled from the conversation by `extractFindings` after every message.
- **Differential diagnoses** — already determined by a previous Claude call via `generate_differentials`. Claude doesn't need to figure out what's wrong — that's already done.
- **Guideline chunks** — retrieved WHO protocol text, surfaced by the vector DB based on the specific diagnoses + findings for this patient.

Each input is purpose-built. The messy conversation was consumed earlier in the pipeline and never reaches this step. Claude's only job in `generateAssessment` is to synthesize structured inputs + evidence-based guidelines into a coherent Assessment & Plan.

**This also enables weaker/cheaper models.** Each step in the pipeline is a focused, simple task:
- `extractFindings` — "extract structured data from this one message" (runs on Haiku)
- `generate_differentials` — "given these findings, list possible conditions"
- `generateAssessment` — "given these findings, diagnoses, and guidelines, write a plan"

No model has to do everything at once. A weaker model can handle "synthesize these three structured inputs into a plan" much more reliably than "read this entire messy conversation, figure out what's wrong, recall the correct treatment protocols from memory, and write a plan." The pipeline does the hard work (extraction, retrieval, search) so the final generation step is straightforward.

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
- RAG fires once Claude has reached a diagnosis — not during the interview
- The query is the diagnosed condition + the patient's clinical findings combined as text
- The condition targets the right guideline; the clinical findings target the right section within it

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

## Guideline Download Pipeline

### Source: NCBI Bookshelf (not PMC)
WHO publishes their actual guideline documents to NCBI Bookshelf, not PubMed Central. PMC only has journal articles *about* WHO guidelines — not the guidelines themselves. Bookshelf hosts the full books and reports as structured XML.

### How to access
NCBI Bookshelf provides an FTP service for its Open Access subset:
- **FTP base URL:** `ftp://ftp.ncbi.nlm.nih.gov/pub/litarch/`
- **File list (CSV):** `ftp://ftp.ncbi.nlm.nih.gov/pub/litarch/file_list.csv`
- Each entry in the CSV includes: book title, publisher, publication date, accession number, last update
- Filter by publisher = "World Health Organization" to get only WHO documents
- Each book is packaged as a `.tar.gz` containing `.nxml` (structured XML), PDFs, and images

### Download steps
1. Fetch `file_list.csv` from the FTP
2. Parse CSV, filter for WHO-published entries
3. Download each matching `.tar.gz` from the FTP path
4. Extract `.nxml` files into `data/who-guidelines/raw/`
5. Rate limit downloads to respect NCBI servers

### Script
- `src/server/scripts/download-who-guidelines.ts`
- npm command: `npm run guidelines:download`

```bash
npm run guidelines:download
```

## Chunking Strategy

### Decision: Hierarchical section-based chunking

Use the `.nxml` section tree (`<sec>` elements) to split guidelines into chunks, with a max token limit that triggers recursive splitting into subsections.

### How it works

1. Parse the XML section tree — each `<sec>` element is a candidate chunk
2. If a section is under the max token limit → it becomes a chunk as-is
3. If a section exceeds the limit → split into its child `<sec>` elements and repeat
4. If a leaf section still exceeds the limit → fall back to paragraph-level splitting
5. Prepend the title hierarchy to every chunk (e.g., "Malaria > Treatment > Uncomplicated malaria in adults") so each chunk is self-contained
6. Apply ~100 token overlap at chunk boundaries to prevent context loss at split points

### Why hierarchical over pure section-based

Pure section-based chunking uses each `<sec>` element directly as a chunk without considering size. This works well when sections are reasonably sized, but WHO guidelines often have large top-level sections that cover multiple patient populations or treatment scenarios in one block.

A section titled "Treatment of malaria" might cover adults, children, and pregnant women in thousands of tokens. As a single chunk, the embedding becomes a diluted average of all three populations. When the clinical findings are "28-year-old pregnant woman with confirmed malaria", the retrieval needs to surface the pregnancy-specific treatment — not the entire treatment section where pregnancy is buried in the middle.

Hierarchical chunking solves this by going one level deeper only when a section is too large. The subsections — "Treatment in adults", "Treatment in children", "Treatment in pregnancy" — become individual chunks with focused embeddings that match more precisely against specific clinical findings.

For sections already at a reasonable size, hierarchical does nothing different from pure section-based. It only adds value at the edges where oversized sections would otherwise hurt retrieval precision.

### Why not other strategies

- **Fixed-size (token window):** Ignores document structure entirely. Can split a dosage table, contraindication list, or diagnostic criteria in half. Produces chunks that lack context and may be clinically incomplete.
- **By paragraph:** Too granular. A paragraph saying "Administer 20mg orally once daily for 3 days" is meaningless without knowing which drug, which condition, which patient population. Loses the clinical context that sections preserve.
- **By condition/topic:** Would require semantic understanding of content to group by medical condition. Harder to automate and the XML structure already provides this grouping implicitly through its section hierarchy.
- **Semantic chunking:** Uses embeddings to detect topic shifts. Adds complexity, cost (extra API calls), and an external dependency for a problem the XML structure already solves.

### Title hierarchy prefix

Every chunk gets its section ancestry prepended as context. This is critical because it makes each chunk self-contained — when Claude retrieves a treatment chunk, it immediately knows which condition and patient population without needing adjacent chunks or metadata lookups.

Example: A chunk from a nested subsection would be prefixed with:
`Malaria > Treatment > Uncomplicated malaria in pregnancy`

### Parsing & Chunking Script

- `src/server/scripts/parse-who-guidelines.ts`
- npm command: `npm run guidelines:parse`

```bash
npm run guidelines:parse
```

#### What it does

Reads all 4,715 `.nxml` files from `data/who-guidelines/raw/`, applies the hierarchical chunking strategy above, and outputs structured chunks to `data/who-guidelines/chunks.json`.

This script does **not** touch the database. The JSON file is an intermediate checkpoint between parsing and DB ingestion — it lets you inspect chunks, adjust parsing logic, and re-run without re-parsing thousands of XML files each time. The separate ingestion script (Step 3) reads this JSON, embeds each chunk via OpenAI, and inserts into the `guideline_chunks` table.

#### How it implements the strategy

The script uses `fast-xml-parser` to parse each `.nxml` file into a traversable object, then walks the `<sec>` tree with a recursive `chunkSection` function that implements the three-tier splitting:

1. **Section fits** (≤400 tokens) — becomes a single chunk, child section text included
2. **Section too large + has child `<sec>` elements** — own text (paragraphs, boxes, lists outside child sections) becomes a separate chunk; each child section recurses through the same logic
3. **Leaf section too large, no children** — falls back to paragraph-level grouping, where `<p>` elements and other content blocks are accumulated into chunks that stay under the token limit
4. **Chunk overlap** — when splitting content across multiple chunks, the last ~100 tokens of each chunk are carried into the start of the next chunk, preventing context loss at split boundaries

Token estimation uses a `chars / 4` heuristic, which is a reasonable approximation for English text with the `text-embedding-3-small` tokenizer.

#### File filtering

Skips non-clinical content by filename pattern:
- `fm-*` — front matter (preface, foreword, table of contents)
- `rl-*` — reference lists
- `ak-*` — acknowledgments

Everything else is parsed: chapters (`ch-*`), annexes (`annex-*`), appendixes (`app-*`), glossaries, and web annexes.

#### Metadata extraction

From each `.nxml` file, the script extracts:
- **Book title** from `<book-meta>` → `<book-title-group>` → `<book-title>`
- **Chapter title** from `<book-part-meta>` → `<title-group>` → `<title>`
- **Section titles** from each `<sec>` → `<title>`

These form the title hierarchy prepended to every chunk.

#### Output format

`data/who-guidelines/chunks.json` — an array of objects:

```json
{
  "source": "who311664_NBK541170_ch2",
  "section": "Guidelines on Physical Activity... > Recommendations > Physical Activity > Question",
  "content": "Guidelines on Physical Activity... > Recommendations > Physical Activity > Question\n\nIn children under 5 years of age what dose..."
}
```

- `source` — filename without `.nxml` extension, traces back to the specific archive and chapter
- `section` — title hierarchy path, used as metadata in the `guideline_chunks` DB table
- `content` — self-contained text with hierarchy prefix, ready for embedding

### Embedding & Ingestion Script

- `src/server/scripts/embed-who-guidelines.ts`
- npm command: `npm run guidelines:embed`

```bash
npm run guidelines:embed
```

#### What it does

Reads chunks from `data/who-guidelines/chunks.json`, embeds each via OpenAI `text-embedding-3-small`, and inserts into the `guideline_chunks` table. This is the bridge between the JSON checkpoint and the vector database.

#### How it works

1. Loads all chunks from the JSON file
2. Truncates `guideline_chunks` table (idempotent — safe to re-run)
3. Processes chunks in batches of 100 (OpenAI accepts multiple inputs per request)
4. For each batch: calls `openai.embeddings.create()` to get 1536-dim vectors
5. Inserts each chunk + embedding via `createGuidelineChunkMutation`
6. Logs progress every batch, closes DB pool when done

#### Cost and performance

- ~833 API calls for 83,247 chunks (batches of 100)
- Estimated cost: ~$1.50 (83,247 chunks × ~367 avg tokens = ~30.5M tokens at $0.02/1M for `text-embedding-3-small`)
- 3.5s delay between batches for rate limiting (~49 minutes total)

#### Pipeline summary

The full one-time prep pipeline is three scripts run in sequence:

```bash
npm run guidelines:download   # .tar.gz → .nxml files
npm run guidelines:parse       # .nxml → chunks JSON
npm run guidelines:embed       # chunks JSON → embeddings → DB
```

#### Sentence-level splitting fallback

The three-tier strategy (section → subsection → paragraph) handles most content, but some individual content blocks — GRADE evidence tables, systematic review summaries, large paragraphs — exceed the token limit as a single block that paragraph-level grouping can't break up further.

`groupBlocks` addresses this with a `splitBlock` function that acts as a final fallback:

1. If a single block exceeds `MAX_CHUNK_TOKENS`, split it by sentences (on `. ` boundaries)
2. Re-group sentences into sub-chunks that fit under the limit
3. If a sentence itself still exceeds the limit (e.g., a massive table with no sentence breaks), hard-split by character count

This brings all chunks under the embedding model's 8,192-token limit. With 400-token max chunk size and ~100 token overlap, the total chunk count is 83,247 at ~367 avg tokens. Some outlier chunks reach ~2,406 tokens from single sections where child content is included under the limit check.

## Step 4: Query Flow Service

### How the conversation triggers RAG

The `generate_differentials` tool is available to Claude during the clinical interview (stage 2, after demographics are collected). When Claude determines it has enough clinical findings, it calls the tool — but unlike `collect_demographics`, this tool never reaches the client. It's intercepted server-side in `runStream.ts`:

1. `contentBlock` handler separates `generate_differentials` from client-facing tools
2. `end` handler persists diagnoses to `differential_diagnoses` table
3. Conversation is marked as `completed` in the `conversations` table
4. `onDone` fires with `{ diagnoses: true }` metadata
5. Client hides input area and shows the AI Consult Summary

### Three-stage tool selection

The controller checks conversation state before each stream and passes exactly one tool:

- **Stage 1** (no profile) → `collect_demographics`
- **Stage 2** (profile exists, no diagnoses) → `generate_differentials`
- **Stage 3** (diagnoses exist) → no tools, conversation is complete

### Query flow service (`src/server/services/searchGuidelines.ts`)

Two functions:

**`embedQuery(text: string): Promise<number[]>`**
- Calls OpenAI `text-embedding-3-small` to embed the query text
- Returns a single 1536-dim vector (same model as ingestion — required for distance math to work)

**`searchGuidelines(condition: string, findings: Finding[]): Promise<GuidelineChunk[]>`**

Uses a dual-query strategy with re-ranking:

1. **Primary query** — embeds the condition alone (e.g. `"Malaria"`) for focused matches against guideline chunks that directly address the condition
2. **Secondary query** — embeds condition + all clinical findings (e.g. `"Malaria. symptom: fever 3 days. location: rural Ghana. medical_history: pregnant first trimester."`) for broader contextual matches
3. **Deduplication** — merges results from both queries, keeping the highest similarity score per chunk
4. **Re-ranking** — boosts similarity by 0.01 per clinical finding keyword found in the chunk content, nudging chunks that mention the patient's actual symptoms higher in results
5. **Threshold filter** — only returns chunks with similarity >= 0.50 (`MIN_SIMILARITY`)
6. **Returns** top-k chunks sorted by re-ranked similarity

The dual-query approach solves the dilution problem: embedding `"Malaria"` alone scores higher against malaria guideline chunks than embedding `"Malaria. symptom: fever. duration: 3 days. location: chest..."` where the findings dilute the condition signal. The secondary query still captures broader context that the condition-only query might miss.

### Assessment & Plan generation (`src/server/services/generateAssessment.ts`)

A single function that makes one Claude API call with all three inputs:

**Inputs — each serves a specific role in the prompt:**
- **Clinical findings** — what the patient presented with (symptoms, duration, severity, history). Tells Claude the clinical picture.
- **Differential diagnoses** — the conditions to assess, ranked by confidence. Tells Claude what to address.
- **Guideline chunks** — retrieved WHO protocol text relevant to each diagnosis for this patient. Grounds Claude's recommendations in evidence-based guidelines rather than general knowledge.

**How it works:**
1. Takes findings, diagnoses, and guideline chunks as parameters
2. Builds a system prompt instructing Claude to generate an Assessment & Plan grounded in the provided guidelines
3. Formats findings, diagnoses, and guideline text into a structured user message
4. Calls `client.messages.create()` (non-streaming, single response)
5. Returns the assessment text

**Why all three matter:**
- Without guidelines → Claude generates from general knowledge. May hallucinate dosages, miss locally relevant protocols, or give outdated recommendations.
- Without findings → Claude can't tailor the plan to this patient. A malaria treatment for a pregnant woman is different from one for a child.
- Without diagnoses → Claude doesn't know what conditions to address.

The assessment text is persisted to the `assessment` column on the `conversations` table and displayed in the AI Consult Summary — the final output of a completed consultation.

## Key Decisions
- [x] Guideline sources — WHO (primary) + Ghana STGs (secondary)
- [x] Guideline format — XML from NCBI Bookshelf Open Access subset
- [x] Embedding model — OpenAI `text-embedding-3-small` (1536 dimensions, upgraded from `text-embedding-ada-002`)
- [x] Chunking strategy — Hierarchical section-based using XML `<sec>` tree, 400 token max, ~100 token overlap
- [x] Search strategy — Dual query (condition-only + condition+findings), deduplication, keyword re-ranking, 0.50 similarity threshold
- [x] Diagnosis trigger mechanism — RAG fires post-diagnosis, query = condition + clinical findings
