# Launchpad — Agent Notes

## Pitfalls

### plan-view.sh — `__PLAN_DATA__` must not appear in plan content
`scripts/plan-view.sh` injects JSON into the HTML template via Python
`str.replace('__PLAN_DATA__', json_data)`. If any task field (title, acceptance
criteria, files, etc.) contains the literal string `__PLAN_DATA__`, that occurrence
inside the JSON will also be substituted, producing malformed JSON and a blank
browser page. The script exits 0 with no error. Avoid this string in plan content;
never use it in test fixtures or generated acceptance criteria.
