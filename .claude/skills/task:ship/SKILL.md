---
name: task:ship
description: >
  Implement a task from the tasks/ board one at a time with user review after each.
  Uses tasks/BOARD.md for state and tasks/plans/ for details.
  Pauses for review after each task, then continues.
argument-hint: "[task ID, e.g. QW-1, ME-2, LC-3]"
---

# Task Implementation

Implement tasks from `tasks/BOARD.md` one at a time. After each task, pause for user review before continuing.

## Usage

```
/task:ship [task ID]
```

**Examples:**
- `/task:ship QW-1` — implement that specific task
- `/task:ship` — auto-detect: pick the next backlog task in priority order

---

## State Management

| What | Where |
|------|-------|
| Task board (statuses) | `tasks/BOARD.md` |
| Task plans (details) | `tasks/plans/<ID>.md` |
| Review reports | `docs/notes/SR-<ID>-<date>.md` |

**Statuses:** `backlog` → `in_progress` → `review` → `done`

To update status: edit the Status column in `tasks/BOARD.md` for the relevant task row.

---

## Phase 1: Load the Task

1. **Read `tasks/BOARD.md`** to see all tasks and their statuses.
2. **Determine the task.** If `$ARGUMENTS` provides an ID, use it. If none, pick the first `backlog` task in board order (priority).
3. **Read the plan** at `tasks/plans/<ID>.md` for implementation details.
4. **Check dependencies.** Tasks should generally be done in board order (QW before ME before LC).
5. **Update BOARD.md** — set the task's status to `in_progress`.
6. **Report to user:**
   ```
   Task: [ID] — [Name]
   Plan: tasks/plans/<ID>.md
   Starting implementation...
   ```

---

## Phase 2: Implement the Task

1. **Read the plan** at `tasks/plans/<ID>.md` to understand what needs to be built.
2. **Read any referenced files** — existing code, types, configs — to understand context.
3. **Per the project CLAUDE.md workflow:** Enumerate all suggested changes as a numbered list. Wait for user approval or a number selection before applying edits.
4. **Apply approved changes** using the Edit tool so VS Code shows the diff view.

### Verification (mandatory before presenting to user)

After implementation:

**Step A — Build check:**
```bash
npx tsc --noEmit
```
If it fails, fix errors and re-run.

**Step B — Read and verify:**
Trace the code path to confirm the change does what the plan specifies.

**Step C — Validate (when practical):**
- Config changes: verify syntax is valid
- Database changes: verify SQL is valid
- API changes: trace the call path

**The loop:** If any step fails → fix → re-verify. Do not present to user until verification passes.

---

## Phase 3: Pause for Review

**Stop and wait for user input.** Use `AskUserQuestion`:

```
"[Task ID] — [Name] is implemented. Review the changes?"
Options:
- "Looks good, continue" → mark task done, move to next
- "I have feedback" → wait for feedback, make fixes, re-present
```

**On approval:**
1. Update `tasks/BOARD.md` — set status to `done`
2. Update `tasks/plans/<ID>.md` — check off completed items in "Done When"
3. Check if more tasks remain in `backlog`
4. If yes: report what's next, go back to Phase 1
5. If no: go to Phase 4

**On feedback:**
1. Read the user's feedback
2. Make the requested changes
3. Re-verify
4. Re-present and pause again

---

## Phase 4: Batch Complete

When all tasks in a section (e.g., all Quick Wins) are done:

1. **Full verification pass:**
   ```bash
   npx tsc --noEmit
   ```

2. **Report:**
   ```
   Section complete: [Quick Wins / Medium Effort / Larger Changes]
   Tasks done: [list]
   Build: PASS
   Next section: [name] — ready to proceed?
   ```

3. **Retrospective:**
   ```
   ## Retrospective
   Validated by agent: [what was verified — build, code trace, etc.]
   Left to user: [what needs manual verification — deploy, load test, etc.]
   ```

---

## Principles

1. **Follow the CLAUDE.md workflow.** List proposed changes, wait for approval, apply via Edit tool.
2. **One task at a time.** Never implement multiple tasks without pausing for review.
3. **Read before writing.** Always read existing code and the plan before implementing.
4. **Follow existing patterns.** Match the codebase's conventions.
5. **Update the board.** Keep `tasks/BOARD.md` statuses current as you go.
6. **Don't scope-creep.** Only build what the plan specifies.
7. **Verify before presenting.** Never show the user code that doesn't build.
