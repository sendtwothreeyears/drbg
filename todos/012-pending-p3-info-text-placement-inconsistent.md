---
status: pending
priority: p3
issue_id: "012"
tags: [ux, consistency, frontend]
dependencies: []
---

# Twi info text placement inconsistent between Home and Conversation

## Problem Statement

On Home, the "Your message will be translated..." info text appears below the input card. On Conversation, it appears inside the input card above the textarea. Inconsistent placement means users must search for the same information in different locations.

## Findings

- `src/client/components/Home/index.tsx:130-134` — info text outside GetStarted card
- `src/client/components/Conversation/index.tsx:343-346` — info text inside input card

## Proposed Solutions

Standardize placement: inside the input area, below the LanguageSelector and above the textarea, in both views.

**Effort:** 15 minutes

## Technical Details

**Affected files:**
- `src/client/components/Home/index.tsx`
- `src/client/components/Conversation/index.tsx`
