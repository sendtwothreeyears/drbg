---
name: research-boafo
description: Load Boafo research docs and teaching insights to inform implementation decisions. Use when making architectural or feature decisions in the Boafo clinical decision support system.
user_invocable: true
---

# Research Boafo

## How to use

When the user invokes `/research-boafo`, load all relevant research and teaching context for the Boafo project to inform implementation decisions.

## Steps

1. **Load research documents:**
   - Read all files in `/Users/Shared/Code/KasaMD/boafo/docs/research/` — these contain distilled research findings (translation services, architecture decisions, benchmarks).

2. **Load teaching session insights:**
   - Check `memory/claude-teachings/` for all Boafo-related teaching entries — these capture the user's evolving understanding, identified gaps, and architectural reasoning developed through Socratic dialogue.

3. **Load project context:**
   - Read `/Users/Shared/Code/KasaMD/boafo/CLAUDE.md` for project conventions.
   - Scan the current codebase state for relevant files based on the user's question.

4. **Synthesize and advise:**
   - Cross-reference the research findings with the user's current question or task.
   - Surface relevant architectural decisions, trade-offs, and risks from the research docs.
   - Reference what the user has already learned from teaching sessions — build on that foundation, don't repeat it.
   - If the research docs don't cover the user's question, proceed to step 5.

5. **Conduct new research (when existing docs don't cover the question):**
   - Before researching, scan all existing docs in `docs/research/` for related context. New research should build on — not duplicate — prior findings.
   - Use WebSearch and WebFetch to gather information. Prioritize official documentation, benchmarks, and peer-reviewed sources.
   - Structure findings using the research doc template (see below).
   - Cross-reference: add a `## Related Research` section linking back to any existing docs that informed or connect to this research.
   - Save to `docs/research/<topic-slug>.md`.
   - After saving, append the new topic to the "Current topics" list at the bottom of this skill file.

### Research doc template

```markdown
# <Topic Name>

**Date:** YYYY-MM-DD
**Status:** Active research | Decision made | Outdated

## Context

Why this research was needed. Link to the user question or feature that triggered it.

## Related Research

- [`<filename>.md`](./filename.md) — How it connects to this topic

## Findings

Core research results — service comparisons, benchmarks, API details, architectural options.

## Recommendations

Actionable conclusions based on findings.

## Key Risks

What could go wrong. What's uncertain.

## References

- [Source Name](url) — what it provided
```

## Rules

- **Always ground advice in the research docs.** Don't make claims about service capabilities without referencing the documented findings.
- **Reference teaching insights.** If the user explored a topic through `/teach-me`, acknowledge what they already understand and build from there.
- **Flag outdated research.** If research docs are more than 3 months old, note that the findings should be re-verified (APIs change, new services launch).
- **Propose updates.** If the conversation produces new findings or decisions, offer to update the relevant research doc.
- **Follow the CLAUDE.md workflow.** Enumerate suggested changes as a numbered list and wait for approval before implementing.

## Research docs location

All research is stored in `/Users/Shared/Code/KasaMD/boafo/docs/research/`. Current topics:

- `multilingual-translation.md` — Translation service comparison for Ghanaian/Nigerian languages, architecture pattern for multilingual clinical pipeline
