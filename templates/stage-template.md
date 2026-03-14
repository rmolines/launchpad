---
id: <stage-slug>
mission: <mission-slug>
created: <YYYY-MM-DD>
updated: <YYYY-MM-DD>
tags: []
---
# Stage: <name>

<!-- Stage names must be functional — describe a user capability, not technology.
     Test: "if you swap the entire stack, does this name still make sense?"
     Wrong: "React dashboard with WebSocket"
     Right: "Live operational visibility" -->

## Hypothesis
What this stage validates. One falsifiable sentence.
If this hypothesis is wrong, the stage should be killed or redesigned.

## Scope
What capabilities this stage delivers to the user.
Written in terms of user outcomes, not technical deliverables.

## Modules

| Slug | Description | Depends on |
|------|-------------|------------|
| <module-slug> | <one-liner: what this module delivers> | — |
| <module-slug> | <one-liner> | <other-module-slug> |

Each row corresponds to a subdirectory: `~/.claude/missions/<mission>/<stage>/<module-slug>/`

## Inherited context
What flows down from `mission.md`:
- **Thesis:** <mission thesis — copy or reference>
- **Kill condition:** <mission kill condition that applies to this stage>
- **Audience:** <primary audience>

## Constraints
Boundaries that apply to all modules in this stage.
- <constraint 1 — e.g. "no new external dependencies without approval">
- <constraint 2 — e.g. "must work offline-first">
