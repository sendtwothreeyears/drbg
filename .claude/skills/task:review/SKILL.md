---
name: task:review
description: Review a completed task from tasks/BOARD.md. Validates deliverables, checks code quality, and gates progression. Use after completing a task or when the user says "/task:review [ID]".
---

# Task Review

Review a completed task using `tasks/BOARD.md`. Validate that deliverables are met, code quality is acceptable, and the task is truly done.

## Phase 1: Identify the Task

1. Read `tasks/BOARD.md` to find tasks with status `review` or `done`
2. **If the user provided an ID** (e.g., `/task:review QW-1`), use that task
3. **If no ID**, auto-detect: pick the first task in `review` status
4. Read the plan at `tasks/plans/<ID>.md`
5. Confirm: "Reviewing Task: [ID] — [Name]. Proceed?"

## Phase 2: Validate Deliverables

Go through each "Done When" criterion in `tasks/plans/<ID>.md` and **actually verify it.**

### For Each Criterion
- **Criterion:** The exact "done when" text
- **Status:** PASS or FAIL
- **Evidence:** What was checked and what was found

### Validation Methods
- **Build check:** `npx tsc --noEmit`
- **File checks:** Confirm expected code exists with expected behavior
- **Code inspection:** Read the code and confirm described behavior is implemented
- **SQL checks:** Verify schema/queries are valid
- **Config checks:** Verify config syntax and values

## Phase 3: Code Quality Review

Focus on:
1. **Correctness** — Does the code do what the plan requires?
2. **Missing edge cases** — Obvious failure modes not handled
3. **Performance** — Any obvious bottlenecks introduced?
4. **Tech debt** — Shortcuts that should be tracked

Categorize findings as:
- **P1 (CRITICAL)** — Blocks progression
- **P2 (IMPORTANT)** — Should fix
- **P3 (NICE-TO-HAVE)** — Note and move on

## Phase 4: Write Review

Create `docs/notes/SR-<ID>-<YYYYMMDD>.md`:

```markdown
# Task Review: [ID] — [Name]

**Date:** [YYYY-MM-DD]
**Status:** PASS | FAIL

## Validation Results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| [Done when text] | PASS/FAIL | [What was checked] |

## Findings

[P1/P2/P3 list, or "No findings"]

## Next Steps

[If PASS: "Task complete. Marked done on board."]
[If FAIL: "Fix these items: [list]"]
```

## Phase 5: Update Board

### If PASS
1. Update `tasks/BOARD.md` — set status to `done`
2. Check off all items in `tasks/plans/<ID>.md`
3. Tell the user: task complete, summary of what was validated

### If FAIL
1. Update `tasks/BOARD.md` — set status back to `in_progress`
2. Tell the user: which criteria failed, what needs fixing
