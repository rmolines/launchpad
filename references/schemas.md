# Schemas

Three machine-readable formats used across the feature-lifecycle plugin skills.

---

## Schema 1: Structured Result (subagent → orchestrator)

Every subagent spawned by `/delivery` must return its result in this format. The orchestrator parses it to decide next steps: proceed to next batch, retry the task, or escalate to the human.

### Format

```
## Result

task_id: D1
status: success
summary: Implemented the JWT middleware and wired it into the Express router. All protected routes now reject unauthenticated requests.
errors:
validation_result: PASS — 42 tests passed, 0 failed (npm test)

files_changed:
- src/middleware/auth.ts
- src/routes/index.ts
- tests/middleware/auth.test.ts
```

### Field rules

| Field | Type | Rules |
|---|---|---|
| `task_id` | string | Must match a deliverable ID in plan.md (e.g. `D1`, `D2`, `M1`) |
| `status` | enum | `success` / `partial` / `failed` |
| `summary` | string | 1–2 sentences. What was done, not what was attempted. Past tense. |
| `errors` | list or empty | One error per line, prefixed with `- `. Empty if status is `success`. |
| `validation_result` | string | Verbatim output or summary of the validation command defined in the plan. Include pass/fail verdict. |
| `files_changed` | list | One path per line, prefixed with `- `. Paths relative to repo root. |

### Status semantics

- **success** — validation passed, task is complete. Orchestrator proceeds.
- **partial** — core logic done but validation did not fully pass (e.g. 1 flaky test). Orchestrator may retry or escalate.
- **failed** — task could not be completed or validation failed. Orchestrator retries up to `max_retries`, then escalates to human.

### Parsing (grep/awk)

```bash
STATUS=$(grep "^status:" result.md | awk '{print $2}')
TASK_ID=$(grep "^task_id:" result.md | awk '{print $2}')
FILES=$(awk '/^files_changed:/{found=1; next} found && /^- /{print substr($0,3)} found && /^$/{exit}' result.md)
```

---

## Schema 2: Execution DAG in plan.md

The `## Execution DAG` section is a machine-readable declaration of all deliverables, their dependencies, and execution parameters. It coexists with the human-readable `## Batches` and ASCII graph sections — it does not replace them.

`/delivery` reads this section to build the execution graph, determine batch order, and configure each subagent.

### Format

Add this section to `plan.md` after `## Batches`:

```markdown
## Execution DAG

<!-- DAG format: one task per block, fields are key: value -->

task: D1
depends_on:
executor: haiku
isolation: none
max_retries: 2
acceptance: npm test -- --testPathPattern=auth passes with 0 failures

task: D2
depends_on: D1
executor: sonnet
isolation: worktree
max_retries: 1
acceptance: npm run build exits 0 and bundle size < 500kB

task: M1
depends_on: D1, D2
executor: sonnet
isolation: worktree
max_retries: 2
acceptance: npm test exits 0, no regressions vs baseline

task: D3
depends_on:
executor: haiku
isolation: none
max_retries: 3
acceptance: migration runs without error on empty DB and on seed DB
```

### Field rules

| Field | Type | Rules |
|---|---|---|
| `task` | string | Unique deliverable ID. Must match IDs used in the Batches section. |
| `depends_on` | string or empty | Comma-separated list of task IDs that must have `status: success` before this task runs. Leave empty for no dependencies (first batch). |
| `executor` | enum | `haiku` (mechanical, well-scoped) / `sonnet` (reasoning required, integrations) |
| `isolation` | enum | `worktree` (changes need isolation from main branch) / `none` (safe to work in current branch) |
| `max_retries` | int | How many times orchestrator retries on `failed` before escalating. Typical range: 1–3. |
| `acceptance` | string | The exact command or assertion used to validate completion. Must be runnable. |

### Isolation guidance

Use `worktree` when:
- The task touches shared infrastructure (router, DB schema, auth layer)
- Parallel tasks in the same batch could conflict on the same files
- You want a clean rollback if the task fails

Use `none` when:
- Task is additive only (new file, new test, new migration)
- Task is sequential and no parallel task touches overlapping files

### Parsing (grep/awk)

```bash
# Extract all task IDs
TASKS=$(awk '/^## Execution DAG/{found=1} found && /^task:/{print $2}' plan.md)

# Extract fields for a specific task (e.g. D1)
get_field() {
  local task_id=$1 field=$2
  awk -v tid="$task_id" -v f="$field" '
    /^task:/ { current = $2 }
    current == tid && $0 ~ "^" f ":" { sub(/^[^:]+: ?/, ""); print; exit }
  ' plan.md
}

EXECUTOR=$(get_field D1 executor)
DEPENDS=$(get_field D1 depends_on)
ACCEPTANCE=$(get_field D1 acceptance)
```

---

## Schema 3: PRD Quality Checklist

`/discovery --finalize` runs this checklist before writing `prd.md`. Each item has a binary pass/fail. If any item fails, the skill reports it to the human and does not generate the PRD until resolved.

The goal is to produce PRDs that an agent can execute without making product decisions.

---

### Item 1: Problem is falsifiable

**Check:** Can you state a concrete condition that proves the problem is solved?

| | Example |
|---|---|
| **Fail** | "Users are frustrated with onboarding" |
| **Pass** | "35% of signups abandon before completing profile setup (step 3 of 4)" |

**Validation prompt for `/discovery`:** Does the problem statement include a measurable current state (metric, user action, error rate, frequency) that the solution will change?

---

### Item 2: Success criteria are concrete

**Check:** Each criterion must reference a specific user action, system output, or measurable threshold — not a quality adjective.

| | Example |
|---|---|
| **Fail** | "Onboarding should feel fast and intuitive" |
| **Pass** | "User completes profile setup in ≤ 3 steps without leaving the page" |
| **Fail** | "The API should be reliable" |
| **Pass** | "Endpoint returns 200 in < 300ms at p95 under 100 concurrent requests" |

**Validation prompt for `/discovery`:** Read each success criterion. Does it contain a verb + object + threshold? Remove all adjectives — does the sentence still have meaning?

---

### Item 3: Out-of-scope is specific enough

**Check:** Out-of-scope items must name the thing being excluded, not just the category.

| | Example |
|---|---|
| **Fail** | "Mobile is out of scope" |
| **Pass** | "iOS and Android native apps are out of scope. The web app must be responsive down to 375px but native builds are not part of this feature." |
| **Fail** | "Performance optimization is out of scope" |
| **Pass** | "DB query optimization and caching layer are out of scope. The feature must not regress existing p95 latency by more than 10%." |

**Validation prompt for `/discovery`:** For each out-of-scope item, would an agent working on adjacent code know to stop when it encounters it? Or could the agent reasonably argue it's in scope?

---

### Item 4: Design decisions are already made

**Check:** The PRD must not leave open questions that require product or UX judgment. Every fork must be resolved.

| | Example |
|---|---|
| **Fail** | "We could use OAuth or magic links — TBD" |
| **Pass** | "Authentication uses magic links only. OAuth is explicitly out of scope (see §3)." |
| **Fail** | "Error messages should be user-friendly (exact copy TBD)" |
| **Pass** | "Error messages use the copy defined in `docs/error-copy.md`. If a case is not covered, use: 'Something went wrong. Try again or contact support.'" |

**Validation prompt for `/discovery`:** Search the PRD for: "TBD", "to be decided", "could", "might", "or", "option". Each occurrence must be resolved before proceeding.

---

### Item 5: Technical context is included

**Check:** The PRD must include enough context for the agent to make implementation decisions without researching the codebase from scratch.

Required context:

- **Stack** — languages, frameworks, runtime versions relevant to this feature
- **Patterns** — existing patterns the feature must follow (e.g. "all DB access goes through the repository layer in `src/db/`")
- **Constraints** — anything the agent must not violate (e.g. "no new dependencies without approval", "must work without migrations in prod")
- **Entry points** — where in the codebase the feature connects (files, modules, API routes)

| | Example |
|---|---|
| **Fail** | "Use the existing auth system" |
| **Pass** | "Auth is handled by `src/middleware/auth.ts` (JWT, RS256). All protected routes pass through this middleware. The user object is available at `req.user` with shape defined in `src/types/user.ts`." |

**Validation prompt for `/discovery`:** If you gave this PRD to an agent with no other context, could it identify (a) which files to edit, (b) which patterns to replicate, and (c) which constraints to respect?

---

### Checklist summary

```
PRD Quality Gate
----------------
[ ] 1. Problem is falsifiable (measurable current state)
[ ] 2. Success criteria are concrete (user action + threshold, no adjectives)
[ ] 3. Out-of-scope is specific (named things, not categories)
[ ] 4. Design decisions are resolved (no TBDs, no open forks)
[ ] 5. Technical context is included (stack, patterns, constraints, entry points)

Result: PASS (all 5) | FAIL (list failing items)
```

If result is FAIL, `/discovery --finalize` outputs which items failed with the specific gaps found, and prompts the human to resolve them before retrying.
