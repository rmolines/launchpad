# Feature Lifecycle Plugin

Complete feature lifecycle for AI-native development: from idea to production.

## Overview

Five commands, five transitions. Each command does exactly one thing:

```
/discovery → /planning → /delivery → /review → /ship
```

| Command | What it does | Input | Output |
|---|---|---|---|
| `/discovery` | Idea → Decision | idea, data, hypothesis | `prd.md` |
| `/planning` | Decision → Program | `prd.md` | `plan.md` |
| `/delivery` | Program → Code | `plan.md` | implemented code |
| `/review` | Code → Verified | code + PRD | validation report |
| `/ship` | Verified → Production | reviewed code | PR merged, docs, cleanup |

## Commands

### `/discovery [slug or idea]`

Iterative risk elimination process. Transforms a vague idea into a validated PRD through investigation cycles.

**Signal triage:** Automatically picks the right conversation mode:
- **Extraction** — vague input, no data → Socratic questioning
- **Validation** — formed hypothesis → propose and confirm
- **Synthesis** — concrete data → analyze and ask what's missing

**Cycle types:** framing, research, mockup (HTML+Tailwind), spike, interview, analysis.

**Persistence:** `draft.md` preserves state between sessions. Resume with `/discovery <slug>`.

**Finalize:** `/discovery <slug> --finalize` generates the final `prd.md`.

### `/planning [repo/feature]`

Transforms a finalized PRD into an executable plan — not documentation, a program.

Each deliverable contains a **fully self-contained prompt** that a Sonnet subagent can execute without questions, without session context, without extra files.

- 3-8 deliverables, ~5-30 min each
- Dependency graph + parallel batches + gates
- Walking skeleton as E1 (existing projects) or setup as E1 (new projects)

### `/delivery [repo/feature]`

Orchestrates plan execution with subagents.

- Validates baseline (build + tests pass) before starting
- Launches batch-parallel Agent calls
- Enriches prompts with runtime context
- Max 2 retries per deliverable
- Human gates at plan-defined checkpoints

### `/review [repo/feature]`

Validates that code solves the PRD's problem. Read-only (except simplify).

1. Classifies every change against PRD (aligned / drift / extra-scope / pending / out-of-scope)
2. Checks success criteria
3. Maps plan deliverable coverage
4. Runs code simplifier on modified files
5. Verdict: Approved / Adjustments needed / Blocked

`## Non-scope` violations = automatic Blocked verdict.

### `/ship [repo/feature]`

Puts code in production and closes the development cycle.

1. Build + test (hard gate — never ships broken code)
2. Smart path detection:
   - **Fast** (< 150 lines, no hot files): merge directly
   - **Standard**: wait for CI, then merge
3. Deploy verification + smoke test
4. Documentation: 4 parallel subagents write HANDOVER, CHANGELOG, LEARNINGS, CLAUDE.md pitfalls
5. Cleanup: archive discovery, remove worktree

## Artifacts

All artifacts live in `~/.claude/discoveries/<repo>/<feature>/`:

```
draft.md              # evolving PRD (discovery)
prd.md                # final PRD (discovery --finalize)
plan.md               # executable plan (planning)
cycles/
  01-framing-*.md     # investigation cycles
  02-research-*.md
  03-mockup-*/        # HTML prototypes
  04-spike-*/         # technical proofs
```

Post-ship outputs go to the repo:
- `HANDOVER.md` — context for next developer
- `CHANGELOG.md` — pointer to git history
- `LEARNINGS.md` — cycle learnings
- `CLAUDE.md` — pitfalls for future agents

Completed features are archived to `~/.claude/discoveries/<repo>/archived/`.

## Model conventions

| Role | Model |
|---|---|
| Main thread (skill execution) | opus |
| Subagents (implementation, docs) | sonnet |
| Trivial tasks (grep, listing) | haiku |

Subagents never use opus unless the plan explicitly justifies it.

## References

- `references/prd-template.md` — PRD template used by /discovery
- `references/plan-template.md` — Plan template used by /planning

## Dependencies

- `.claude/project.md` or `CLAUDE.md` in the target repo for project configuration
- `~/.claude/guides/project-setup.md` for new project setup (optional)
- `code-simplifier` plugin for /review's simplify step (optional)

## Design principles

1. **One command, one transition.** No command does two things.
2. **State = file presence.** `draft.md` = in progress, `prd.md` = ready for planning, `plan.md` = ready for delivery, `archived/` = done.
3. **`/clear` between commands.** Long sessions degrade quality. Each command writes to disk; the next reads from disk.
4. **PRD is the contract.** Not the plan, not the code — the PRD defines what success looks like.
5. **`## Non-scope` is sacred.** Any implementation of something explicitly excluded = blocked.
