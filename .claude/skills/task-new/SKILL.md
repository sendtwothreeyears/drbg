---
name: task-new
description: Quick task creation in tasks/BOARD.md. Creates a task with a plan file. The simple/fast version — use /task-scope for dialogue-heavy planning.
---

# Task Planner (Quick)

Add tasks to `tasks/BOARD.md` with plan files. Fast path — minimal questions.

## When to Use
- User says "/task-new" or asks to quickly add a task
- For simple, well-understood work items
- Use `/task-scope` for complex tasks needing dialogue

## Procedure

### Step 1: Gather Info

If not already provided, ask:
1. **Task ID** — short identifier (e.g., FIX-1, FEAT-2)
2. **Task name** — short descriptive name
3. **Section** — which section of BOARD.md (or create new)
4. **Description** — what needs to be done

### Step 2: Write Plan File

Write to `tasks/plans/<ID>.md`:

```markdown
# <ID>: <Task Name>

**Impact:** <what it fixes/improves>
**Effort:** <Low/Medium/High>
**Risk:** <Low/Medium/High>

## Problem
<What's wrong or what's needed>

## Changes
<What files/code to modify and how>

## Done When
- [ ] <Criterion 1>
- [ ] <Criterion 2>
```

### Step 3: Add to Board

Edit `tasks/BOARD.md` — add a new row in the appropriate section:
```
| <ID> | <Task name> | backlog | [plan](plans/<ID>.md) |
```

### Step 4: Report
Show the user the task ID, name, and plan path.

## Rules
1. Always write a plan file.
2. Keep plans concise — enough detail to implement without ambiguity.
3. Task IDs should be short and descriptive.
