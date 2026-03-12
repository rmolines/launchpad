# Launchpad — Agent Notes

## Pitfalls

### Template placeholder strings must not appear in content
Scripts that inject JSON into HTML templates via Python `str.replace()` will break
silently if the placeholder string appears inside the JSON content itself. The result
is malformed JSON, a blank browser page, and exit 0 with no error.

| Script | Placeholder | Content surface |
|---|---|---|
| `scripts/plan-view.sh` | `__PLAN_DATA__` | Plan task fields (title, acceptance criteria, files) |
| `scripts/cockpit.sh` | `__COCKPIT_DATA__` | Discovery artifact fields (frontmatter, problem text, plan names, results, review decisions) |

Never use these literal strings in any artifact content, test fixtures, or generated values.
