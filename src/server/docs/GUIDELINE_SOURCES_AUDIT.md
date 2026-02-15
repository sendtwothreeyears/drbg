# Guideline Sources Audit

Conducted 2026-02-15 while evaluating whether to add Ghana STGs (Phase 3 from RAG_PLAN.md).

## WHO Guidelines — Current State

83,247 chunks from 3,109 unique sources embedded in `guideline_chunks`.

### Clinically Relevant (~40-60 sources)

These are actual clinical treatment guidelines — the content the RAG pipeline was built for:

- **Malaria:** WHO Guidelines for malaria (treatment protocols + vector control)
- **Hypertension:** Pharmacological treatment in adults, drug treatment in pregnancy (severe and non-severe)
- **Diabetes:** Second/third-line medicines and insulin types, care for women with diabetes during pregnancy
- **Pneumonia & diarrhoea:** Management in children up to 10 years
- **Tuberculosis:** Consolidated treatment guidelines, drug-resistant TB treatment, isoniazid-resistant TB, preventive treatment, latent TB management
- **HIV:** Consolidated prevention/testing/treatment, post-exposure prophylaxis, advanced disease management, rapid ART initiation, PMTCT, long-acting injectable cabotegravir/lenacapavir for prevention, service delivery, clinical management
- **Hepatitis B/C:** Treatment, testing, antiviral prophylaxis in pregnancy
- **Meningitis:** Diagnosis, treatment and care
- **Sickle cell disease:** Management during pregnancy, childbirth and interpregnancy period
- **STIs:** Management of symptomatic and asymptomatic infections
- **Influenza:** Clinical management of severe illness, clinical practice guidelines
- **Mpox:** Clinical management and infection prevention
- **Maternal health:** Postpartum haemorrhage prevention/diagnosis/treatment, abortion care
- **Infection prevention:** Surgical site infection prevention, hand hygiene, intravascular catheter infections, carbapenem-resistant organisms
- **Other:** Anaemia (haemoglobin cutoffs), lymphatic filariasis, African trypanosomiasis, visceral leishmaniasis, histoplasmosis/cryptococcal disease in HIV, chronic pain in children, infertility

### Non-Clinical Dilution (~3,050 sources)

Content that never surfaces for clinical queries but adds bulk and embedding cost:

- Research ethics (CIOMS International Ethical Guidelines)
- Spanish-language duplicates of English guidelines (Directrices de la OMS...)
- Public health policy (drinking water quality, recreational water, waste practices)
- Nutrition policy (fortification of wheat/rice, breastfeeding promotion, carbohydrate intake)
- Health systems (infection prevention programs at national level, immunization policy, refugee/migrant integration)
- Program management (NCD management during migration, early childhood development, school health services)

### Impact

Non-clinical chunks don't actively poison retrieval — the 0.50 similarity threshold filters them out for clinical queries. The practical cost is negligible:

- **Embedding cost:** ~$1.50 for all 83,247 chunks — already spent, sunk cost
- **Per-query cost:** Zero additional. The search query is embedded (one API call, fractions of a cent), then pgvector compares it against stored vectors entirely in Postgres — no extra embedding API calls regardless of how many vectors exist
- **Query speed:** pgvector handles millions of vectors comfortably. 83K vs 15K makes no perceptible difference in query latency
- **Storage:** ~512 MB of vector data in Postgres — not a concern
- **Retrieval quality:** The 0.50 similarity threshold already prevents non-clinical chunks from surfacing. Research ethics and Spanish policy docs never make it into the top-5 for a clinical query

### Recommendation

WHO cleanup is low priority. The non-clinical chunks are dead weight but cheap dead weight — they don't cost anything per query, don't hurt retrieval quality, and are already embedded. Only worth doing if re-embedding for other reasons (e.g., switching embedding models).

---

## NICE Guidelines — Current State

Condition-by-condition clinical management guidelines sourced from nice.org.uk. Each guideline targets a specific condition with evidence-based diagnostic criteria and management pathways.

### Coverage

Broad UK primary and secondary care: acute coronary syndromes, acute kidney injury, asthma, atrial fibrillation, bipolar disorder, breast cancer, bronchiectasis, COPD, chronic pain, dementia, depression, diabetes, epilepsy, heart failure, hypertension, IBD, lower back pain, meningitis, osteoarthritis, pneumonia, sepsis, stroke, UTIs, and many more.

### Limitation

UK-centric — different drug formularies (NHS), different disease burden, different healthcare infrastructure than West Africa. Drug names, dosing, and availability may not match what's available in Ghanaian facilities.

### Value

Evidence-based diagnostic criteria and management pathways are broadly applicable regardless of geography. The clinical decision-making frameworks (when to refer, red flag symptoms, investigation ordering) transfer well.

---

## Ghana STGs — Assessment (NOT included)

7th Edition (2017), published by Ghana National Drugs Programme (GNDP) under the Ministry of Health. 708 pages, 260+ conditions across 24 chapters. PDF downloaded to `data/ghana-stgs/raw/GHANA-STG-2017-1.pdf`.

### Unique Value

- Ghana-specific drug formulations and locally available medications
- Weight-based dosing tables for drugs on the Ghana Essential Medicines List
- Local disease burden priorities (e.g., sickle cell prevalence, tropical infections)
- Ghana-specific antimicrobial resistance patterns
- Referral criteria appropriate for Ghana's healthcare infrastructure

### Risks Identified

**Outdated (2017):** 9 years old as of 2026. Antimalarial resistance patterns have shifted, drug formulations may have changed, treatment protocols may have been superseded by newer WHO guidance.

**Conflict risk:** The retrieval pipeline has no mechanism to resolve conflicts between sources. All chunks compete equally — no source filtering, no source prioritization, no recency weighting. If WHO says one thing about malaria treatment and Ghana STG 2017 says another, both chunks get sent to the LLM with equal weight in `generateAssessment`. This is a patient safety concern for pharmacological content.

**Parsing complexity:** Moderate but not a blocker. The PDF structure is consistent across all 708 pages — numbered conditions within chapters, each with consistent sub-sections (Causes, Symptoms, Signs, Investigations, Treatment, Referral Criteria). `pdftotext -layout` preserves table alignment. Requires regex-based section detection, running header removal (`— Condition Name —` in margins), `yy` bullet marker normalization, and chapter context tracking.

### Decision

**Deferred.** WHO already covers the major overlapping conditions (malaria, hypertension, diabetes, TB, HIV, pneumonia, meningitis) with more current protocols. The conflict and outdatedness risks outweigh the local specificity benefit at this stage.

---

## Overlap Analysis

| Condition | WHO | NICE | Ghana STG 2017 |
|-----------|-----|------|-----------------|
| Malaria | Yes (treatment protocols) | No | Yes (detailed dosing tables) |
| Hypertension | Yes (pharmacotherapy) | Yes | Yes |
| Diabetes | Yes (insulin/2nd-3rd line) | Yes | Yes |
| Tuberculosis | Yes (extensive) | Yes | Yes |
| HIV/AIDS | Yes (extensive) | Yes | Yes |
| Pneumonia | Yes (children <10) | Yes | Yes |
| Diarrhoea | Yes (children <10) | No | Yes |
| Meningitis | Yes | Yes | Yes |
| Sickle cell | Yes (pregnancy only) | Yes | Yes (broader) |
| STIs | Yes | Yes | Yes |
| Hepatitis B/C | Yes | Yes | Yes |

WHO versions are more current for all overlapping conditions. Ghana STG adds local drug availability and dosing specificity, but the 2017 date makes pharmacological content unreliable.

---

## Retrieval Pipeline Context

How chunks are searched and served — relevant to understanding noise and conflict impact:

- **Search:** Dual-query strategy (condition-only + condition+findings), cosine similarity via pgvector
- **Threshold:** 0.50 minimum similarity (hard filter — chunks below this are discarded)
- **Top-K:** 5 chunks per condition after deduplication and re-ranking
- **Source filtering:** None — all sources compete equally at query time
- **Conflict resolution:** None — LLM receives all matched chunks with equal weight
- **Re-ranking:** +0.01 similarity boost per patient finding keyword found in chunk content
- **Embedding model:** OpenAI `text-embedding-3-small` (1536 dimensions)

---

## Recommended Next Steps

1. **Monitor retrieval quality** — Run test queries for common conditions (malaria, hypertension, pneumonia) and inspect which chunks surface. Identify gaps where WHO/NICE don't provide adequate coverage.
2. **Revisit Ghana STGs** only if specific coverage gaps are found that WHO/NICE don't address.
3. **Consider source-year metadata** if adding future sources — add a `year` column to `guideline_chunks` and modify the `generateAssessment` system prompt to instruct the LLM to prefer more recent sources when guidelines conflict.
4. **WHO cleanup** — Low priority. Filter to clinical-only sources and re-embed only if re-embedding for other reasons (e.g., switching embedding models). The non-clinical chunks don't actively harm retrieval.
