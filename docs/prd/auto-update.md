---
title: "Auto-Update"
created: 2026-02-15
status: approved
project11_id: pd75j2a4kbaxnwkbmr02n09n31816kkp
tags: [desktop, infrastructure, tauri]
---

# PRD: ViboGit Auto-Update

## Problem Statement

ViboGit users currently have no way to receive updates automatically. When a new version is released, users must manually discover it, download the DMG, and reinstall. This creates friction, leads to users running outdated versions with known bugs, and increases support burden. The `tauri-plugin-updater` dependency is already in `Cargo.toml` and capabilities are configured, but no actual implementation exists.

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Users stay on latest version | % of active users on latest within 7 days | > 80% |
| Minimal friction | Update completion rate (started vs finished) | > 90% |
| No disruption | Zero forced restarts during active work | 0 |
| Reliable delivery | Update check success rate | > 99% |

## User Stories

1. **As a user**, I want the app to automatically check for updates so I always have the latest features and fixes without thinking about it.
2. **As a user**, I want a non-blocking notification when an update is available so I can continue working and update when convenient.
3. **As a user**, I want to see download progress so I know the update status.
4. **As a user**, I want to manually check for updates from Settings so I can verify I'm on the latest version.
5. **As a user**, I want to see release notes before updating so I know what changed.
6. **As a developer**, I want a simple CI workflow that signs and publishes updates automatically when I tag a release.

## Requirements

### Functional (Must Have)
1. Auto-check for updates on app launch and every 4 hours
2. Non-blocking toast/banner when update is available (using existing sonner/toast system)
3. Download progress indicator during update
4. "Check for Updates" button in Settings panel
5. Ed25519 update signing (key generation + CI integration)
6. GitHub Releases hosting with `latest.json` auto-generation via `tauri-action`
7. macOS aarch64 + x86_64 support
8. App relaunch after install with user confirmation

### Functional (Should Have)
9. Display release notes in the update banner
10. "Remind me later" / dismiss option on update banner
11. Version info display in Settings (current version + "up to date" status)

### Non-Functional
12. Update check must not block app startup (async, fire-and-forget)
13. Update download must not degrade app performance
14. TLS enforced for all update endpoints
15. Failed update checks silently retry (no error spam to user)

## Technical Considerations

### Current State (already done)
- `tauri-plugin-updater = "2.0"` in `Cargo.toml`
- Updater capabilities in `capabilities/main.json` (`updater:default`, `updater:allow-check`, `updater:allow-download-and-install`)
- `tauri-plugin-dialog` already installed (Rust + JS)
- GitHub Actions workflow exists (`release-desktop.yml`)

### What Needs to Be Done

**Rust side (`src-tauri/`):**
- Register updater plugin in `lib.rs`: `.plugin(tauri_plugin_updater::Builder::new().build())`
- Add `tauri-plugin-process` for `relaunch()` support
- Add `createUpdaterArtifacts: true` to `tauri.conf.json` bundle config
- Add `plugins.updater.pubkey` and `plugins.updater.endpoints` to `tauri.conf.json`

**JS side (frontend):**
- Install `@tauri-apps/plugin-updater` and `@tauri-apps/plugin-process`
- Create `useAutoUpdate` hook (check logic, download, install, progress tracking)
- Create `UpdateBanner` component (toast-style, non-blocking)
- Add "Check for Updates" section to `SettingsPanel`
- Wire auto-check on app mount + 4-hour interval

**CI/CD (`release-desktop.yml`):**
- Replace manual build with `tauri-apps/tauri-action@v0` (generates signed artifacts + `latest.json`)
- Add `TAURI_SIGNING_PRIVATE_KEY` and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` as GitHub secrets
- Upload `latest.json`, `.app.tar.gz`, `.app.tar.gz.sig` to GitHub Releases
- Build universal macOS binary (aarch64 + x86_64) or separate per-arch
- Add `process:default` and `process:allow-restart` to capabilities

**Key generation (one-time setup):**
- Run `bun tauri signer generate -- -w ~/.tauri/vibogit.key`
- Store public key in `tauri.conf.json`
- Store private key as GitHub secret `TAURI_SIGNING_PRIVATE_KEY`

### Architecture

```
+----------------------------------------------------------+
|  ViboGit App (Tauri 2)                                   |
+----------------------------------------------------------+
|                                                          |
|  [App Launch] ---> useAutoUpdate hook                    |
|                      |                                   |
|                      v                                   |
|  [Check endpoint] --> GitHub Releases latest.json        |
|                      |                                   |
|               No update? --> silent, do nothing          |
|               Update?    --> Show UpdateBanner           |
|                              |                           |
|                              v                           |
|                    [User clicks "Update"]                |
|                              |                           |
|                              v                           |
|                    [Download + Progress Bar]             |
|                              |                           |
|                              v                           |
|                    [Install + Relaunch prompt]           |
|                                                          |
+----------------------------------------------------------+
```

### Update Flow

```
[App Launch] --> check() --> [GitHub Releases latest.json]
     |                              |
     |                    [200 + JSON] --> version > current?
     |                              |              |
     |                     [204 No Content]    Yes: show banner
     |                         |                   |
     |                    (no update)         [User: "Update Now"]
     |                                             |
     |                                    downloadAndInstall()
     |                                             |
     |                                    [Progress: 0%...100%]
     |                                             |
     |                                    [Confirm relaunch?]
     |                                             |
     |                                        relaunch()
     |
     +--> [4hr timer] --> check() --> (repeat)
```

### UI Mockups

**Update Banner (appears at top of main content area):**
```
+----------------------------------------------------------+
| [Arrow-Up] ViboGit v3.1.0 is available!  [Update] [Later]|
+----------------------------------------------------------+
```

**Update Banner (downloading):**
```
+----------------------------------------------------------+
| [Spinner] Downloading update...  [=====>        ] 62%     |
+----------------------------------------------------------+
```

**Update Banner (ready to install):**
```
+----------------------------------------------------------+
| [Check] Update ready! Restart to apply.  [Restart Now]    |
+----------------------------------------------------------+
```

**Settings Panel addition (after existing settings):**
```
+------------------------------------------+
| Updates                                  |
|                                          |
| Current version: 3.0.1                  |
| [Check for Updates]                     |
|                                          |
| Status: Up to date  /  Update available |
+------------------------------------------+
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Private key lost | Cannot push updates to existing users | Back up key in secure vault (1Password/etc) |
| Signing key leaked | Attacker could push malicious updates | Store as GitHub encrypted secret only |
| GitHub rate limits on releases API | Update checks fail | Retry with backoff; multiple endpoints |
| macOS Gatekeeper blocks updated app | App won't launch after update | Ensure code signing is properly configured in CI |
| Update interrupts user workflow | Data loss during git operations | Non-blocking banner; user-initiated install only |

## Launch Plan

1. **Phase 1 - Infrastructure**: Generate signing keys, update `tauri.conf.json`, register plugin in Rust
2. **Phase 2 - CI/CD**: Update GitHub Actions to use `tauri-action`, sign builds, generate `latest.json`
3. **Phase 3 - Frontend**: Build `useAutoUpdate` hook, `UpdateBanner` component, Settings integration
4. **Phase 4 - Testing**: Build v3.0.1 locally, publish v3.1.0-beta via GitHub Release, verify update flow end-to-end
5. **Phase 5 - Ship**: Tag release, monitor update adoption

## Open Questions

1. Should the Homebrew cask formula be auto-updated too (via `livecheck` or a bot)?
2. Do we want analytics/telemetry on update adoption rates?
3. Should we support a "beta channel" for early adopters?
