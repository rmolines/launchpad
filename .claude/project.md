# Project Spec

## Identity
name: feature-lifecycle
alias: fl
description: Plugin de Claude Code para ciclo completo de desenvolvimento de features

## Commands
build: claude plugin validate .
test: claude plugin validate .

## Hot files
- commands/discovery.md
- commands/planning.md
- commands/delivery.md
- commands/review.md
- commands/ship.md
- references/prd-template.md
- references/plan-template.md
- .claude-plugin/plugin.json
- .claude-plugin/marketplace.json

## Paths
learnings: LEARNINGS.md
kickstart: /Users/rmolines/git/claude-kickstart

## Conventions
branch-prefix: feat/
main-branch: master
