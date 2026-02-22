---
status: pending
priority: p2
issue_id: "024"
tags: [compliance, security, hipaa, configuration]
dependencies: []
---

# HIPAA BAA and Zero Data Retention configuration required

## Problem Statement

Patient symptom descriptions constitute Protected Health Information (PHI) under HIPAA. Every patient message is sent to OpenAI's API — both for translation (gpt-4o-mini) and for the clinical interview (gpt-5.2). Before any production use with real patient data, a Business Associate Agreement (BAA) must be in place with OpenAI, and Zero Data Retention (ZDR) must be configured.

## Findings

- `src/server/services/translate.ts:45-53` — patient text sent to OpenAI for translation
- `src/server/services/openai-chat.ts:18-24` — full conversation history sent to OpenAI for streaming
- Two separate OpenAI client instances exist (translate.ts and openai-chat.ts), both must be configured identically
- OpenAI offers BAAs for API services with ZDR enabled (contact baa@openai.com)
- With ZDR, OpenAI permanently deletes all request data once the API returns a response

## Proposed Solutions

### Option 1: Obtain BAA and configure ZDR

**Approach:**
1. Contact OpenAI at baa@openai.com to request a BAA
2. Enable Zero Data Retention in OpenAI dashboard at org or project level
3. Document the BAA and ZDR configuration
4. Consolidate to a single OpenAI client instance (relates to #015)

**Effort:** Configuration task, 1-2 days (mostly waiting for OpenAI)

**Risk:** Low (configuration, not code)

## Technical Details

**Affected files:**
- `src/server/services/translate.ts:3` — OpenAI client instance
- `src/server/services/openai-chat.ts:3` — OpenAI client instance

## Acceptance Criteria

- [ ] BAA executed with OpenAI
- [ ] ZDR confirmed enabled for all API endpoints used
- [ ] Single OpenAI client instance with consistent configuration
- [ ] Documentation of compliance configuration

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by best-practices-researcher agent during security analysis
