#!/usr/bin/env bash
# migrate-to-missions.sh — One-shot migration from initiatives/ to missions/
# Usage: bash scripts/migrate-to-missions.sh [--dry-run]
#
# For each mission in ~/.claude/initiatives/:
#   - Creates ~/.claude/missions/<mission>/
#   - Copies mission.md to mission level
#   - Moves modules to ~/.claude/missions/<mission>/_backlog/<module>/
#   - Moves archived/ contents to ~/.claude/missions/<mission>/_backlog/archived/
#
# Does NOT delete initiatives/ — kept as backup.

set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
  echo "[dry-run] No changes will be made."
fi

INITIATIVES_DIR="$HOME/.claude/initiatives"
MISSIONS_DIR="$HOME/.claude/missions"

if [[ ! -d "$INITIATIVES_DIR" ]]; then
  echo "Error: $INITIATIVES_DIR does not exist. Nothing to migrate."
  exit 1
fi

run() {
  if $DRY_RUN; then
    echo "[dry-run] $*"
  else
    "$@"
  fi
}

echo "=== Migration: initiatives/ → missions/ ==="
echo "Source: $INITIATIVES_DIR"
echo "Target: $MISSIONS_DIR"
echo ""

run mkdir -p "$MISSIONS_DIR"

shopt -s nullglob

for mission_dir in "$INITIATIVES_DIR"/*/; do
  [[ -d "$mission_dir" ]] || continue
  mission=$(basename "$mission_dir")

  # Skip special directories
  [[ "$mission" == "_reviews" ]] && continue
  [[ "$mission" == "_backlog" ]] && continue

  echo "--- Mission: $mission ---"

  MISSION_TARGET="$MISSIONS_DIR/$mission"
  BACKLOG_TARGET="$MISSION_TARGET/_backlog"

  run mkdir -p "$BACKLOG_TARGET"

  # Copy mission.md if it exists
  if [[ -f "$mission_dir/mission.md" ]]; then
    echo "  copy mission.md → $MISSION_TARGET/mission.md"
    run cp "$mission_dir/mission.md" "$MISSION_TARGET/mission.md"
  fi

  # Handle archived/ directory: move contents to _backlog/archived/
  if [[ -d "$mission_dir/archived" ]]; then
    ARCHIVED_BACKLOG="$BACKLOG_TARGET/archived"
    run mkdir -p "$ARCHIVED_BACKLOG"
    for archived_module in "$mission_dir/archived"/*/; do
      [[ -d "$archived_module" ]] || continue
      mod_name=$(basename "$archived_module")
      echo "  move archived/$mod_name → _backlog/archived/$mod_name"
      run cp -r "$archived_module" "$ARCHIVED_BACKLOG/$mod_name"
    done
  fi

  # Move each module (non-special subdirs) to _backlog/
  for module_dir in "$mission_dir"*/; do
    [[ -d "$module_dir" ]] || continue
    module=$(basename "$module_dir")

    # Skip special directories
    [[ "$module" == "archived" ]] && continue
    [[ "$module" == "_backlog" ]] && continue

    # Skip mission.md at directory level (not a dir, but just in case)
    [[ "$module" == "mission.md" ]] && continue

    echo "  move $module → _backlog/$module"
    run cp -r "$module_dir" "$BACKLOG_TARGET/$module"
  done

  echo "  done: $MISSION_TARGET"
  echo ""
done

# Also migrate _reviews if present (to missions/_reviews)
if [[ -d "$INITIATIVES_DIR/_reviews" ]]; then
  echo "--- Migrating _reviews ---"
  run cp -r "$INITIATIVES_DIR/_reviews" "$MISSIONS_DIR/_reviews"
  echo "  done: $MISSIONS_DIR/_reviews"
  echo ""
fi

echo "=== Migration complete ==="
echo ""
echo "Source (backup kept): $INITIATIVES_DIR"
echo "Target: $MISSIONS_DIR"
echo ""
echo "Next steps:"
echo "  1. Verify: ls ~/.claude/missions/"
echo "  2. Update guard hook to block ~/.claude/missions/ (already done in scripts/guard-initiatives.sh)"
echo "  3. Run workspace reindex: bash ~/.claude/scripts/workspace-reindex.sh"
echo "  4. Do NOT delete initiatives/ until you've verified all missions migrated correctly."
