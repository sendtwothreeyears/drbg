---
status: pending
priority: p3
issue_id: "067"
tags: [ux, email]
dependencies: []
---

# Misleading Email UX — mailto: Cannot Attach PDF

## Problem Statement

The email button opens a `mailto:` link with body text saying "attach it to this email." The `assessmentCTA` i18n string says users can "email it to your doctor." But `mailto:` cannot attach files — it only opens a blank email template. In a clinical context, this may lead clinicians to believe the PDF was sent when it was not.

Additionally, the email subject/body text is hardcoded in English even for Twi-speaking users.

## Findings

- `src/client/components/Conversation/index.tsx:185-191` — `handleEmail` uses `window.open('mailto:...')`
- `src/client/i18n/en.json:20` — CTA implies email sends the PDF

## Proposed Solutions

### Option 1: Update copy to clarify manual attachment needed

**Effort:** 15 minutes | **Risk:** Low

### Option 2: Remove email button until server-side email is implemented

**Effort:** 10 minutes | **Risk:** Low

## Work Log

### 2026-02-22 - Code Review Discovery

**By:** Claude Code (review of commit 870c9f7)
