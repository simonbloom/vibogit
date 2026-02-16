#!/usr/bin/env bash
# Artifact contract validation for release automation.
# Sourced by release.sh — do not run directly.

validate_artifacts() {
  local REPO_ROOT="$1"
  local VERSION="$2"
  local errors=0
  local BUNDLE_DIR="$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle"

  # Check DMG exists
  local DMG="$BUNDLE_DIR/dmg/ViboGit_${VERSION}_aarch64.dmg"
  if [[ -f "$DMG" ]]; then
    local size
    size=$(du -h "$DMG" | cut -f1)
    echo "  [OK] DMG found: ViboGit_${VERSION}_aarch64.dmg ($size)"
  else
    echo "  [FAIL] DMG missing: $DMG"
    errors=$((errors + 1))
  fi

  # Check version in tauri.conf.json matches
  local conf_version
  conf_version=$(python3 -c "import json; print(json.load(open('$REPO_ROOT/apps/desktop/src-tauri/tauri.conf.json'))['version'])")
  if [[ "$conf_version" == "$VERSION" ]]; then
    echo "  [OK] tauri.conf.json version: $conf_version"
  else
    echo "  [FAIL] tauri.conf.json version mismatch: expected $VERSION, got $conf_version"
    errors=$((errors + 1))
  fi

  # Check version in Cargo.toml matches
  local cargo_version
  cargo_version=$(grep '^version' "$REPO_ROOT/apps/desktop/src-tauri/Cargo.toml" | head -1 | sed 's/.*"\(.*\)".*/\1/')
  if [[ "$cargo_version" == "$VERSION" ]]; then
    echo "  [OK] Cargo.toml version: $cargo_version"
  else
    echo "  [FAIL] Cargo.toml version mismatch: expected $VERSION, got $cargo_version"
    errors=$((errors + 1))
  fi

  # Check sidebar version
  if grep -q "v${VERSION}" "$REPO_ROOT/packages/ui/src/components/sidebar/sidebar.tsx"; then
    echo "  [OK] sidebar.tsx displays v${VERSION}"
  else
    echo "  [FAIL] sidebar.tsx does not display v${VERSION}"
    errors=$((errors + 1))
  fi

  # Check landing page links
  if grep -q "ViboGit_${VERSION}" "$REPO_ROOT/apps/desktop/frontend/src/app/page.tsx"; then
    echo "  [OK] Landing page links reference version $VERSION"
  else
    echo "  [FAIL] Landing page links do not reference version $VERSION"
    errors=$((errors + 1))
  fi

  if [[ $errors -gt 0 ]]; then
    echo ""
    echo "  Artifact validation failed with $errors error(s)."
    exit 1
  fi
}
