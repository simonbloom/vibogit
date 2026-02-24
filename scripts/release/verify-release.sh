#!/usr/bin/env bash
# Post-release verification for release automation.
# Sourced by release.sh — do not run directly.

verify_release() {
  local REPO_ROOT="$1"
  local VERSION="$2"
  local GITHUB_REPO="$3"
  local DRY_RUN="$4"
  local WEB_VIBOGIT_PAGE="$5"
  local errors=0

  # Verify updater endpoint config
  local updater_endpoint
  updater_endpoint=$(python3 -c "
import json
conf = json.load(open('$REPO_ROOT/apps/desktop/src-tauri/tauri.conf.json'))
endpoints = conf.get('plugins', {}).get('updater', {}).get('endpoints', [])
print(endpoints[0] if endpoints else 'NONE')
")

  if [[ "$updater_endpoint" == *"releases/latest/download/latest.json"* ]]; then
    echo "  [OK] Updater endpoint: $updater_endpoint"
  else
    echo "  [FAIL] Updater endpoint unexpected: $updater_endpoint"
    errors=$((errors + 1))
  fi

  # Verify updater pubkey is set
  local pubkey
  pubkey=$(python3 -c "
import json
conf = json.load(open('$REPO_ROOT/apps/desktop/src-tauri/tauri.conf.json'))
pk = conf.get('plugins', {}).get('updater', {}).get('pubkey', '')
print('SET' if pk else 'EMPTY')
")

  if [[ "$pubkey" == "SET" ]]; then
    echo "  [OK] Updater public key configured"
  else
    echo "  [WARN] Updater public key not set (updates require signing)"
  fi

  # Verify use-auto-update.ts imports from updater plugin
  if grep -q "@tauri-apps/plugin-updater" "$REPO_ROOT/packages/ui/src/lib/use-auto-update.ts"; then
    echo "  [OK] Auto-update hook uses @tauri-apps/plugin-updater"
  else
    echo "  [FAIL] Auto-update hook missing updater plugin import"
    errors=$((errors + 1))
  fi

  if ! $DRY_RUN; then
    # Verify GitHub release exists and has assets
    if command -v gh &>/dev/null; then
      local asset_count
      asset_count=$(gh release view "v$VERSION" --repo "$GITHUB_REPO" --json assets -q '.assets | length' 2>/dev/null || echo "0")
      if [[ "$asset_count" -gt 0 ]]; then
        echo "  [OK] GitHub release v$VERSION has $asset_count asset(s)"
      else
        echo "  [WARN] GitHub release v$VERSION has no assets (may still be uploading)"
      fi

      # Verify latest.json is downloadable
      local latest_json_url="https://github.com/$GITHUB_REPO/releases/download/v$VERSION/latest.json"
      local http_status
      http_status=$(curl -sL -o /dev/null -w "%{http_code}" "$latest_json_url" 2>/dev/null || echo "000")
      if [[ "$http_status" == "200" ]]; then
        local latest_ver
        latest_ver=$(curl -sL "$latest_json_url" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('version','UNKNOWN'))" 2>/dev/null || echo "UNKNOWN")
        echo "  [OK] latest.json downloadable (version: $latest_ver)"
      else
        echo "  [WARN] latest.json not yet available at $latest_json_url (HTTP $http_status)"
      fi
    fi
  else
    echo "  [DRY-RUN] Skipping remote release verification"
  fi

  # Generate JSON report
  local REPORT_DIR="$REPO_ROOT/output"
  mkdir -p "$REPORT_DIR"
  local REPORT_FILE="$REPORT_DIR/release-report-${VERSION}.json"

  python3 -c "
import json, datetime
report = {
    'version': '$VERSION',
    'timestamp': datetime.datetime.now(datetime.UTC).isoformat(),
    'dry_run': $( $DRY_RUN && echo 'True' || echo 'False' ),
    'updater_endpoint': '$updater_endpoint',
    'updater_pubkey': '$pubkey' == 'SET',
    'dmg_path': '$REPO_ROOT/apps/desktop/src-tauri/target/release/bundle/dmg/ViboGit_${VERSION}_aarch64.dmg',
    'web_vibogit_page': '$WEB_VIBOGIT_PAGE',
    'github_repo': '$GITHUB_REPO',
    'errors': $errors
}
with open('$REPORT_FILE', 'w') as f:
    json.dump(report, f, indent=2)
print(f'  [OK] Report saved: $REPORT_FILE')
"

  if [[ $errors -gt 0 ]]; then
    echo ""
    echo "  Verification completed with $errors error(s)."
    exit 1
  fi

  ok "All verification checks passed"
}
