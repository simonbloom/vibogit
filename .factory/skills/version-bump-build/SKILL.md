---
name: version-bump-build
version: 2.0.0
description: |
  Bump the ViboGit version number across all required files, rebuild the desktop DMG,
  publish a GitHub release, and update landing page download links.
  Use when the user asks to change the version, bump the version, release a new version,
  or rebuild the desktop app DMG. Handles the full clean build and release process.
---

# Version Bump, Build & Release

## Quick Start

The canonical release flow is a single script:

```bash
cd /Users/simonbloom/apps-vol11/vibogit
./scripts/release/release.sh <X.Y.Z>
```

This runs all stages in order with fail-fast behavior.

### Options

| Flag | Effect |
|------|--------|
| `--dry-run` | Validate and simulate without side effects |
| `--skip-build` | Skip clean build (use existing artifacts) |

### Examples

```bash
# Full release
./scripts/release/release.sh 3.6.0

# Dry run (no writes)
./scripts/release/release.sh 3.6.0 --dry-run

# Skip build if DMG already exists
./scripts/release/release.sh 3.6.0 --skip-build
```

## What the script does

| Stage | Description |
|-------|-------------|
| 1. Preflight | Verify gh auth, bun, rustc, required files, link patterns |
| 2. Version bump | Update tauri.conf.json, Cargo.toml, sidebar.tsx, landing page links |
| 3. Clean build | Remove stale artifacts, bun install, build frontend, build Rust + DMG |
| 4. Artifact validation | Verify DMG exists, version strings match across all files |
| 4.5. Commit & push | Auto-commit version bump and push to remote before tagging |
| 5. GitHub release | Create/update release `vX.Y.Z`, upload DMG |
| 6. Landing page | Download links already updated in Stage 2 |
| 6.5. Wait for CI | Poll until CI uploads `latest.json` + signed updater artifacts (~10 min) |
| 7. Verification | Confirm updater endpoint, pubkey, auto-update hook, latest.json live, generate JSON report |

## Files that get version updates

| File | Field | Format |
|------|-------|--------|
| `apps/desktop/src-tauri/tauri.conf.json` | `"version"` | `"X.Y.Z"` |
| `apps/desktop/src-tauri/Cargo.toml` | `version` | `"X.Y.Z"` |
| `packages/ui/src/components/sidebar/sidebar.tsx` | Display string | `vX.Y.Z` |
| `apps/desktop/frontend/src/app/page.tsx` | Download URLs | `ViboGit_X.Y.Z_aarch64.dmg` |

If the user gives a version like "2.2", normalize it to semver: "2.2.0".

## After the script completes

The script automatically commits and pushes the version bump before creating the GitHub release tag, ensuring CI builds with the correct version in `tauri.conf.json`.

1. Verify the download from the landing page works

## Updater flow (in-app upgrades)

The Tauri updater checks:
```
https://github.com/simonbloom/vibogit/releases/latest/download/latest.json
```

For the updater to work fully, the GitHub Actions workflow (`release-desktop.yml`) must run with signing keys to produce `latest.json` and signed artifacts. The local release script uploads the DMG for manual downloads; the CI workflow handles updater metadata.

## What not to do

- Don't bypass the script with manual commands — use `release.sh` for consistency.
- Don't skip the clean step when changing Rust code.
- Don't forget `bun install` before the frontend build.
- Don't use `cargo tauri build` directly — use `node_modules/.bin/tauri build`.
- Don't push a tag manually -- the release script handles commit, push, and tag creation in the correct order.

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `gh not authenticated` | Run `gh auth login` |
| Stale Rust binary in DMG | Script cleans fingerprints automatically |
| `@vibogit/ui` import errors | Script runs `bun install` automatically |
| Landing page link not found | Ensure `page.tsx` has `ViboGit_*_aarch64.dmg` pattern |
| `latest.json` has old version | Tag was created before version bump was pushed. Delete release+tag, then re-run the script |
