---
title: "ViboGit Tauri Desktop App"
created: 2026-02-03
status: draft
project11_id: pd70z8gp4835kkmv3e3ky1hwbh80f246
tags: [vibogit, tauri, desktop, macos, rust]
---

# PRD: ViboGit Tauri Desktop App

## Philosophy

> **"A native app that feels like magic - always there, always ready."**

The Tauri desktop app transforms ViboGit from a "browser + terminal command" experience into a true native macOS application. Users install once and forget - the app is always available via Cmd+Tab, shows status in the menu bar, and never requires running `npx vibogit` again.

## Problem Statement

The current architecture requires users to:
1. Open a browser tab (which gets lost among 47 other tabs)
2. Run `npx vibogit` in terminal every time they restart their machine
3. See a "daemon is sleeping" error when they forget step 2
4. Mentally context-switch between browser and terminal

**This friction kills the "vibe" in ViboGit.**

The Vibe Coder wants to Cmd+Tab to ViboGit, click Save, click Ship, and get back to coding. No terminal commands. No browser tabs. Just a dedicated app that's always ready.

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Zero terminal commands | User never types `npx vibogit` after install |
| Always available | App in Cmd+Tab within 2 seconds of login |
| Native feel | Users say "it feels like a real Mac app" |
| Seamless updates | 95% of users on latest version within 7 days |
| Small footprint | App bundle < 15MB, RAM < 100MB idle |

## Target User

Same Vibe Coder from the original PRD, but now with an even lower tolerance for friction:
- Expects apps to "just work" like Slack, Discord, or Spotify
- Wants a dock icon they can click
- Expects background sync without thinking about daemons

## User Stories

### P0 (Must Have)
1. **As a Vibe Coder**, I can install ViboGit once and it's always available via Cmd+Tab.
2. **As a Vibe Coder**, the app starts automatically when I log in to my Mac.
3. **As a Vibe Coder**, I see a menu bar icon showing my current project's status.
4. **As a Vibe Coder**, the app updates automatically in the background.
5. **As a Vibe Coder**, I get all the same features as the web version (Save, Ship, Timeline, etc.).

### P1 (Should Have)
6. **As a Vibe Coder**, I can click the menu bar icon for quick actions without opening the main window.
7. **As a Vibe Coder**, I receive native macOS notifications for important events.
8. **As a Vibe Coder**, I can use keyboard shortcuts (Cmd+S to Save, Cmd+Shift+S to Ship).

### P2 (Nice to Have)
9. **As a browser user**, I can still use vibogit.app with the WebSocket daemon as a fallback.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    VIBOGIT TAURI DESKTOP ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  TAURI APP (ViboGit.app)                              ~10-15MB      │  │
│   │  ════════════════════════════════════════════════════════════════   │  │
│   │                                                                     │  │
│   │  ┌─────────────────────────────────────────────────────────────┐   │  │
│   │  │  macOS WebView (WKWebView)                                  │   │  │
│   │  │  ─────────────────────────────                              │   │  │
│   │  │                                                             │   │  │
│   │  │  Loads: https://vibogit.app (hosted Next.js)                │   │  │
│   │  │                                                             │   │  │
│   │  │  • Full ViboGit UI (React, Tailwind, shadcn)                │   │  │
│   │  │  • UI updates via Vercel deploys (no app update needed)     │   │  │
│   │  │  • Detects Tauri via window.__TAURI__                       │   │  │
│   │  │  • Calls Rust backend via invoke()                          │   │  │
│   │  │                                                             │   │  │
│   │  └─────────────────────────────────────────────────────────────┘   │  │
│   │                              │                                      │  │
│   │                              │ Tauri IPC (invoke / events)          │  │
│   │                              ▼                                      │  │
│   │  ┌─────────────────────────────────────────────────────────────┐   │  │
│   │  │  Rust Backend (src-tauri)                                   │   │  │
│   │  │  ────────────────────────                                   │   │  │
│   │  │                                                             │   │  │
│   │  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌─────────┐  │   │  │
│   │  │  │  Git Ops  │  │  Watcher  │  │  Tray     │  │ Launcher│  │   │  │
│   │  │  │  (git2)   │  │  (notify) │  │  Icon     │  │ (open)  │  │   │  │
│   │  │  └───────────┘  └───────────┘  └───────────┘  └─────────┘  │   │  │
│   │  │                                                             │   │  │
│   │  │  Plugins:                                                   │   │  │
│   │  │  • tauri-plugin-autostart (login startup)                   │   │  │
│   │  │  • tauri-plugin-notification (native alerts)                │   │  │
│   │  │  • tauri-plugin-shell (open terminal/editor)                │   │  │
│   │  │  • tauri-plugin-updater (auto-updates)                      │   │  │
│   │  │                                                             │   │  │
│   │  └─────────────────────────────────────────────────────────────┘   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ☁️  Vercel: https://vibogit.app (UI hosted, updates independently)        │
│   ☁️  Convex: User settings, auth (deferred - discussed later)              │
│                                                                             │
│   ───────────────────────────────────────────────────────────────────────   │
│                                                                             │
│   🌐 BROWSER FALLBACK (for users without desktop app)                       │
│   ─────────────────────────────────────────────────────                     │
│                                                                             │
│   ┌───────────────┐     WebSocket      ┌───────────────────────────────┐   │
│   │  Browser      │◀───────────────────│  Bun Daemon (npx vibogit)     │   │
│   │  vibogit.app  │  localhost:9111    │  • Same git ops               │   │
│   └───────────────┘                    │  • For users who prefer CLI   │   │
│                                        └───────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Monorepo Structure

```
vibogit/
├── apps/
│   ├── web/                          # Next.js 15 (hosted on Vercel)
│   │   ├── app/
│   │   │   ├── layout.tsx
│   │   │   ├── page.tsx
│   │   │   └── (routes)/
│   │   ├── components/
│   │   │   ├── ui/                   # shadcn components
│   │   │   ├── timeline/             # Commit graph
│   │   │   ├── changes/              # Diff viewer
│   │   │   └── save-ship/            # Main actions
│   │   ├── lib/
│   │   │   ├── tauri.ts              # Tauri detection & commands
│   │   │   ├── daemon.ts             # WebSocket fallback
│   │   │   └── git-client.ts         # Unified interface
│   │   └── package.json
│   │
│   ├── desktop/                      # Tauri app (NEW)
│   │   ├── src/                      # Minimal frontend (optional)
│   │   │   └── main.ts               # Tauri entry (loads remote URL)
│   │   ├── src-tauri/
│   │   │   ├── Cargo.toml
│   │   │   ├── tauri.conf.json       # Tauri config
│   │   │   ├── capabilities/         # Security permissions
│   │   │   │   └── main.json
│   │   │   ├── icons/                # App icons
│   │   │   └── src/
│   │   │       ├── main.rs           # Entry point
│   │   │       ├── lib.rs            # Command registration
│   │   │       ├── git.rs            # Git operations (git2)
│   │   │       ├── watcher.rs        # File system watcher
│   │   │       ├── tray.rs           # System tray
│   │   │       └── commands.rs       # Tauri command handlers
│   │   └── package.json
│   │
│   └── daemon/                       # Bun daemon (fallback)
│       ├── src/
│       │   ├── index.ts
│       │   ├── git.ts
│       │   └── watcher.ts
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared TypeScript types
│       ├── src/
│       │   ├── types.ts              # ProjectState, Commit, etc.
│       │   └── index.ts
│       └── package.json
│
├── package.json                      # Turborepo root
└── turbo.json
```

## Tauri Configuration

### tauri.conf.json
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "ViboGit",
  "version": "0.1.0",
  "identifier": "app.vibogit.desktop",
  "build": {
    "frontendDist": "https://vibogit.app"
  },
  "app": {
    "withGlobalTauri": true,
    "windows": [
      {
        "title": "ViboGit",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "center": true,
        "decorations": true,
        "transparent": false
      }
    ],
    "trayIcon": {
      "iconPath": "icons/tray.png",
      "iconAsTemplate": true
    },
    "security": {
      "dangerousRemoteDomainIpcAccess": [
        {
          "domain": "vibogit.app",
          "enableTauriAPI": true,
          "windows": ["main"],
          "plugins": ["shell", "notification", "fs"]
        }
      ]
    }
  },
  "bundle": {
    "active": true,
    "targets": ["dmg", "app"],
    "icon": ["icons/icon.icns"],
    "macOS": {
      "minimumSystemVersion": "10.15"
    }
  },
  "plugins": {
    "updater": {
      "endpoints": ["https://vibogit.app/api/releases/{{target}}/{{arch}}/{{current_version}}"],
      "pubkey": "..."
    }
  }
}
```

### Cargo.toml Dependencies
```toml
[dependencies]
tauri = { version = "2.0", features = ["tray-icon", "devtools"] }
tauri-plugin-autostart = "2.0"
tauri-plugin-notification = "2.0"
tauri-plugin-shell = "2.0"
tauri-plugin-updater = "2.0"
tauri-plugin-fs = "2.0"

# Core functionality
git2 = "0.19"           # libgit2 bindings
notify = "6.0"          # File system watcher
tokio = { version = "1", features = ["full"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Utilities
dirs = "5"              # Get home/config directories
open = "5"              # Open URLs/files in default apps
```

## Rust Commands (API Surface)

```rust
// ═══════════════════════════════════════════════════════════════
// Git Operations
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
async fn git_status(path: String) -> Result<ProjectState, GitError> {
    // Returns: changed files, staged files, branch name, ahead/behind
}

#[tauri::command]
async fn git_save(path: String, message: Option<String>) -> Result<SaveResult, GitError> {
    // Stage all + commit (generate message if not provided)
}

#[tauri::command]
async fn git_ship(path: String) -> Result<ShipResult, GitError> {
    // Push to remote
}

#[tauri::command]
async fn git_sync(path: String) -> Result<SyncResult, GitError> {
    // Pull + Push
}

#[tauri::command]
async fn git_log(path: String, limit: Option<u32>) -> Result<Vec<Commit>, GitError> {
    // Get commit history for timeline
}

#[tauri::command]
async fn git_diff(path: String) -> Result<Vec<FileDiff>, GitError> {
    // Get diff for changes view
}

// ═══════════════════════════════════════════════════════════════
// Project Management
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
async fn set_project(path: String) -> Result<ProjectInfo, Error> {
    // Set active project, start file watcher
}

#[tauri::command]
async fn list_recent_projects() -> Result<Vec<ProjectInfo>, Error> {
    // Get recently opened projects (stored locally)
}

#[tauri::command]
async fn add_project_folder() -> Result<Option<String>, Error> {
    // Open folder picker dialog
}

// ═══════════════════════════════════════════════════════════════
// Launchers
// ═══════════════════════════════════════════════════════════════

#[tauri::command]
async fn open_in_browser(url: String) -> Result<(), Error> {
    open::that(url)?;
    Ok(())
}

#[tauri::command]
async fn open_in_editor(path: String) -> Result<(), Error> {
    // Detect VS Code, Cursor, etc.
}

#[tauri::command]
async fn open_in_terminal(path: String) -> Result<(), Error> {
    // Open Terminal.app or iTerm
}

#[tauri::command]
async fn open_in_finder(path: String) -> Result<(), Error> {
    open::that(path)?;
    Ok(())
}

// ═══════════════════════════════════════════════════════════════
// Events (Rust → WebView)
// ═══════════════════════════════════════════════════════════════

// Emitted when file system changes
struct FileChangeEvent {
    paths: Vec<String>,
    kind: ChangeKind,  // Create, Modify, Delete
}

// Emitted when git state changes
struct GitStateEvent {
    state: ProjectState,
}
```

## Frontend Integration (lib/tauri.ts)

```typescript
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

// ═══════════════════════════════════════════════════════════════
// Environment Detection
// ═══════════════════════════════════════════════════════════════

export const isTauri = (): boolean => 
  typeof window !== 'undefined' && '__TAURI__' in window;

// ═══════════════════════════════════════════════════════════════
// Unified Git Client
// ═══════════════════════════════════════════════════════════════

export const gitClient = {
  async status(path: string): Promise<ProjectState> {
    if (isTauri()) {
      return invoke('git_status', { path });
    } else {
      return daemonClient.send({ action: 'status', path });
    }
  },

  async save(path: string, message?: string): Promise<SaveResult> {
    if (isTauri()) {
      return invoke('git_save', { path, message });
    } else {
      return daemonClient.send({ action: 'save', path, message });
    }
  },

  async ship(path: string): Promise<ShipResult> {
    if (isTauri()) {
      return invoke('git_ship', { path });
    } else {
      return daemonClient.send({ action: 'ship', path });
    }
  },

  // ... other methods
};

// ═══════════════════════════════════════════════════════════════
// Event Subscriptions
// ═══════════════════════════════════════════════════════════════

export function onFileChange(callback: (event: FileChangeEvent) => void) {
  if (isTauri()) {
    return listen<FileChangeEvent>('file:change', (e) => callback(e.payload));
  } else {
    return daemonClient.on('file:change', callback);
  }
}
```

## System Tray Design

```
┌─────────────────────────────┐
│  ◉  ViboGit                │  ← Menu bar icon (template image)
└─────────────────────────────┘
             │
             ▼
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │ myapp                 │  │  ← Current project
│  │ 3 changes · main      │  │
│  └───────────────────────┘  │
│  ───────────────────────────│
│  ⚡ Quick Save              │  ← One-click save
│  🚀 Quick Ship              │  ← One-click ship
│  ───────────────────────────│
│  📂 Open Window             │
│  💻 Open in Editor          │
│  📁 Open in Finder          │
│  ───────────────────────────│
│  ⚙️  Preferences...          │
│  🔄 Check for Updates       │
│  ───────────────────────────│
│  Quit ViboGit               │
└─────────────────────────────┘
```

## UX Journey: First Launch

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         FIRST LAUNCH FLOW                                │
└──────────────────────────────────────────────────────────────────────────┘

[Download DMG] ──► [Drag to Applications] ──► [Launch ViboGit.app]
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  WELCOME SCREEN     │
                                          │  ────────────────   │
                                          │                     │
                                          │  "Add Your First    │
                                          │   Project"          │
                                          │                     │
                                          │  [Choose Folder]    │
                                          │                     │
                                          └─────────────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  LAUNCH AT LOGIN?   │
                                          │  ────────────────   │
                                          │                     │
                                          │  ViboGit works best │
                                          │  when it's always   │
                                          │  ready.             │
                                          │                     │
                                          │  [Enable] [Not Now] │
                                          │  (default: Enable)  │
                                          └─────────────────────┘
                                                     │
                                                     ▼
                                          ┌─────────────────────┐
                                          │  MAIN INTERFACE     │
                                          │  ────────────────   │
                                          │  (same as web UI)   │
                                          │                     │
                                          │  ⚡ SAVE  🚀 SHIP   │
                                          │                     │
                                          └─────────────────────┘
                                                     │
                                                     ▼
                                       [App in Dock] + [Tray Icon]
```

## UX Journey: Daily Use

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          DAILY USE FLOW                                  │
└──────────────────────────────────────────────────────────────────────────┘

[Login to Mac]
      │
      ▼
[ViboGit starts automatically]  ──► [Tray icon visible: ◉]
      │
      │   (User codes in Cursor/VS Code)
      │
      ▼
[File changes detected]  ──► [Tray updates: ◉ 3]  ← Badge shows change count
      │
      │
      ├─────── Option A: Cmd+Tab ────────┐
      │                                  │
      │                                  ▼
      │                        ┌─────────────────────┐
      │                        │  MAIN WINDOW        │
      │                        │  Click ⚡ SAVE      │
      │                        └─────────────────────┘
      │
      └─────── Option B: Tray Menu ──────┐
                                         │
                                         ▼
                               ┌─────────────────────┐
                               │  TRAY MENU          │
                               │  Click Quick Save   │
                               └─────────────────────┘
                                         │
                                         ▼
                          [Changes committed with AI message]
                                         │
                                         ▼
                          [Native notification: "Saved! ✓"]
```

## Distribution Strategy

### Phase 1: DMG Download
```
https://vibogit.app/download
       │
       ▼
┌─────────────────────────────────────────────────────────────────┐
│  ViboGit for Mac                                                │
│  ─────────────────                                              │
│                                                                 │
│  [Download for macOS]                                           │
│   ViboGit-0.1.0-arm64.dmg (Apple Silicon)                       │
│   ViboGit-0.1.0-x64.dmg (Intel)                                 │
│                                                                 │
│  Or install with Homebrew:                                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  brew install --cask vibogit                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Phase 2: Homebrew Cask
```ruby
# Cask formula: vibogit.rb
cask "vibogit" do
  version "0.1.0"
  sha256 arm: "...", intel: "..."

  url "https://github.com/vibogit/vibogit/releases/download/v#{version}/ViboGit-#{version}-#{arch}.dmg"
  name "ViboGit"
  desc "Git for the Vibe Coder"
  homepage "https://vibogit.app"

  auto_updates true
  
  app "ViboGit.app"
end
```

### Auto-Updates (Tauri Updater)
```
[App Running] ──► [Check for updates on startup]
                         │
                         ▼
              ┌─────────────────────────────┐
              │  Update Available!          │
              │  ────────────────           │
              │  v0.2.0 is ready            │
              │                             │
              │  [Update Now] [Later]       │
              └─────────────────────────────┘
                         │
                         ▼
              [Download in background]
                         │
                         ▼
              [Install on next launch]
```

## Technical Considerations

### Security
- Code signing with Apple Developer certificate (required for notarization)
- Notarization for Gatekeeper approval
- `dangerousRemoteDomainIpcAccess` scoped only to `vibogit.app`
- Tauri's built-in IPC security model

### Performance
- Rust backend: near-instant git operations via libgit2
- `notify` crate for efficient file watching (uses FSEvents on macOS)
- WebView shares system resources with Safari (no Chromium overhead)
- Lazy loading of commit history for large repos

### Offline Support
- Git operations work offline (local commits)
- UI loads from cache when offline (service worker on web)
- Push/Ship requires network (graceful error handling)

## Implementation Phases

### Phase 1: Tauri Shell (Week 1)
- [ ] Initialize Tauri 2.0 project in monorepo
- [ ] Configure WebView to load https://vibogit.app
- [ ] Set up `dangerousRemoteDomainIpcAccess` for IPC
- [ ] Basic window management (open, close, minimize)
- [ ] App icon and bundle configuration

### Phase 2: Git Backend (Week 2)
- [ ] Implement git operations in Rust (git2)
  - [ ] `git_status`
  - [ ] `git_save` (stage all + commit)
  - [ ] `git_ship` (push)
  - [ ] `git_log` (for timeline)
  - [ ] `git_diff` (for changes view)
- [ ] File watcher with `notify` crate
- [ ] Event emission to WebView

### Phase 3: Frontend Integration (Week 3)
- [ ] `lib/tauri.ts` - Tauri detection and command wrappers
- [ ] Update web app to use `gitClient` abstraction
- [ ] Handle events from Rust backend
- [ ] Test Tauri ↔ Web communication

### Phase 4: Native Features (Week 4)
- [ ] System tray with project status
- [ ] Tray menu with quick actions
- [ ] Auto-start on login (tauri-plugin-autostart)
- [ ] Native notifications
- [ ] Keyboard shortcuts

### Phase 5: Distribution (Week 5)
- [ ] DMG build configuration
- [ ] Code signing and notarization
- [ ] Auto-updater setup
- [ ] Download page on vibogit.app
- [ ] Homebrew cask formula

### Phase 6: Polish & Fallback (Week 6)
- [ ] Browser fallback with Bun daemon
- [ ] Error handling and edge cases
- [ ] Performance optimization
- [ ] User testing and feedback

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| WebView + Remote URL security | High | Strict capability scoping, only allow vibogit.app |
| Apple notarization delays | Medium | Submit early, have fallback unsigned builds |
| Large repo performance | Medium | Lazy loading, pagination, background indexing |
| libgit2 edge cases | Medium | Comprehensive test suite, fallback to CLI |
| User confusion (web vs desktop) | Low | Clear onboarding, consistent UI |

## Open Questions

1. **AI commit messages**: Run in Rust (local LLM?) or call web API?
2. **Multiple projects**: Tabs in main window, or separate windows?
3. **Convex integration**: What should sync to cloud? (deferred per user request)
4. **Windows/Linux**: Timeline for other platforms?

## Success Criteria

- [ ] User can install ViboGit.app and have it working in < 60 seconds
- [ ] App appears in Cmd+Tab after login without user action
- [ ] Save + Ship work identically to web version
- [ ] Tray icon shows accurate status
- [ ] Auto-updates work without user intervention
- [ ] App size < 15MB
- [ ] RAM usage < 100MB idle
