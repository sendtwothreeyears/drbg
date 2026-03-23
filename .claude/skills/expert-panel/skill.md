# Expert Panel Research

Spawn N specialized researcher agents with distinct expertise areas, then a synthesis agent that merges all findings into a single consensus document with resolved disagreements.

## When to Use

- Complex technical decisions with multiple dimensions (framework selection, architecture choices, strategy planning)
- User says "expert panel", "get multiple opinions", "research this from different angles"
- Any decision where a single perspective might miss important tradeoffs

## How It Works

### Step 1: Define Expert Roles

Choose 3-6 experts with **non-overlapping specializations** relevant to the decision. Each expert should cover a distinct angle so findings complement rather than duplicate.

Example for "how to fine-tune a model":
1. Framework selection expert
2. Hyperparameter optimization expert
3. Training data formatting expert
4. Infrastructure/deployment expert
5. Evaluation strategy expert

### Step 2: Spawn Experts in Parallel

Launch all expert agents simultaneously. Each agent:
- Is RESEARCH-ONLY (no code changes, no project file edits)
- Writes findings to `/docs/experts/expert-N-<topic>.md`
- Uses WebSearch for current information
- Reads relevant project files for context
- Produces a clear recommendation with pros/cons

**Prompt template for each expert:**
```
You are a RESEARCH-ONLY agent. Do NOT write any code or edit any project files.
Write your findings to /docs/experts/expert-N-<topic>.md only.

You are an expert in [SPECIALIZATION]. Research and recommend [SPECIFIC QUESTION].

Context:
- [Project-specific context]
- [Constraints and requirements]

Research and recommend:
1. [Specific sub-question]
2. [Specific sub-question]
...

Use WebSearch to find the latest information on [relevant topics].

Write your recommendation to /tmp/expert-N-<topic>.md with clear pros/cons and a final pick.
```

### Step 3: Synthesize

After all experts return, spawn one synthesis agent that:
- Reads ALL expert reports
- Identifies consensus (what everyone agrees on)
- Resolves disagreements (state both sides, make a final call with reasoning)
- Produces a single actionable document with:
  1. Consensus summary
  2. Disagreements and resolutions
  3. Recommended approach
  4. Concrete config/plan
  5. Step-by-step execution plan
  6. Risk factors

**Synthesis prompt template:**
```
You are a RESEARCH-ONLY agent. Write your synthesis to /tmp/<topic>-consensus.md only.

You are a senior [domain] engineer synthesizing recommendations from N domain experts.
Read all expert reports and produce a single, actionable consensus document.

Read these files:
- /tmp/expert-1-<topic>.md
- /tmp/expert-2-<topic>.md
...

Produce a consensus document with these sections:
1. Consensus Summary (what all experts agree on)
2. Disagreements & Resolution (both sides + final call)
3. Recommended Stack/Approach
4. Concrete Configuration
5. Step-by-Step Execution Plan
6. Risk Factors
```

### Step 4: Present and Save

- Show the user a concise summary of the consensus
- Save the full consensus document to the relevant project directory
- Optionally save to `docs/learning/<topic>/` if the user wants to learn from it

## Key Principles

- Each expert must write to a **separate file** — no shared state
- Experts should use **WebSearch** for current information (frameworks change fast)
- Experts should **read project files** for context (not just research in the abstract)
- The synthesis agent resolves disagreements **with reasoning**, not just majority vote
- Present the summary to the user, not the raw expert outputs

## Origin

Created during MedGemma-4B fine-tuning scoping session (2026-03-19). Five experts (framework, hyperparams, data format, Modal setup, eval strategy) produced a consensus training plan that resolved 6 disagreements across GPU choice, learning rate, epochs, dropout, target modules, and sequence length.
