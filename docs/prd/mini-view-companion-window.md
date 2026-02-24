---
title: "Mini-View Always-On-Top Companion Window"
created: 2026-02-24
status: approved
project11_id: pd7ccrq4xpxyfy8f1brkt1snd181sv4n
tags: [vibogit, desktop, tauri, ux, mini-view]
---

# PRD: ViboGit Mini-View (Always-On-Top Companion Window)

## Problem Statement

Developers using ViboGit need to switch away from their editor/browser to perform frequent, lightweight git actions (quick commit, open terminal, check dev server status). The full ViboGit window (1200x800) is too large to keep visible alongside other apps, so users constantly context-switch. There is no way to keep essential ViboGit controls persistently visible while working in other applications.

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Reduce context-switching | Average mini-view session duration | > 30 minutes while working in other apps |
| Quick git actions without full app | Quick commits performed from mini-view | > 20% of all quick commits |
| Always-accessible dev toolbox | Mini-view open rate among active users | > 40% of sessions spawn mini-view |

## User Story

> As any ViboGit user, I want a lightweight always-on-top toolbar window that gives me quick access to project switching, shortcuts, dev server connection, and quick commit -- so I can perform common git actions without leaving my editor.

## Use Cases

1. **Quick commit while coding**: Developer writes code in VS Code, notices changes piling up, clicks "Quick Commit" on the floating pill without switching windows.
2. **Open project in terminal/editor/browser**: Developer clicks a quick-link icon on the pill to open Finder, browser, GitHub, terminal, or editor for the current project.
3. **Monitor dev server**: Developer sees the green connection dot on the pill, confirming their dev server is running. Clicks to open in browser.
4. **Switch projects**: Developer switches the active project via the dropdown on the pill, and all quick actions now target the new project.

## Requirements

### Functional Requirements (Must Have)

| ID | Requirement | Priority |
|----|------------|----------|
| F1 | Open a second Tauri WebviewWindow ("mini-view") from the main window | Must Have |
| F2 | Mini-view is always-on-top of all windows by default | Must Have |
| F3 | Mini-view has no window decorations (no title bar, no traffic lights) | Must Have |
| F4 | Mini-view is draggable via a drag region | Must Have |
| F5 | Project selector dropdown showing saved projects | Must Have |
| F6 | Five quick-link icon buttons (Finder, Browser, GitHub, Terminal, Editor) | Must Have |
| F7 | Dev server connection status + connect button | Must Have |
| F8 | Quick Commit button with change count badge | Must Have |
| F9 | Close button that closes only the mini-view (main app stays open) | Must Have |
| F10 | Mini-view shares live state with main window via Tauri events | Must Have |

### Functional Requirements (Should Have)

| ID | Requirement | Priority |
|----|------------|----------|
| F11 | Button in main window header to spawn the mini-view | Should Have |
| F12 | Keyboard shortcut (Cmd+Shift+M) to toggle mini-view | Should Have |
| F13 | Mini-view remembers its screen position between sessions | Should Have |
| F14 | Visual feedback on quick commit (loading spinner, success toast) | Should Have |

### Functional Requirements (Nice to Have)

| ID | Requirement | Priority |
|----|------------|----------|
| F15 | Unstaged change count badge updates in real-time | Nice to Have |
| F16 | Mini-view auto-hides when full ViboGit window is focused | Nice to Have |
| F17 | Opacity/transparency setting for the pill | Nice to Have |

### Non-Functional Requirements

| ID | Requirement |
|----|------------|
| NF1 | Mini-view window must render in < 500ms |
| NF2 | Mini-view must not increase main app memory usage by more than 30MB |
| NF3 | Pill dimensions: ~520w x 48h pixels (compact single-row toolbar) |
| NF4 | Must work on macOS (primary), Windows and Linux (stretch) |

## ASCII UI Mockup -- Mini-View Pill

```
+-----------------------------------------------------------------+
| === my-project v | [F] [B] [G] [T] [E] | *:4158 | z 3 | [x] |
+-----------------------------------------------------------------+
 ^^^                 ^^^^^^^^^^^^^^^^^      ^^^^^^^^   ^^^   ^^^
 drag    project     quick links            server   commit close
 region  selector    (5 icons)              status   + count
```

Detailed breakdown:

```
+-----------------------------------------------------------------+
|                                                                 |
|  [drag]  [my-project v]  |  [F] [B] [G] [T] [E]  |  [*:4158]  |  [z 3]  |  [x]  |
|                                                                 |
+-----------------------------------------------------------------+

Where:
  [drag]         = Invisible drag handle area (~40px)
  [my-project v] = Dropdown select, shows project name, switches on select
  [F][B][G][T][E]= Folder, Browser, GitHub, Terminal, Editor icons
  [*:4158]       = Green/red dot + port number. Click = connect/open browser
  [z 3]          = Lightning bolt + unstaged count. Click = quick commit
  [x]            = Close mini-view window
```

States:

```
Disconnected:  | (red)  Connect |
Connecting:    | (yel) :4158..  |
Connected:     | (grn) :4158    |
Committing:    | (spin) ...     |
No changes:    | z 0            |  (disabled/dimmed)
```

## ASCII UI Mockup -- Toggle Button in Main Window

```
Existing main window header (right side):
+----------------------------------------------------------+
|  ... | [F] [B] [G] [T] [E] | [mini-view-toggle]  |
+----------------------------------------------------------+
                                ^^^
                           "Open Mini-View" tooltip
```

## ASCII UX Journey

```
[Main Window]
      |
      +---- Click [mini-view-toggle] button --- OR --- Cmd+Shift+M
      |
      v
[Mini-View Pill spawns]  -- always-on-top
      |                      decorations: false
      |                      ~520 x 48px
      |
      +-- [Project v] --> switches active project in both windows
      |
      +-- [Quick Links] --> opens Finder/Browser/GitHub/Terminal/Editor
      |
      +-- [*:4158] --> connect/open dev server
      |
      +-- [z 3] --> stages all + AI commit message + commit
      |
      +-- [x] --> closes mini-view only, main window unaffected
      |
      +-- Cmd+Tab / click dock --> switch to main window (standard macOS)

[State Sync Flow]
  Main Window                    Mini-View
      |                              |
      +-- file:change event -------->+-- refreshes change count
      |                              |
      +-- project switch ----------->+-- updates project name + actions
      |<--------- project switch ----+
      |                              |
      +-- commit complete ---------->+-- updates change count to 0
      |<--------- commit complete ---+
      |                              |
      +-- dev server status -------->+-- updates connection indicator
      |<--------- connect request ---+
```

## Technical Architecture

### Window Creation (Frontend JS)

```typescript
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";

const mini = new WebviewWindow("mini-view", {
  url: "/app/mini/",
  width: 520,
  height: 48,
  title: "ViboGit Mini",
  decorations: false,
  alwaysOnTop: true,
  resizable: false,
  transparent: true,
  skipTaskbar: true,
});
```

### New Next.js Route

- `/app/mini/page.tsx` -- lightweight page that renders the MiniView component
- Wrapped in minimal providers: ThemeProvider, DaemonProvider, ProjectsProvider, ConfigProvider
- Does NOT need TabsProvider or full layout

### State Sync via Tauri Events

The Rust backend already emits `file:change` to ALL windows. Both windows will independently react. For cross-window actions (project switch, commit), we use Tauri's emit() / listen():

- `mini:project-changed` -- emitted when mini-view switches project
- `mini:commit-complete` -- emitted after mini-view quick commit
- `main:project-changed` -- emitted when main window switches project
- `main:status-refreshed` -- emitted when main window refreshes

### Tauri Capabilities Required

Add to `apps/desktop/src-tauri/capabilities/main.json`:

```
core:window:allow-set-always-on-top
core:window:allow-set-size
core:window:allow-set-min-size
core:webviewWindow:allow-create-webview-window
```

### Key Files to Create/Modify

| Action | File |
|--------|------|
| Create | apps/desktop/frontend/src/app/app/mini/page.tsx |
| Create | packages/ui/src/components/mini-view.tsx |
| Modify | packages/ui/src/components/main-interface.tsx (add toggle button) |
| Modify | packages/ui/src/lib/daemon-context.tsx (add cross-window events) |
| Modify | packages/ui/src/lib/projects-context.tsx (add cross-window sync) |
| Modify | apps/desktop/src-tauri/capabilities/main.json (add permissions) |
| Modify | apps/desktop/src-tauri/src/lib.rs (add Cmd+Shift+M shortcut) |

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Two windows with independent React trees cause stale state | Medium | High | Use Tauri event bus for all mutations; both windows listen for same events |
| Mini-view WebviewWindow fails to create on some OS versions | Low | High | Graceful fallback: show toast error, log diagnostics |
| Always-on-top is annoying when not needed | Medium | Medium | Add a pin/unpin toggle within the pill, or respect a setting |
| Transparent + decorations:false causes visual issues on Windows/Linux | Medium | Low | macOS first; conditionally disable transparency on other platforms |
| Quick commit from mini-view conflicts with main window state | Low | High | After commit, emit event to both windows to refresh status |

## Launch Plan

1. **Phase 1 (MVP)**: Mini-view pill with project selector, 5 quick links, quick commit button, close button. No dev server integration. Main window toggle button only.
2. **Phase 2**: Add dev server connection status + connect. Add Cmd+Shift+M shortcut. Position persistence.
3. **Phase 3**: Real-time change count badge. Auto-hide on main focus. Opacity setting.

## Open Questions

1. Should the mini-view be spawnable from the tray icon menu as well?
2. Should there be a "detached" mode where the mini-view works even if the main window is closed?
3. Exact pill dimensions -- should it be fixed width or auto-size based on project name length?
