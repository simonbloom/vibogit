---
title: "ViboGit UI Enhancements v1.1"
created: 2026-01-23
status: approved
project11_id: pd79cezbvnktpb3rrbhehm04vn7zsp68
tags: [ui, ux, changes-tab, file-viewer]
---

# PRD: ViboGit UI Enhancements v1.1

## Problem Statement
ViboGit's Changes tab needs refinement to complete the commit workflow, and the interface lacks key features for a productive git experience: file viewing, visual status indicators, project persistence, and dev server visibility.

## Goals & Success Metrics
- Users can commit selected files directly from Changes tab
- File contents viewable with syntax highlighting and diffs
- Visual distinction between file states at a glance
- Projects persist across browser sessions
- Dev server ports visible and clickable

## User Stories
1. As a user, I want to commit files directly from the "Will Commit" card
2. As a user, I want to view file contents and diffs before committing
3. As a user, I want to see uncommitted files in a different color
4. As a user, I want my open projects remembered when I return
5. As a user, I want to see running dev server ports and open them in browser

## Requirements

### R1: Commit from Changes Tab (High Priority)
- Add commit message input + button to the "Will Commit" card
- Commit only stages files in the "Will Commit" selection
- AI commit message button available
- Commit button enabled when 1+ files selected AND message entered

### R2: File Viewer Panel (High Priority)
- Click file in Changes tab to view contents
- Syntax highlighting based on file extension
- Diff view showing changes (red/green highlighting)
- Split view: file list on left, viewer on right

### R3: Uncommitted File Colors (Medium Priority)
- Modified files: yellow/amber text
- New/untracked files: green text
- Deleted files: red text with strikethrough

### R4: Project Persistence (Medium Priority)
- Store open projects in localStorage
- Restore tabs on page load
- Remember last active tab
- Limit to 20 most recent projects

### R5: Dev Server Port Display (Medium Priority)
- Show port number next to running server status
- Port number is clickable → opens `localhost:{port}` in new tab
- Display in header or dedicated section

## ASCII UI Mockups

### Changes Tab with Commit & File Viewer
```
+------------------------------------------------------------------+
| Changes (5)                                                       |
+------------------------------------------------------------------+
|                                                                   |
| +-- Will Commit (3) ----------------+  +-- File Viewer ----------+|
| | [Stage All]                       |  | src/app/page.tsx        ||
| | +---------------------------------+  | -----------------------||
| | | ↓ | M | src/app/page.tsx    |  |  |  1  import React...     ||
| | | ↓ | A | src/new-file.ts     |  |  | -2  const old = ...     ||
| | | ↓ | M | src/utils.ts        |  |  | +2  const new = ...     ||
| | +---------------------------------+  |  3  export default...   ||
| |                                   |  |                         ||
| | [____Commit message...________]   |  |                         ||
| | [AI] [Commit]                     |  |                         ||
| +-----------------------------------+  +-------------------------+|
|                                                                   |
| +-- Won't Commit (2) ---------------+                             |
| | | ↑ | M | package-lock.json   |  |                             |
| | | ↑ | ? | .env.local          |  |                             |
| +-----------------------------------+                             |
+------------------------------------------------------------------+
```

### Header with Port Display
```
+------------------------------------------------------------------+
| ViboGit    [Project11] [Meredith] [vibogit]    ● Connected :3000 |
+------------------------------------------------------------------+
                                                  ↑ clickable
```

## Technical Considerations
- File viewer: Use Monaco Editor or simple `<pre>` with highlight.js
- Diff: Request diff from daemon, parse unified diff format
- localStorage: Use `vibogit-projects` key, JSON array of paths
- Port display: Track from dev server panel state

## Risks & Mitigations
- Large files in viewer: Limit to 1MB, show warning
- localStorage quota: Limit to 20 projects, FIFO eviction
