# Block Format Specification

## Rules

- One `.html` file per block.
- HTML + inline styles only. No external CSS, no class-based styling.
- Max 15 lines per block file.
- Use CSS custom properties mapped to token names (e.g. `style="color: var(--color-primary)"`).
  Tokens must be declared on `:root` or injected by the agent before rendering.
- Naming convention: `lowercase-kebab.html` (e.g. `feature-row.html`, `hero-banner.html`).
- Blocks are self-contained — no assumed wrapper, no external JS.

## Directory Structure

```
design-system/
  tokens.md         ← filled from tokens-template.md
  blocks/
    button.html
    card.html
    feature-row.html
    ...
```

## Example Block — button.html

```html
<button style="display: inline-flex; align-items: center; padding: var(--spacing-sm) var(--spacing-md); background: var(--color-primary); color: #fff; font-family: var(--font-family); font-size: var(--font-size-body); font-weight: var(--font-weight-medium); border: none; border-radius: var(--border-radius-md); cursor: pointer;">Label</button>
```

## Composing Screens

Combine blocks by nesting or stacking. Do not duplicate logic — if a button is needed, use `button.html`. If the existing block doesn't fit, create a new named block first (see agent rules in `~/.claude/rules/design-system.md`).
