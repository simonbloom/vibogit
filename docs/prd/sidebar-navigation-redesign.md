---
title: "Sidebar Navigation & Project List Redesign"
created: 2026-02-04
status: approved
project11_id: pd78d61mhe253b6v3d17gnatcd80gyb1
tags: [ui, navigation, sidebar, git-status]
---

# PRD: Sidebar Navigation & Project List Redesign

## Problem Statement

Currently, ViboGit opens directly to a single project with no easy way to switch between multiple repositories. Users who work across several projects must close and reopen different folders, losing context and workflow efficiency. There's also no at-a-glance visibility into the git status of other projects - users can't see if other repos have uncommitted changes, unpushed commits, or need pulling without manually switching to each one.

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Faster project switching | Switch between projects in < 1 second (vs current ~3-5s) |
| Improved git awareness | Users can see status of all projects without switching |
| Reduced cognitive load | Single interface for multi-repo workflows |
| Feature parity with Conductor | Sidebar navigation matches expected UX patterns |

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US1 | Developer | See all my projects in a sidebar | I can quickly switch between them |
| US2 | Developer | See git status indicators per project | I know which repos need attention |
| US3 | Developer | Add new repositories easily | I can expand my workspace |
| US4 | Developer | Access settings from the sidebar | Navigation is consistent with other apps |
| US5 | Developer | See uncommitted changes count | I don't forget to commit work |
| US6 | Developer | See ahead/behind counts | I know when to push or pull |

## Requirements

### Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR1 | Must | Left sidebar (220px) with project list |
| FR2 | Must | Git status indicators per project (changes, ahead, behind) |
| FR3 | Must | Click project to switch (replace current view) |
| FR4 | Must | "Add repository" button at sidebar bottom |
| FR5 | Must | Settings access from sidebar bottom |
| FR6 | Should | Current branch shown subtly under project name |
| FR7 | Should | Tooltip on hover showing detailed status |
| FR8 | Should | Visual distinction for selected project |
| FR9 | Could | Collapsible sidebar for more screen space |
| FR10 | Could | Drag-to-reorder projects |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Status indicators update within 2 seconds of git changes |
| NFR2 | Sidebar renders in < 100ms |
| NFR3 | Project list supports 50+ repositories without lag |
| NFR4 | Persists project list across app restarts |

## Technical Considerations

### New Components Needed

```
src/components/
├── sidebar/
│   ├── sidebar.tsx           # Main sidebar container
│   ├── project-list.tsx      # Project list with status
│   ├── project-item.tsx      # Individual project row
│   ├── git-status-badge.tsx  # Status indicators
│   └── add-repository.tsx    # Add repo button/dialog
```

### State Management

- **Project List**: Store in localStorage/Tauri store for persistence
- **Git Status Per Project**: Poll or watch each repo for changes
- **Selected Project**: Context provider for active project

### Tauri Commands Needed

```rust
// New commands
#[tauri::command]
fn get_all_project_statuses(paths: Vec<String>) -> Vec<ProjectStatus>

#[tauri::command]
fn add_project(path: String) -> Result<Project>

#[tauri::command]
fn remove_project(path: String) -> Result<()>

#[tauri::command]
fn get_saved_projects() -> Vec<Project>
```

### Data Structures

```typescript
interface Project {
  path: string;
  name: string;
  addedAt: number;
}

interface ProjectStatus {
  path: string;
  currentBranch: string;
  uncommittedCount: number;  // staged + unstaged + untracked
  ahead: number;
  behind: number;
  isClean: boolean;
}
```

## ASCII UI Mockups

### Full Application Layout

```
+---------------------------+--------------------------------------------------+
|                           |                                                  |
|  ┌─────────────────────┐  |  vibogit                                         |
|  │      VIBOGIT        │  |  ────────────────────────────────────────────────|
|  └─────────────────────┘  |  [main ▼]           [Finder][Browser][GH][Term]  |
|                           +--------------------------------------------------+
|  PROJECTS                 |  [↓ Pull (1)] [↻] [↑ Push (2)] [✓ Commit] [PR]   |
|  ─────────────────────    +--------------------------------------------------+
|                           |                                                  |
|  ┌─────────────────────┐  |   [● Changes (3)]  [○ Tree]  [○ Graph]           |
|  │ ● vibogit       ↑2↓1│  |                                                  |
|  │   main              │  +--------------------------------------------------+
|  └─────────────────────┘  |                                                  |
|                           |   ┌─ Staged (2) ──────────────────────────────┐  |
|  ┌─────────────────────┐  |   │                                           │  |
|  │ ○ project-alpha  •3 │  |   │  M  src/components/main-interface.tsx     │  |
|  └─────────────────────┘  |   │  A  src/components/sidebar.tsx            │  |
|                           |   │                                           │  |
|  ┌─────────────────────┐  |   └───────────────────────────────────────────┘  |
|  │ ○ my-website     ↑5 │  |                                                  |
|  └─────────────────────┘  |   ┌─ Unstaged (1) ────────────────────────────┐  |
|                           |   │                                           │  |
|  ┌─────────────────────┐  |   │  M  package.json                          │  |
|  │ ○ api-server     ✓  │  |   │                                           │  |
|  └─────────────────────┘  |   └───────────────────────────────────────────┘  |
|                           |                                                  |
|                           |                                                  |
|                           |                                                  |
|                           +--------------------------------------------------+
+---------------------------+                                                  |
|                           |  ┌────────────────────────────────────────────┐  |
|  [+ Add repository]       |  │ Ask about this project... (@ for files)   │  |
|                           |  │                                    [Send] │  |
+---------------------------+  └────────────────────────────────────────────┘  |
|  [⚙]  [?]                 |                                                  |
+---------------------------+--------------------------------------------------+
```

### Project Item States

```
SELECTED PROJECT (active, with branch)
┌─────────────────────────────┐
│ ● vibogit              ↑2↓1 │  ← Filled dot = selected
│   main                      │  ← Current branch (muted)
└─────────────────────────────┘

UNSELECTED - HAS CHANGES
┌─────────────────────────────┐
│ ○ project-alpha         •3  │  ← Hollow dot, orange badge
└─────────────────────────────┘

UNSELECTED - NEEDS PUSH
┌─────────────────────────────┐
│ ○ my-website            ↑5  │  ← Blue up arrow
└─────────────────────────────┘

UNSELECTED - NEEDS PULL
┌─────────────────────────────┐
│ ○ api-backend           ↓3  │  ← Yellow down arrow
└─────────────────────────────┘

UNSELECTED - CLEAN
┌─────────────────────────────┐
│ ○ docs-site             ✓   │  ← Green checkmark
└─────────────────────────────┘

HOVER STATE (tooltip)
┌─────────────────────────────┐
│ ○ project-alpha         •3  │
└─────────────────────────────┘
       ┌──────────────────────┐
       │ 2 staged             │
       │ 1 unstaged           │
       │ Branch: feature/new  │
       └──────────────────────┘
```

### Add Repository Dialog

```
┌───────────────────────────────────────┐
│  Add Repository                    ✕  │
├───────────────────────────────────────┤
│                                       │
│  Choose a folder containing a git     │
│  repository to add to your projects.  │
│                                       │
│  ┌─────────────────────────────────┐  │
│  │ /Users/simon/projects           │  │
│  │                        [Browse] │  │
│  └─────────────────────────────────┘  │
│                                       │
│  Recent:                              │
│  • ~/projects/new-app                 │
│  • ~/work/client-portal               │
│                                       │
│         [Cancel]  [Add Repository]    │
└───────────────────────────────────────┘
```

### Sidebar Collapsed State (Future)

```
+-----+--------------------------------------------------+
|     |                                                  |
| [V] |  vibogit                                         |
|     |  ────────────────────────────────────────────────|
+-----+  [main ▼]           [Finder][Browser][GH][Term]  |
|     +--------------------------------------------------+
| [●] |                                                  |
| ↑2↓1|  ... main content ...                            |
|     |                                                  |
| [○] |                                                  |
|  •3 |                                                  |
|     |                                                  |
| [○] |                                                  |
|  ↑5 |                                                  |
|     |                                                  |
+-----+                                                  |
| [+] |                                                  |
+-----+                                                  |
| [⚙] |                                                  |
+-----+--------------------------------------------------+
```

## ASCII UX Journey Diagrams

### Adding a New Project

```
[Sidebar]           [Click "+ Add"]         [Dialog Opens]
    │                     │                      │
    v                     v                      v
┌───────┐           ┌───────────┐          ┌─────────────┐
│ Proj1 │  ──────>  │  + Add    │  ──────> │   Browse    │
│ Proj2 │           │  clicked  │          │   Dialog    │
└───────┘           └───────────┘          └─────────────┘
                                                 │
                    ┌────────────────────────────┘
                    v
              [Select Folder]
                    │
                    v
            ┌──────────────┐     ┌─────────────┐
            │ Valid git    │ ──> │ Add to list │ ──> [Project appears in sidebar]
            │ repository?  │     │ & select    │
            └──────────────┘     └─────────────┘
                    │
                    │ No
                    v
            ┌──────────────┐
            │ Show error:  │
            │ "Not a git   │
            │ repository"  │
            └──────────────┘
```

### Switching Projects

```
[Click Project]  -->  [Update Context]  -->  [Load Status]  -->  [Render Main]
       │                    │                     │                    │
       v                    v                     v                    v
  User clicks         DaemonContext          Fetch git            Update all
  project row         updates repoPath       status, branches     components
```

### Status Indicator Updates

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│ File saved  │ ──> │ Git detects  │ ──> │ Poll/Watch  │
│ in project  │     │ change       │     │ triggers    │
└─────────────┘     └──────────────┘     └─────────────┘
                                               │
                                               v
                                    ┌─────────────────┐
                                    │ Update sidebar  │
                                    │ badge for that  │
                                    │ project         │
                                    └─────────────────┘
```

## Design & UX Notes

### Colors & Visual Design

| Element | Style |
|---------|-------|
| Selected project | Subtle highlight background, filled dot |
| Unselected project | No background, hollow dot |
| Changes badge (•N) | Orange/amber |
| Ahead badge (↑N) | Blue |
| Behind badge (↓N) | Yellow |
| Clean badge (✓) | Green |
| Branch text | Muted/secondary color |

### Interactions

- **Single click**: Select project
- **Right click**: Context menu (Remove, Open in Finder, etc.)
- **Hover**: Show tooltip with detailed status
- **Drag** (future): Reorder projects

### Accessibility

- Keyboard navigation (arrow keys + enter)
- Screen reader labels for status indicators
- Focus indicators on interactive elements

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Polling many repos causes performance issues | High | Batch status checks, throttle to every 5s |
| Sidebar takes too much horizontal space | Medium | Make width adjustable, add collapse option |
| Status indicators confusing | Medium | Tooltips on hover, legend in settings |
| Migration from single-repo to multi-repo | Medium | Auto-add current repo on first launch |

## Launch Plan

### Phase 1: Core Sidebar (MVP)
- Sidebar component with project list
- Add/remove repositories
- Click to switch projects
- Persist project list

### Phase 2: Git Status Indicators
- Status badges per project
- Background polling for updates
- Tooltips with details

### Phase 3: Polish & Enhancements
- Collapsible sidebar
- Drag to reorder
- Right-click context menu
- Keyboard navigation

## Open Questions

1. Should we support "workspaces" (groups of projects) in the future?
2. What's the maximum number of projects we should support?
3. Should removed projects be recoverable (trash/undo)?
4. Should we show notifications when a project's status changes?
