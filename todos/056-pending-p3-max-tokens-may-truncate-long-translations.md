---
status: pending
priority: p3
issue_id: "056"
tags: [correctness, translation, truncation]
dependencies: []
---

# max_tokens: 4096 may truncate long assessment translations

## Problem Statement

`translate.ts` sets `max_tokens: 4096` globally for all translation calls. With the new `maxLength: 8000` for assessments, a long English assessment (5000+ chars) translated to Twi (non-Latin script) could require more than 4096 tokens. The translation would be silently truncated by the OpenAI API, potentially cutting off mid-sentence in clinical content.

## Findings

- `src/server/services/translate.ts:53` — `max_tokens: 4096` applies to all translations
- For 8000-char English input, Twi translation could be 2000-3000+ tokens (usually within limit)
- For borderline cases (~6000 chars), truncation is possible
- The `MAX_OUTPUT_RATIO` check at line 62-64 would catch grossly oversized output but not truncated output
- OpenAI returns a `finish_reason: "length"` when truncating, but this is not checked

## Proposed Solutions

### Option 1: Scale max_tokens with input length

**Approach:**
```typescript
max_tokens: Math.min(Math.ceil(text.length * 1.5), 16384),
```

**Pros:**
- Handles both short messages and long assessments
- Self-scaling

**Cons:**
- Higher potential cost per call (but bounded by input length)

**Effort:** 30 minutes

**Risk:** Low

---

### Option 2: Check finish_reason and warn on truncation

**Approach:** After the API call, check `response.choices[0].finish_reason === "length"` and log a warning or retry.

**Pros:**
- Detects actual truncation rather than guessing
- Can be combined with Option 1

**Cons:**
- Retry logic adds complexity

**Effort:** 1-2 hours

**Risk:** Low

## Recommended Action

**To be filled during triage.**

## Technical Details

**Affected files:**
- `src/server/services/translate.ts:53` - max_tokens setting

## Resources

- **Commit:** d5e3b9f

## Acceptance Criteria

- [ ] Long assessment translations are not truncated
- [ ] Truncation is detected if it occurs
- [ ] Tests pass

## Work Log

### 2026-02-21 - Initial Discovery

**By:** Claude Code (review of commit d5e3b9f)

**Actions:**
- Identified potential truncation for long non-Latin translations
- Proposed scaling and detection approaches

**Learnings:**
- Fixed max_tokens values don't scale well with variable input lengths
- OpenAI's finish_reason should be checked to detect silent truncation
