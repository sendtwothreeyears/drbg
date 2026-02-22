---
status: pending
priority: p1
issue_id: "019"
tags: [clinical-safety, translation, quality-assurance]
dependencies: []
---

# No quality verification of Twi output from OpenAI

## Problem Statement

The system instructs OpenAI (GPT-5.2) to conduct clinical interviews in Twi via a system prompt instruction, but there is no verification that OpenAI actually responds in Twi. Twi (Akan) is a low-resource language — research shows a ~45% performance gap between high-resource and African languages across LLMs. If GPT-5.2 responds in English (or garbled Twi), the response is streamed directly to the patient with no quality check. In a clinical context, miscommunication about symptoms could have health consequences.

## Findings

- `src/server/services/runStreamOpenAI.ts:17-27` — system prompt appends language instruction, but no post-stream verification
- `src/server/services/runStreamOpenAI.ts:105-109` — after stream completes, the Twi text is translated to English for storage, but the translation call does not validate that the source text is actually Twi
- If OpenAI responds in English instead of Twi, the "translation" from `ak→en` runs on English text, potentially corrupting it or wasting an API call
- ACL 2025 research confirms GPT-4o shows 12-19.9% performance gap on African languages; GPT-5.2 Twi capabilities are unvalidated
- No mechanism exists to detect garbled or mixed-language output

## Proposed Solutions

### Option 1: Language detection on streamed output

**Approach:** After the stream completes, run a lightweight language detection check on `fullText`. If the detected language doesn't match the expected language, log a warning and either (a) still translate as normal, or (b) skip translation and store as English.

**Pros:**
- Catches obvious failures (English instead of Twi)
- Can log quality metrics for monitoring

**Cons:**
- Adds latency after stream completion
- Language detection for Twi may not be reliable for short responses
- Does not catch semantically incorrect Twi

**Effort:** 2-3 hours

**Risk:** Medium (language detection accuracy for Twi)

### Option 2: Validate with native speakers (process solution)

**Approach:** Implement a weekly review process where a Twi-speaking clinician reviews a sample of 10 translated conversations for accuracy. Log all translations for audit.

**Pros:**
- Catches semantic errors, not just language detection failures
- Builds confidence in the system over time

**Cons:**
- Does not prevent real-time errors
- Requires staffing a bilingual reviewer

**Effort:** 4-6 hours (to build the logging/review tooling)

**Risk:** Low

### Option 3: Back-translation verification

**Approach:** After streaming, translate the Twi response back to English via a separate API call. Compare the back-translated English with what the system would have said in English. Flag significant semantic divergences.

**Pros:**
- Automated quality check
- Catches both language errors and semantic drift

**Cons:**
- Doubles translation API costs
- Back-translation comparison is imperfect

**Effort:** 4-6 hours

**Risk:** Medium

## Recommended Action

Combine Option 1 (lightweight language detection as a guardrail) with Option 2 (periodic human review) for production readiness. Option 3 is valuable for pre-launch validation but may be too expensive for every response.

## Technical Details

**Affected files:**
- `src/server/services/runStreamOpenAI.ts:98-109` — post-stream processing

**Related components:**
- `src/server/services/translate.ts` — translation service

## Acceptance Criteria

- [ ] System detects when OpenAI responds in wrong language
- [ ] Quality metrics are logged for Twi responses
- [ ] Fallback behavior defined when language detection fails
- [ ] Process established for periodic human review of Twi conversations

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by spec-flow-analyzer (G-18) and best-practices-researcher agents
- Confirmed by ACL 2025 African language evaluation research
