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
  echo "  6. web-volume11 Vibogit download link update"
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
WEB_VOLUME11_ROOT="${VIBOGIT_WEB_VOLUME11_ROOT:-/Users/simonbloom/apps-vol11/web-volume11}"
WEB_VIBOGIT_PAGE="$WEB_VOLUME11_ROOT/src/components/webflow/vibogit/sections.tsx"
DMG_PATH="$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle/dmg/ViboGit_${VERSION}_aarch64.dmg"
GITHUB_REPO="simonbloom/vibogit"

# ── Stage 1: Preflight ──────────────────────────────────────────────────────
log "Stage 1: Preflight checks"

source "$SCRIPTS_DIR/preflight.sh"
run_preflight "$REPO_ROOT" "$VERSION" "$DRY_RUN" "$WEB_VIBOGIT_PAGE"
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

  sed -E -i '' "s/ViboGit_[0-9]+\\.[0-9]+\\.[0-9]+_(aarch64|x64)\\.dmg/ViboGit_${VERSION}_\\1.dmg/g" "$WEB_VIBOGIT_PAGE"
  echo "  Updated web-volume11 Vibogit download links"
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
validate_artifacts "$REPO_ROOT" "$VERSION" "$WEB_VIBOGIT_PAGE"
ok "All required artifacts present"

# ── Stage 4.5: Commit & push version bump ────────────────────────────────────
log "Stage 4.5: Commit and push version bump"

if dry "commit and push version bump"; then
  :
else
  cd "$REPO_ROOT"
  if [[ -n "$(git status --porcelain)" ]]; then
    git add -A
    git commit -m "chore: bump version to $VERSION and publish release"
    ok "Committed version bump"
    git push origin "$(git rev-parse --abbrev-ref HEAD)"
    ok "Pushed to remote"
  else
    ok "Working tree clean, nothing to commit"
  fi
fi

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

# ── Stage 6: web-volume11 Vibogit page link update ───────────────────────────
log "Stage 6: web-volume11 Vibogit download link update"

if dry "update web-volume11 Vibogit links to version $VERSION"; then
  :
else
  ok "web-volume11 Vibogit links already updated in Stage 2"
fi

# ── Stage 6.5: Wait for CI to upload latest.json ─────────────────────────────
log "Stage 6.5: Waiting for CI to upload latest.json and signed updater artifacts"

if dry "wait for CI workflow to complete"; then
  :
else
  LATEST_JSON_URL="https://github.com/$GITHUB_REPO/releases/download/$TAG/latest.json"
  MAX_WAIT=900  # 15 minutes
  POLL_INTERVAL=30
  ELAPSED=0
  RUN_ID=""

  # Wait for the CI workflow run triggered by the tag push
  log "Waiting for release-desktop.yml CI workflow to complete (up to ${MAX_WAIT}s)..."
  log "Polling every ${POLL_INTERVAL}s for latest.json on release $TAG..."

  while [[ $ELAPSED -lt $MAX_WAIT ]]; do
    if [[ -z "$RUN_ID" ]]; then
      RUN_ID=$(gh run list --repo "$GITHUB_REPO" --workflow=release-desktop.yml --branch "$TAG" --limit 1 --json databaseId -q '.[0].databaseId' 2>/dev/null || true)
      if [[ -n "$RUN_ID" ]]; then
        log "Tracking workflow run $RUN_ID for $TAG"
      fi
    fi

    HTTP_STATUS=$(curl -sL -o /dev/null -w "%{http_code}" "$LATEST_JSON_URL" 2>/dev/null || echo "000")
    if [[ "$HTTP_STATUS" == "200" ]]; then
      LIVE_VERSION=$(curl -sL "$LATEST_JSON_URL" 2>/dev/null | python3 -c "import sys, json; print(json.load(sys.stdin).get('version', 'UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
      if [[ "$LIVE_VERSION" == "$VERSION" ]]; then
        ok "latest.json is live for $TAG with version $LIVE_VERSION (waited ${ELAPSED}s)"
        break
      fi
      warn "latest.json reachable but serves version $LIVE_VERSION (expected $VERSION)"
    fi

    CI_STATUS="pending"
    CI_CONCLUSION=""
    if [[ -n "$RUN_ID" ]]; then
      CI_STATUS=$(gh run view "$RUN_ID" --repo "$GITHUB_REPO" --json status -q '.status' 2>/dev/null || echo "unknown")
      CI_CONCLUSION=$(gh run view "$RUN_ID" --repo "$GITHUB_REPO" --json conclusion -q '.conclusion' 2>/dev/null || echo "")
      if [[ "$CI_STATUS" == "completed" && "$CI_CONCLUSION" != "success" ]]; then
        fail "CI workflow run $RUN_ID finished with conclusion '$CI_CONCLUSION'. latest.json for $TAG was not published."
      fi
    fi

    echo "  ... waiting (${ELAPSED}s elapsed, run: ${RUN_ID:-pending}, status: $CI_STATUS, conclusion: ${CI_CONCLUSION:-pending}, latest.json: $HTTP_STATUS)"
    sleep "$POLL_INTERVAL"
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
  done

  if [[ $ELAPSED -ge $MAX_WAIT ]]; then
    fail "Timed out waiting for latest.json version $VERSION after ${MAX_WAIT}s. Check run state: gh run list --repo $GITHUB_REPO --workflow=release-desktop.yml --branch $TAG"
  fi
fi

# ── Stage 7: Post-release verification ───────────────────────────────────────
log "Stage 7: Post-release verification"

source "$SCRIPTS_DIR/verify-release.sh"
verify_release "$REPO_ROOT" "$VERSION" "$GITHUB_REPO" "$DRY_RUN" "$WEB_VIBOGIT_PAGE"

echo ""
echo "========================================"
echo "  Release v$VERSION complete!"
echo "========================================"
echo ""
echo "  DMG:     $DMG_PATH"
if ! $DRY_RUN; then
  echo "  Release: $RELEASE_URL"
fi
echo "  Vibogit page: $WEB_VIBOGIT_PAGE (updated)"
echo ""
echo "Next steps:"
echo "  1. Verify download links on https://www.volume11.ai/vibogit"
echo "  2. Commit and push web-volume11 changes in that repo"
echo ""
