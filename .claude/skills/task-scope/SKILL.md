---
name: task-scope
description: Create a new task through dialogue and codebase investigation. Explores the codebase, discusses requirements, then creates a structured task in tasks/BOARD.md with a detailed plan.
argument-hint: "[feature idea, problem to solve, or improvement]"
disable-model-invocation: true
---

# Create a New Task (Scoped)

Transform a feature idea or problem into a well-defined, implementable task through dialogue and codebase investigation.

## Workflow Position

```
brainstorm (optional) -> task-scope -> task:ship -> task:review
```

## Input

<task_idea> #$ARGUMENTS </task_idea>

If empty, ask: "What do you want to build or fix?"

## Phase 0: Context

1. **Read `tasks/BOARD.md`** (MANDATORY) — review existing tasks to understand the landscape
2. **Check for brainstorm output** in `docs/brainstorms/` matching this idea
3. **Check for related tasks** that might overlap

## Phase 1: Investigate

Explore the codebase to understand what exists:
- Search for relevant existing code, components, patterns
- Read related files to understand architecture
- Identify constraints and dependencies

## Phase 2: Dialogue

Walk through the task definition collaboratively using `AskUserQuestion`:

1. **Goal** — Single-sentence purpose
2. **Scope** — In scope vs explicitly out of scope
3. **Approach** — Propose 2-3 approaches based on investigation
4. **Priority** — Where does this fit in the board?
5. **Dependencies** — Other tasks this depends on
6. **Done when** — Acceptance criteria

**Rules:**
- Skip topics where brainstorm already provides answers
- If user says "you decide," make a recommendation and move on

## Phase 3: Create Task & Plan

### 3.1 Choose a task ID
Short, descriptive (e.g., PERF-1, FEAT-3, FIX-2).

### 3.2 Write plan to `tasks/plans/<ID>.md`

```markdown
# <ID>: <Task Name>

**Created:** <date>
**Priority:** <priority>
**Depends on:** <dependencies or "None">

## Goal
<One-sentence purpose>

## What You're Building
<2-3 paragraph description>

## Approach
<Chosen approach and rationale>

## Out of Scope
- <Exclusions>

## Changes
<Detailed changes with file paths>

## Done When
- [ ] <Criterion 1>
- [ ] <Criterion 2>
```

### 3.3 Add to `tasks/BOARD.md`
Add a row in the appropriate section with status `backlog`.

## Phase 4: Multi-Agent Review (optional for complex tasks)

Spawn 2-3 agents to critique the plan:
- **Technical Feasibility** — Are the proposed changes correct?
- **Scope & Completeness** — Right-sized? Missing edge cases?
- **Codebase Alignment** — Does the plan match actual code structure?

## Phase 5: Finalize

Ask the user:
1. **Start implementing** — `/task:ship <ID>`
2. **Refine** — Adjust scope or approach
3. **Add to backlog** — Leave for later

## Principles

1. **Dialogue first, writing second.**
2. **Investigate the codebase** — don't plan in the abstract.
3. **Keep tasks focused** — one task = one improvement.
4. **BOARD.md is the source of truth** for status. Plan files provide detail.

NEVER CODE! Just investigate, dialogue, and write the task definition.
