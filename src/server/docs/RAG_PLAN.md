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
4. Extract `.nxml` files into `data/who-guidelines/`
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

Reads all 4,715 `.nxml` files from `data/who-guidelines/`, applies the hierarchical chunking strategy above, and outputs structured chunks to `data/who-guideline-chunks.json`.

#### How it implements the strategy

The script uses `fast-xml-parser` to parse each `.nxml` file into a traversable object, then walks the `<sec>` tree with a recursive `chunkSection` function that implements the three-tier splitting:

1. **Section fits** (≤1,000 tokens) — becomes a single chunk, child section text included
2. **Section too large + has child `<sec>` elements** — own text (paragraphs, boxes, lists outside child sections) becomes a separate chunk; each child section recurses through the same logic
3. **Leaf section too large, no children** — falls back to paragraph-level grouping, where `<p>` elements and other content blocks are accumulated into chunks that stay under the token limit

Token estimation uses a `chars / 4` heuristic, which is a reasonable approximation for English text with the `text-embedding-ada-002` tokenizer.

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

`data/who-guideline-chunks.json` — an array of objects:

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

## Key Decisions
- [x] Guideline sources — WHO (primary) + Ghana STGs (secondary)
- [x] Guideline format — XML from NCBI Bookshelf Open Access subset
- [x] Embedding model — OpenAI `text-embedding-ada-002` (1536 dimensions)
- [x] Chunking strategy — Hierarchical section-based using XML `<sec>` tree
- [ ] Diagnosis trigger mechanism
