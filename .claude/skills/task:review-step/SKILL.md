---
name: task:review-step
description: "Deep code quality review of all code introduced in a task. Reviews implementation against spec, finds bugs, and produces a structured report. Use after completing a task or when the user says '/step-review [ID]'."
---

# Step Review

Deep code quality review of a task's implementation. Reviews every file introduced or modified, validates spec compliance, and produces a structured report with prioritized findings.

**Difference from task:review:** task:review gates progression by validating "done when" criteria. task:review-step digs into actual code quality — bugs, races, edge cases, performance, correctness.

## Phase 1: Identify the Task

1. Read `tasks/BOARD.md` to find tasks in `review` or `done` status
2. If user provided an ID, use it. Otherwise auto-detect.
3. Read `tasks/plans/<ID>.md` for the full spec
4. Confirm: "Reviewing [ID] — [Name]"

## Phase 2: Build Review Scope

1. Read the plan to understand what each change should do
2. Identify all files created or modified (from the plan + git diff)
3. Build a review manifest: `(change, file, expected behavior)`

## Phase 3: Spec Compliance

For each item in the plan's task list:

| Requirement | Status | Location |
|---|---|---|
| [from plan] | PASS/FAIL/PARTIAL | [file:line] |

Read the code and confirm behavior is actually implemented, not just that files exist.

## Phase 4: Code Quality Review

### 4.1 Correctness
- Logic errors, off-by-one, incorrect assumptions
- Error paths that swallow errors silently

### 4.2 Resource Management
- Connections, streams, listeners cleaned up properly
- Async operations with proper timeout/cancellation

### 4.3 Concurrency & State
- Race conditions between async operations
- Re-entry guards

### 4.4 Performance
- Unnecessary work in hot paths
- Unbounded growth

## Phase 5: Categorize Findings

- **P1 (CRITICAL)** — Runtime errors, resource leaks, data loss. Must fix.
- **P2 (IMPORTANT)** — Race conditions, missing guards, incorrect error handling. Should fix.
- **P3 (MINOR)** — Performance observations, minor improvements. Note and move on.

Each finding includes:
- **Location:** `file:line`
- **Problem:** Specific description
- **Impact:** What happens if unfixed
- **Fix:** Concrete suggestion
- **Effort:** Small / Medium / Large

## Phase 6: Write Report

Create `docs/notes/SR-<ID>-<YYYYMMDD>.md`:

```markdown
# Step Review: [ID] — [Name]

**Date:** [YYYY-MM-DD]
**Files reviewed:** [count]
**Status:** PASS | PASS WITH FINDINGS | FAIL

## Spec Compliance
[Table from Phase 3]

## Findings
### P1 — Critical
[List or "None"]

### P2 — Important
[List or "None"]

### P3 — Minor
[List or "None"]

## Verdict
[PASS/FAIL with reasoning]
```

## Phase 7: Present and Offer Fixes

If P1/P2 findings exist, offer:
- "Fix all P1 and P2" — apply fixes, re-verify
- "Fix P1 only" — fix blockers, note P2
- "Don't fix, just note them"
