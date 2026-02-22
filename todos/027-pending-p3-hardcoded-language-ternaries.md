---
status: pending
priority: p3
issue_id: "027"
tags: [code-quality, maintainability, frontend]
dependencies: []
---

# Hardcoded language ternaries should use shared constants

## Problem Statement

Language-to-display-name mappings and language-specific strings are scattered across multiple files as hardcoded ternary expressions. If a new language is added, every ternary needs updating. The server already has `LANGUAGE_NAMES` in translate.ts but the client duplicates this logic.

## Findings

- `src/client/components/Conversation/index.tsx:338` — `language === "ak" ? "Twi" : language`
- `src/client/components/Conversation/index.tsx:349` — `language === "ak" ? "Kyerɛ me wo yare ho..." : "Type your message..."`
- `src/client/components/Home/index.tsx:23-24` — same placeholder ternary
- `src/server/services/translate.ts:7-13` — `LANGUAGE_NAMES` map (server-side only)

## Proposed Solutions

### Option 1: Create shared language constants

**Approach:** Create `src/shared/languages.ts` with display names, placeholders, and other per-language metadata. Import in both client and server.

**Effort:** 30 minutes

**Risk:** Low

## Acceptance Criteria

- [ ] Language display names defined in one place
- [ ] Language-specific placeholders defined in one place
- [ ] No hardcoded language ternaries in component files

## Work Log

### 2026-02-20 - Initial Discovery

**By:** Claude Code (code review)

**Actions:**
- Identified by code-simplicity-reviewer agent
