#!/usr/bin/env bash
# Preflight checks for release automation.
# Sourced by release.sh — do not run directly.

run_preflight() {
  local REPO_ROOT="$1"
  local VERSION="$2"
  local DRY_RUN="$3"
  local errors=0

  # Check gh CLI installed
  if ! command -v gh &>/dev/null; then
    echo "  [FAIL] gh CLI not found. Install: https://cli.github.com/"
    errors=$((errors + 1))
  else
    echo "  [OK] gh CLI found: $(gh --version | head -1)"
  fi

  # Check gh auth
  if command -v gh &>/dev/null && ! gh auth status &>/dev/null; then
    echo "  [FAIL] gh not authenticated. Run: gh auth login"
    errors=$((errors + 1))
  else
    echo "  [OK] gh authenticated"
  fi

  # Check bun
  if ! command -v bun &>/dev/null; then
    echo "  [FAIL] bun not found. Install: https://bun.sh/"
    errors=$((errors + 1))
  else
    echo "  [OK] bun found: $(bun --version)"
  fi

  # Check required version files exist
  local files=(
    "$REPO_ROOT/apps/desktop/src-tauri/tauri.conf.json"
    "$REPO_ROOT/apps/desktop/src-tauri/Cargo.toml"
    "$REPO_ROOT/packages/ui/src/components/sidebar/sidebar.tsx"
    "$REPO_ROOT/apps/desktop/frontend/src/app/page.tsx"
  )

  for f in "${files[@]}"; do
    if [[ ! -f "$f" ]]; then
      echo "  [FAIL] Required file missing: $f"
      errors=$((errors + 1))
    fi
  done
  echo "  [OK] All version files exist"

  # Check landing page has replaceable download link pattern
  if ! grep -q "ViboGit_.*_aarch64.dmg" "$REPO_ROOT/apps/desktop/frontend/src/app/page.tsx"; then
    echo "  [FAIL] Landing page does not contain expected DMG link pattern"
    errors=$((errors + 1))
  else
    echo "  [OK] Landing page download link pattern found"
  fi

  # Check Rust toolchain
  if ! command -v rustc &>/dev/null; then
    echo "  [FAIL] Rust toolchain not found. Install: https://rustup.rs/"
    errors=$((errors + 1))
  else
    echo "  [OK] Rust toolchain: $(rustc --version)"
  fi

  # Check version is not already tagged
  if ! $DRY_RUN && command -v gh &>/dev/null; then
    if gh release view "v$VERSION" --repo simonbloom/vibogit &>/dev/null 2>&1; then
      echo "  [WARN] Release v$VERSION already exists on GitHub (will update assets)"
    fi
  fi

  # Check clean working tree (warn only)
  if [[ -n "$(cd "$REPO_ROOT" && git status --porcelain)" ]]; then
    echo "  [WARN] Working tree has uncommitted changes"
  else
    echo "  [OK] Working tree clean"
  fi

  if [[ $errors -gt 0 ]]; then
    echo ""
    echo "  Preflight failed with $errors error(s). Fix above issues and retry."
    exit 1
  fi
}
