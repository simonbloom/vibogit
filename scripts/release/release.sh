#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SCRIPTS_DIR="$REPO_ROOT/scripts/release"

VERSION=""
DRY_RUN=false
SKIP_BUILD=false

usage() {
  echo "Usage: $0 <version> [--dry-run] [--skip-build]"
  echo ""
  echo "  <version>      Semver version to release (e.g. 3.5.0)"
  echo "  --dry-run      Validate and simulate without side effects"
  echo "  --skip-build   Skip clean build (use existing artifacts)"
  echo ""
  echo "Stages:"
  echo "  1. Preflight checks"
  echo "  2. Version bump (all files)"
  echo "  3. Clean build (frontend + Rust + DMG)"
  echo "  4. Artifact contract validation"
  echo "  5. GitHub release create + upload"
  echo "  6. Landing page download link update"
  echo "  7. Post-release verification report"
  exit 1
}

log()  { echo "==> $*"; }
ok()   { echo "  [OK] $*"; }
fail() { echo "  [FAIL] $*" >&2; exit 1; }
warn() { echo "  [WARN] $*"; }
dry()  { if $DRY_RUN; then echo "  [DRY-RUN] Would: $*"; return 0; else return 1; fi; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)   DRY_RUN=true; shift ;;
    --skip-build) SKIP_BUILD=true; shift ;;
    --help|-h)   usage ;;
    *)
      if [[ -z "$VERSION" ]]; then
        VERSION="$1"; shift
      else
        echo "Unknown argument: $1"; usage
      fi
      ;;
  esac
done

[[ -z "$VERSION" ]] && usage

if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  fail "Version must be semver (X.Y.Z), got: $VERSION"
fi

TAURI_CONF="$REPO_ROOT/apps/desktop/src-tauri/tauri.conf.json"
CARGO_TOML="$REPO_ROOT/apps/desktop/src-tauri/Cargo.toml"
SIDEBAR_TSX="$REPO_ROOT/packages/ui/src/components/sidebar/sidebar.tsx"
LANDING_PAGE="$REPO_ROOT/apps/desktop/frontend/src/app/page.tsx"
DMG_PATH="$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle/dmg/ViboGit_${VERSION}_aarch64.dmg"
GITHUB_REPO="simonbloom/vibogit"

# ── Stage 1: Preflight ──────────────────────────────────────────────────────
log "Stage 1: Preflight checks"

source "$SCRIPTS_DIR/preflight.sh"
run_preflight "$REPO_ROOT" "$VERSION" "$DRY_RUN"
ok "Preflight passed"

# ── Stage 2: Version bump ───────────────────────────────────────────────────
log "Stage 2: Version bump to $VERSION"

if dry "update version files to $VERSION"; then
  :
else
  OLD_VERSION=$(python3 -c "import json; print(json.load(open('$TAURI_CONF'))['version'])")

  python3 -c "
import json, sys
with open('$TAURI_CONF', 'r') as f: data = json.load(f)
data['version'] = '$VERSION'
with open('$TAURI_CONF', 'w') as f: json.dump(data, f, indent=2)
print('  Updated tauri.conf.json')
"

  sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" "$CARGO_TOML"
  echo "  Updated Cargo.toml"

  sed -i '' "s/v${OLD_VERSION}/v${VERSION}/g" "$SIDEBAR_TSX"
  echo "  Updated sidebar.tsx"

  sed -i '' "s/ViboGit_${OLD_VERSION}/ViboGit_${VERSION}/g" "$LANDING_PAGE"
  echo "  Updated landing page download links"
fi
ok "Version files updated"

# ── Stage 3: Clean build ────────────────────────────────────────────────────
log "Stage 3: Clean build"

if $SKIP_BUILD; then
  warn "Skipping build (--skip-build)"
elif dry "clean and rebuild frontend + Rust + DMG"; then
  :
else
  log "Cleaning build artifacts..."
  rm -rf "$REPO_ROOT/apps/desktop/frontend/.next"
  rm -rf "$REPO_ROOT/apps/desktop/frontend/out"
  rm -f  "$REPO_ROOT/apps/desktop/src-tauri/target/release/vibogit"
  rm -f  "$REPO_ROOT/apps/desktop/src-tauri/target/release/vibogit.d"
  rm -rf "$REPO_ROOT/apps/desktop/src-tauri/target/release/.fingerprint/vibogit-*"
  rm -rf "$REPO_ROOT/apps/desktop/src-tauri/target/release/incremental/vibogit-*"
  rm -rf "$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle"

  log "Installing dependencies..."
  cd "$REPO_ROOT" && bun install

  log "Building frontend..."
  cd "$REPO_ROOT/apps/desktop/frontend" && bun run build

  log "Building Rust + DMG..."
  cd "$REPO_ROOT/apps/desktop" && node_modules/.bin/tauri build --bundles dmg
fi
ok "Build complete"

# ── Stage 4: Artifact contract validation ────────────────────────────────────
log "Stage 4: Artifact contract validation"

source "$SCRIPTS_DIR/validate-artifacts.sh"
validate_artifacts "$REPO_ROOT" "$VERSION"
ok "All required artifacts present"

# ── Stage 5: GitHub release ──────────────────────────────────────────────────
log "Stage 5: GitHub release v$VERSION"

TAG="v$VERSION"
RELEASE_TITLE="ViboGit $TAG"
RELEASE_BODY="See the assets to download and install this version."

if dry "create GitHub release $TAG and upload assets"; then
  :
else
  if gh release view "$TAG" --repo "$GITHUB_REPO" &>/dev/null; then
    log "Release $TAG exists, uploading assets..."
    gh release upload "$TAG" "$DMG_PATH" --repo "$GITHUB_REPO" --clobber
  else
    log "Creating release $TAG..."
    gh release create "$TAG" \
      --repo "$GITHUB_REPO" \
      --title "$RELEASE_TITLE" \
      --notes "$RELEASE_BODY" \
      "$DMG_PATH"
  fi

  RELEASE_URL=$(gh release view "$TAG" --repo "$GITHUB_REPO" --json url -q '.url')
  ok "Release published: $RELEASE_URL"
fi

# ── Stage 6: Landing page link update ────────────────────────────────────────
log "Stage 6: Landing page download link update"

if dry "update landing page links to version $VERSION"; then
  :
else
  ok "Landing page links already updated in Stage 2"
fi

# ── Stage 7: Post-release verification ───────────────────────────────────────
log "Stage 7: Post-release verification"

source "$SCRIPTS_DIR/verify-release.sh"
verify_release "$REPO_ROOT" "$VERSION" "$GITHUB_REPO" "$DRY_RUN"

echo ""
echo "========================================"
echo "  Release v$VERSION complete!"
echo "========================================"
echo ""
echo "  DMG:     $DMG_PATH"
if ! $DRY_RUN; then
  echo "  Release: $RELEASE_URL"
fi
echo "  Landing: $LANDING_PAGE (updated)"
echo ""
echo "Next steps:"
echo "  1. git add -A && git commit -m 'chore: bump version to $VERSION and publish release'"
echo "  2. git push origin main"
echo "  3. Verify download from landing page"
echo ""
