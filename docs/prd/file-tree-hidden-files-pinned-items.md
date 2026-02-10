---
title: "File Tree Enhancements - Hidden Files & Pinned Items"
created: 2026-02-10
status: approved
project11_id: pd7ave504br389q9qjsrapcc9580xptr
tags: [file-tree, ux, hidden-files, pinning]
---

# PRD: File Tree Enhancements -- Hidden Files & Pinned Items

## Problem Statement

Users working with ViboGit's file tree cannot see hidden/dotfiles (e.g., `.github`, `.env`, `.gitignore`) and have no way to quickly access frequently used files or folders like `docs/` or agent configuration files. This forces users to rely on external tools to navigate important project files.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Users can toggle hidden file visibility | Toggle button works in tree header; tree refreshes showing/hiding dotfiles |
| Users can pin frequently accessed files/folders | Right-click context menu allows pin/unpin; pinned items sort to top |
| Pinned items persist per-repository | Pins survive page reload and are scoped to each repo |

## User Stories

1. **As a developer**, I want to toggle hidden files on/off in the file tree so I can quickly inspect dotfiles like `.github/`, `.env`, or `.gitignore` without leaving ViboGit.
2. **As a developer**, I want to right-click a file or folder and pin it so it always appears at the top of my file tree for quick access.
3. **As a developer**, I want my pinned items to be remembered per-repository so each project has its own set of favorites.

## Requirements

### Functional Requirements

**FR-1: Show Hidden Files Toggle**
- Add an "eye" icon toggle button in the file tree header bar
- When toggled ON: pass `showHidden: true` to `listFiles` and re-fetch the tree
- When toggled OFF (default): hidden files filtered out as they are today
- Toggle state stored in `localStorage` per session (not persisted in settings)
- The daemon `listFiles` handler must also accept and forward the `showHidden` parameter (currently only Tauri backend supports it)

**FR-2: Pin/Unpin via Right-Click Context Menu**
- Wrap each file tree node with a Radix `ContextMenu` (already installed)
- Context menu items: "Pin to Top" (if unpinned) / "Unpin" (if pinned)
- Pinned items sort to the top of the tree at their current depth level (root-level pins at root top, nested pins at top of their parent folder)
- Pinned items display a small pin icon (lucide `Pin`) to the left of their name
- Pinned items maintain alphabetical sort among themselves

**FR-3: Per-Repository Pin Persistence**
- Store pinned paths in `localStorage` keyed by repository path (e.g., `vibogit-pins-{repoPath}`)
- Pin data structure: `Set<string>` of relative file paths
- Pins persist across page reloads and app restarts

### Non-Functional Requirements

- Toggle and context menu must respond in under 100ms
- Pin storage should handle up to 100 pinned items without performance degradation
- No changes to the Rust backend required for pinning (frontend-only feature)

## Technical Considerations

### Current Architecture

| Layer | Hidden Files Support | Pinning Support |
|-------|---------------------|-----------------|
| Rust backend (`commands.rs`) | `show_hidden` param exists, works | N/A (frontend only) |
| Tauri bridge (`daemon-context.tsx`) | Passes `showHidden` through | N/A |
| Daemon (`server.ts`) | Does NOT accept `showHidden` -- skips dotfiles via hardcoded `ignoreDirs` but doesn't filter by `.` prefix | N/A |
| Frontend (`file-tree.tsx`) | Does NOT pass `showHidden` to `send()` | No pinning logic |
| Settings (`settings.ts`) | `showHiddenFiles: boolean` exists but unused | No pin fields |

### Changes Required

```
file-tree.tsx          - Add toggle button, pass showHidden, add context menu, pin sorting
daemon server.ts       - Accept showHidden param in listFiles, filter dotfiles when false
settings.ts (or local) - Pin storage utility functions (localStorage)
```

### ASCII UI Mockup -- File Tree with Toggle & Pinned Items

```
+---------------------------------------------------+
| Files                              [Eye] [Refresh] |
+---------------------------------------------------+
| > [Pin] docs/                    (pinned, folder)  |
|   [Pin] agents.md                (pinned, file)    |
| ------  (visual separation via sort, no divider)   |
| > apps/                                            |
| > homebrew/                                        |
|   package.json                                     |
|   pnpm-workspace.yaml                              |
|   README.md                                        |
+---------------------------------------------------+
```

### ASCII UI Mockup -- Context Menu

```
+---------------------------------------------------+
| > apps/                                            |
| > docs/           +---------------------+          |
|   package.json    | Pin to Top          |          |
|   README.md  <-   | Open in Editor      |          |
|                   +---------------------+          |
+---------------------------------------------------+
```

### ASCII UX Journey

```
[File Tree loads] --> [User clicks Eye toggle] --> [Tree re-fetches with showHidden=true]
                                                        |
                                                   [Dotfiles appear]
                                                        |
[User right-clicks file] --> [Context Menu] --> [Pin to Top] --> [File sorts to top + pin icon]
                                                    |
                                            [Unpin] --> [File returns to normal position]
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Daemon doesn't filter dotfiles by `.` prefix (only `ignoreDirs` set) | Add dotfile filtering in daemon's `listFilesRecursive` when `showHidden=false` |
| Pinned paths become stale if files are deleted/renamed | Silently ignore pins for paths not found in current tree; no error shown |
| Large number of pins could clutter the tree | Practical limit -- context menu makes it intentional; users self-manage |

## Launch Plan

- Feature flag: none needed (small enhancement)
- Rollout: ship in next build for both web and desktop
- No backend API changes; no database changes

## Open Questions

- Should the hidden files toggle state persist across sessions or reset each time? (Current decision: per-session only, resets on reload)
