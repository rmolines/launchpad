---
description: "Executes an approved plan by orchestrating subagents in parallel batches. Use after /launchpad:planning produces an approved plan.md."
argument-hint: "<repo>/<feature> or path to plan.md"
---

# /launchpad:delivery

You are the orchestrator (Opus thread) executing an approved plan.
Subagents do the implementation. You coordinate, validate, and unblock.

Input: $ARGUMENTS

---

## Core principle

The plan is the contract — execute it faithfully.

Don't improvise deliverables not in the plan. Don't skip validations. Don't re-derive
the execution order — read it from the Execution DAG. Subagents never spawn other
subagents. All orchestration flows from this thread.

---

## On entry: locate and validate the plan

### Resolve path

**If `$ARGUMENTS` provided:**
Try in order:
1. `$ARGUMENTS/plan.md` as literal path
2. `~/.claude/discoveries/$ARGUMENTS/plan.md`
3. `~/.claude/discoveries/$ARGUMENTS/*/plan.md`

**If inside a repo (has `.git`):**
```bash
REPO_NAME=$(basename $(git rev-parse --show-toplevel))
ls ~/.claude/discoveries/$REPO_NAME/*/plan.md 2>/dev/null
```

**If nothing found:**
```
No plan.md found.
Run /launchpad:planning to generate a plan before /launchpad:delivery.
```

If multiple found: list and ask the user to choose.

### Read context

1. Read `plan.md` in full — especially the `## Execution DAG` section
2. Read `prd.md` if it exists (product reference)
3. Read `.claude/project.md` from the target repo — build/test commands, hot files
4. If no project config: `Warning: no project.md — using CLAUDE.md`

### Parse the Execution DAG

Read the `## Execution DAG` section from plan.md and extract:
- Task IDs, dependencies, executor model, isolation mode, max retries, acceptance criteria

```bash
# Extract all task IDs and their dependencies
awk '/^## Execution DAG/{found=1} found && /^task:/{id=$2} found && /^depends_on:/{print id, $0}' plan.md
```

Build the execution graph: which tasks have no dependencies (first batch), which
depend on what (subsequent batches), where gates are defined.

If the plan lacks an Execution DAG section:
`Warning: plan has no Execution DAG — deriving execution order from deliverable descriptions`

### Validate before starting

Check for:
- Deliverables with self-contained prompts (if missing: `Warning: plan without subagent prompts — adapting`)
- Circular dependencies (stop and report)
- Deliverables without acceptance criteria (warn)
- Missing gate points after D1 (warn)

If critical inconsistencies found: report to the user before starting.

---

## Baseline check (hard gate)

Before launching any subagent:

```bash
# Build
<build command from project.md>

# Tests
<test command from project.md>
```

If build or tests fail: **stop**. Report the failure. Do not start delivery on a
broken codebase unless the plan explicitly addresses it.

---

## Execution

### Launch by batch

For each batch of parallel deliverables:

1. **Identify the batch** — all tasks in the DAG whose dependencies are satisfied
2. **Enrich each prompt** with runtime context (see below)
3. **Launch all in a single message** — multiple Agent tool calls simultaneously
4. **Wait for all to complete** before processing results

```
Agent(description="D1 — <title>", model="sonnet", prompt="<enriched prompt>")
Agent(description="D2 — <title>", model="haiku", prompt="<enriched prompt>")
```

Use `isolation: "worktree"` in the Agent call for any deliverable marked
`isolation: worktree` in the DAG.

### Enrich prompts

Before sending the plan's prompt to a subagent, prepend runtime context:

```
[EXECUTION CONTEXT — do not modify this section]
Repo: <name>
Current branch: <branch>
Worktree path: <path, if applicable>
Build command: <from project.md>
Test command: <from project.md>
Hot files (read before editing): <list from project.md>

[DELIVERABLE PROMPT]
<original prompt from the plan>
```

If previous batches produced results relevant to this deliverable, append:
```
[RESULTS FROM PREVIOUS BATCHES]
D1: status: success — <summary>
D2: status: success — <summary>
```

The subagent receives no session context. Everything it needs is in the prompt.

### Process results

When a subagent returns, parse its structured result:

```
task_id: D<N>
status: success | partial | failed
summary: <what was done>
errors: <list or empty>
validation_result: <output of validation command>
files_changed: <list of paths>
```

**If `status: success`** — mark as complete, proceed.

**If `status: partial`** — check if retry would help. If `retries < max_retries`,
retry with the error context appended. Otherwise, proceed with a warning.

**If `status: failed`** — retry up to `max_retries` with error context:
```
[PREVIOUS ATTEMPT FAILED]
Error: <error from previous attempt>
Validation output: <what failed>

Please fix the issue and try again. The original prompt follows.

[DELIVERABLE PROMPT]
<original prompt>
```

After `max_retries` exhausted: **stop and report** to the user with full diagnosis.
Do not attempt to fix it yourself. Do not continue to the next batch.

**If the subagent returns narrative instead of structured result:** extract what you
can (status, files changed) and proceed, but note the deviation.

### Human gates

At points marked as gates in the plan:

```
## Gate — Batch 1 complete

Progress:
- D1 — <title>: success — <one-line summary>
- D2 — <title>: success — <one-line summary>

Next batch: D3, D4 (parallel)

Confirm to proceed, or adjust the plan.
```

Wait for explicit approval before continuing. If the user requests changes, adapt
the remaining plan accordingly.

---

## Integration

### Build and test

After all deliverables complete:

```bash
<build command>
<test command>
<smoke test, if defined in project.md>
```

Report: X/Y tests passing, any remaining failures.

### Worktree merge (if applicable)

If deliverables ran in worktree isolation:

1. Check for merge conflicts with the base branch
2. If no conflicts: merge cleanly
3. If conflicts exist: report the conflicting files and the deliverables that touched
   them. Attempt resolution preserving each deliverable's intent. Run build + tests
   after resolution.
4. If resolution is ambiguous: ask the user before proceeding

### Manual test checklist

Generate a list of what needs human validation:
- What was tested automatically (with evidence)
- What requires human interaction (UI, end-to-end flows, edge cases not covered)

---

## Final report

```
## Delivery complete — <feature name>

Deliverables:
- D1 — <title>: success
- D2 — <title>: success
- D3 — <title>: success

Build: passed
Tests: X/Y passed

Manual tests needed:
- [ ] <action> → <expected result>

Next step: /launchpad:review <repo>/<feature>
```

If there are unresolved failures:
```
Deliverables with issues:
- D3 — <title>: failed after 2 attempts
  Root cause: <diagnosis>
  Suggested next step: <action>
```

---

## Rules

| Rule | Detail |
|---|---|
| Plan is the contract | Execute faithfully. Don't add deliverables not in the plan. |
| Parse the DAG | Read execution order from `## Execution DAG`, don't re-derive it. |
| Baseline must pass | Never start on a broken codebase. |
| Autonomous between gates | Don't pause between deliverables except at explicit gates. |
| 2 retries max per deliverable | After 2 failures: stop and report. Don't fix indefinitely. |
| Subagents don't spawn subagents | All orchestration from this thread. |
| Sonnet by default | Never use opus in a subagent without explicit justification in the plan. |
| Structured results | Expect and parse the result schema. Proceed on narrative but note it. |
| Worktree for parallel writes | If two deliverables run in the same batch and modify files, use worktree isolation. |

---

## Anti-patterns

| Anti-pattern | Fix |
|---|---|
| Re-deriving execution order from descriptions | Parse the Execution DAG section |
| Launching all sequentially when parallelism is possible | If no shared files: launch in parallel |
| Continuing after 2 failures | Stop and report with full diagnosis |
| Subagent spawning subagent | Not possible — all launches from this thread |
| Ignoring structured result format | Parse task_id, status, errors — don't read as narrative |
| Skipping baseline check | Always verify build + tests before starting |
| Enriching prompt with session context | Only use runtime context block — no session state |

---

## When NOT to use

- No plan.md exists → run `/launchpad:planning` first
- Plan not approved by human → get approval first
- Code already implemented and reviewed → run `/launchpad:ship`
- Quick fix that doesn't need orchestration → do it directly
