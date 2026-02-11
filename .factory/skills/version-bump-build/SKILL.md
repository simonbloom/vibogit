---
name: version-bump-build
version: 1.0.0
description: |
  Bump the ViboGit version number across all required files and rebuild the desktop DMG.
  Use when the user asks to change the version, bump the version, release a new version,
  or rebuild the desktop app DMG. Handles the full clean build process to ensure the DMG
  contains fresh frontend and Rust code.
---

# Version Bump & Desktop Build

## Files that need version updates

All of these must be updated to the new version string. Missing any one causes version mismatches between the app, the binary, and what the user sees in the UI.

| File | Field | Format |
|------|-------|--------|
| `apps/desktop/src-tauri/tauri.conf.json` | `"version"` | `"X.Y.Z"` |
| `apps/desktop/src-tauri/Cargo.toml` | `version` | `"X.Y.Z"` |
| `packages/ui/src/components/sidebar/sidebar.tsx` | Display string | `vX.Y.Z` |
| `apps/daemon/package.json` | `"version"` | `"X.Y.Z"` |

If the user gives a version like "2.2", normalize it to semver: "2.2.0".

## Clean build process

The DMG includes two codebases that both must be rebuilt from clean. Skipping any clean step risks shipping stale code.

### Step 1: Clean all build artifacts

```bash
cd /Users/simonbloom/windsurf/vibogit

# Frontend
rm -rf apps/desktop/frontend/.next
rm -rf apps/desktop/frontend/out

# Rust binary + incremental cache + fingerprints
rm -f  apps/desktop/src-tauri/target/release/vibogit
rm -f  apps/desktop/src-tauri/target/release/vibogit.d
rm -rf apps/desktop/src-tauri/target/release/.fingerprint/vibogit-*
rm -rf apps/desktop/src-tauri/target/release/incremental/vibogit-*

# Bundle/DMG packaging
rm -rf apps/desktop/src-tauri/target/release/bundle
```

### Step 2: Install dependencies

```bash
cd /Users/simonbloom/windsurf/vibogit
bun install
```

### Step 3: Build frontend

```bash
cd /Users/simonbloom/windsurf/vibogit/apps/desktop/frontend
bun run build
```

Verify it exits with code 0 and the `out/` directory is created.

### Step 4: Build Rust + DMG

```bash
cd /Users/simonbloom/windsurf/vibogit/apps/desktop
node_modules/.bin/tauri build --bundles dmg
```

This takes ~1-2 minutes. The DMG will be at:
```
apps/desktop/src-tauri/target/release/bundle/dmg/ViboGit_{VERSION}_aarch64.dmg
```

## Verify it worked

1. The DMG file exists at the expected path with the correct version in the filename
2. `grep version apps/desktop/src-tauri/tauri.conf.json` shows the new version
3. `grep version apps/desktop/src-tauri/Cargo.toml` shows the new version
4. The sidebar.tsx display string matches

## What not to do

- Don't use `cargo tauri build` directly -- the cargo subcommand isn't installed. Use `node_modules/.bin/tauri build` from `apps/desktop/`.
- Don't skip the clean step. Cargo's incremental compilation may reuse a stale binary even after source changes if fingerprints are cached.
- Don't forget `bun install` before the frontend build. It links the `@vibogit/ui` workspace package which the frontend depends on.
- Don't run the build without cleaning first when changing Rust code. The fingerprint cache can silently use the old binary.
