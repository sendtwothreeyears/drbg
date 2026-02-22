# Multilingual Translation Research for Boafo

**Date:** 2026-02-19
**Status:** Active research — informing architecture decisions

## Context

Boafo is a clinical decision support system that conducts patient interviews via Anthropic's Claude API. The current pipeline is English-only. We need to support patients who read and write in Ghanaian languages (Twi, Akan, Ewe, Ga, Dagbani) with planned expansion to Nigerian languages (Hausa, Yoruba, Igbo).

## Architecture Decision

**Pattern: Translate at the boundaries, reason in English.**

- Patient-facing conversation stays in their chosen language
- Server translates patient input to English before sending to Claude
- Claude performs all clinical reasoning (interview, extraction, assessment) in English
- Server translates Claude's English response back to the patient's language
- Both English and native language transcripts are persisted in the database

### Why not let Claude handle the languages directly?

The pipeline makes **three separate Claude calls**:

1. **Interview streaming** (Opus) — visible to the user, errors are noticeable
2. **Clinical findings extraction** (Haiku) — runs in the background, invisible to the user
3. **Assessment generation** (Sonnet) — final clinical output

The highest risk is in step 2: Haiku is a smaller model with weaker low-resource language support. If it silently miscategorizes or drops a clinical finding from Twi input, the differential diagnoses and assessment are built on incomplete data — and nobody sees the failure.

By translating to English at the server boundary, all three Claude calls operate in Claude's strongest language.

### Streaming trade-off

Translation at the boundary means Claude's streamed response must be fully received before translating back to the patient's language. Options:

- Buffer full response, translate, then render (simplest, adds latency)
- Translate sentence-by-sentence as stream completes each sentence
- Stream English to clinician view, show translated version to patient view

## Translation Service Comparison

### Coverage Matrix

| Language    | Google Cloud | GhanaNLP Khaya |   Azure    |   Amazon   |    Claude    | NLLB-200  |
| ----------- | :----------: | :------------: | :--------: | :--------: | :----------: | :-------: |
| **Twi**     |  Yes (`ak`)  |    **Yes**     |     No     |     No     |   Limited    |    Yes    |
| **Akan**    |  Yes (`ak`)  |    **Yes**     |     No     |     No     |   Limited    |    Yes    |
| **Ewe**     |  Yes (`ee`)  |    **Yes**     |     No     |     No     |   Limited    |    Yes    |
| **Ga**      | Yes (`gaa`)  |    **Yes**     |     No     |     No     | Very limited | Uncertain |
| **Dagbani** |    **No**    |    **Yes**     |   **No**   |   **No**   | Very limited |  **No**   |
| **Hausa**   |  Yes (`ha`)  |       No       | Yes (`ha`) | Yes (`ha`) |   Moderate   |    Yes    |
| **Yoruba**  |  Yes (`yo`)  |    **Yes**     | Yes (`yo`) |     No     |   Moderate   |    Yes    |
| **Igbo**    |  Yes (`ig`)  |       No       | Yes (`ig`) |     No     |   Moderate   |    Yes    |

### Recommended Services

#### GhanaNLP Khaya (Primary for Ghanaian languages)

- **URL:** https://translation.ghananlp.org/
- **Coverage:** Only service supporting ALL 5 Ghanaian languages including Dagbani
- **Features:** Translation API, Speech-to-Text, Text-to-Speech
- **API:** REST API at `translation.ghananlp.org` with `POST /translate` endpoint
- **Pricing:** Subscription-based via developer portal (sign up required for details)
- **Quality:** Purpose-built for Ghanaian languages with 500+ community contributors
- **Also supports:** Kusaal, Gurene (Farefare/Frafra), Kikuyu, Kimeru, Luo

#### Google Cloud Translation (Primary for Nigerian languages)

- **URL:** https://cloud.google.com/translate
- **Coverage:** Hausa, Yoruba, Igbo + Twi, Ewe, Ga (fallback for Ghanaian)
- **Pricing:** $20/M characters (NMT), first 500K chars/month free
- **Quality:** Functional but below high-resource language quality; Twi/Ewe added 2022
- **Note:** Does NOT support Dagbani

#### Meta NLLB-200 (Open-source alternative)

- **URL:** https://huggingface.co/facebook/nllb-200-3.3B
- **Coverage:** Twi, Akan, Ewe, Hausa, Yoruba, Igbo (no Dagbani, Ga uncertain)
- **Self-hosted:** Free model weights, requires GPU infrastructure
- **Sizes:** 600M (distilled), 1.3B, 3.3B, 54.5B (MoE)
- **License:** CC-BY-NC 4.0 (non-commercial for 54.5B)
- **Quality:** 44% average BLEU improvement over prior SOTA for supported languages

### Claude's Translation Capability (Benchmark Data)

From Williams College research (arxiv:2404.13813), tested on BBC News into English:

| Direction         | Claude chrF++ | NLLB-54B chrF++ |
| ----------------- | :-----------: | :-------------: |
| Yoruba -> English |   **43.78**   |      42.53      |
| Hausa -> English  |     45.88     |    **47.38**    |
| Igbo -> English   |     52.31     |    **55.37**    |

Claude is competitive for Yoruba but generally weaker than dedicated NMT for other languages. Strong into-English, weaker out-of-English.

## Server Architecture Implications

### Translation routing factory

The server needs a translation service factory that:

1. Accepts the patient's selected language at conversation start
2. Routes to the appropriate translation provider (GhanaNLP for Ghanaian, Google for Nigerian)
3. Exposes a consistent interface regardless of provider

### Database changes needed

- `conversations` table: add `language` column
- Store both original and English transcripts in `messages` table
- Language preference persists for the entire conversation

### Frontend changes needed

- Language selector on Home page (before symptom entry)
- All UI labels need i18n support (currently hardcoded English in components)
- These languages use Latin script with diacritical marks (no RTL or alternative script support needed)
- Special characters: Twi (ɛ, ɔ), Ewe (ɖ, ɛ, ƒ, ɣ, ɔ, ʋ), Ga (ɛ, ɔ, ŋ), Dagbani (ɛ, ɔ, ŋ, ʒ, ɣ)

## Key Risks

1. **Medical terminology in low-resource languages** — Translation quality for clinical terms may be poor. Consider maintaining a curated medical glossary for each language.
2. **Silent extraction failures** — Even with English translation, verify that clinical findings extraction produces consistent results from translated text vs. native English input.
3. **Dagbani is the hardest language** — Only GhanaNLP supports it. If Khaya goes down, there is no fallback.
4. **Translation adds latency** — Two translation round-trips per message exchange. Monitor and optimize.

## References

- [GhanaNLP Developer Portal](https://translation.ghananlp.org/)
- [Google Cloud Translation Languages](https://docs.google.com/translate/docs/languages)
- [Meta NLLB-200 on Hugging Face](https://huggingface.co/facebook/nllb-200-3.3B)
- [Claude Translation Research (arxiv:2404.13813)](https://arxiv.org/abs/2404.13813)
- [Anthropic Multilingual Docs](https://docs.claude.com/en/docs/build-with-claude/multilingual-support)
- [Microsoft Azure - 13 New African Languages](https://www.microsoft.com/en-us/translator/blog/2023/03/08/introducing-13-new-african-languages/)
