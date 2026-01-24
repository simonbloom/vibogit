---
title: "File Tree Viewer Enhancements"
created: 2026-01-24
status: approved
project11_id: pd76yjnxf0mg9swx2mk6qsb36s7zt44h
tags: [file-tree, code-viewer, ux, settings]
---

# PRD: File Tree Viewer Enhancements

## Problem Statement

Vibe coders using ViboGit need a quick, elegant way to browse and view code files without leaving the app. Currently, clicking files in the Tree view does nothing, and there's no way to see hidden files (like `.gitignore`, `.env.example`). Users must context-switch to their IDE just to peek at a file.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Reduce context switching | Users can view code without opening IDE |
| Improve file discovery | Hidden files visible with one toggle |
| Maintain simplicity | Code viewer is read-only, not an editor |

## User Stories

1. As a vibe coder, I want to toggle hidden files visibility so I can see dotfiles like `.gitignore`
2. As a vibe coder, I want to click a file and see its contents with syntax highlighting
3. As a vibe coder, I want to quickly open a file in my IDE by hovering and clicking an icon

## ASCII UI Mockups

### Current Tree View

```
+------------------------------------------+
| [Graph] [Tree] [Changes]                 |
+------------------------------------------+
| apps                                     |
| docs                                     |
| packages                                 |
| package.json                             |
| turbo.json                               |
+------------------------------------------+
```

### Enhanced Tree View (with code panel)

```
+------------------------------------------------------------------+
| [Graph] [Tree] [Changes]               [Show Hidden Files] toggle |
+---------------------------+--------------------------------------+
| > apps/                   |  package.json                   [IDE]|
| > docs/                   +--------------------------------------+
| v packages/               |  1 | {                                |
|   > shared/               |  2 |   "name": "@vibogit/web",        |
| .gitignore          [IDE] |  3 |   "version": "0.0.1",            |
| .env.example        [IDE] |  4 |   "private": true,               |
| package.json  <-selected  |  5 |   "scripts": {                   |
| turbo.json          [IDE] |  6 |     "dev": "next dev",           |
+---------------------------+--------------------------------------+
   File Tree (40%)                 Code View (60%)
```

### File Hover State

```
+---------------------------+
| package.json        [IDE] |  <-- IDE icon appears on hover
+---------------------------+
```

## ASCII UX Journey

```
[Tree Tab] ---> [Toggle Hidden Files] ---> [Files Update]
     |
     v
[Click File] ---> [Code Panel Opens] ---> [View Highlighted Code]
     |                    |
     v                    v
[Hover File] ---> [IDE Icon Appears] ---> [Click] ---> [Opens in IDE]
```

## Requirements

### Functional Requirements

| Priority | Requirement |
|----------|-------------|
| Must Have | Toggle to show/hide hidden files (dotfiles) |
| Must Have | Click file to display code in right panel |
| Must Have | Syntax highlighting for common languages |
| Must Have | Line numbers in code view |
| Must Have | IDE icon on file hover (uses existing editor setting) |
| Should Have | Persist "show hidden files" setting |
| Should Have | Copy code button in code panel |

### Non-Functional Requirements

- Code panel should render < 200ms for files under 1MB
- Support at least: JS, TS, JSON, CSS, HTML, Markdown, Python, Rust
- Graceful degradation for binary/unsupported files

## Technical Considerations

### Dependencies

- Add `shiki` for syntax highlighting (lightweight, Next.js compatible)
- Existing daemon already has file reading capability

### Files to Modify

| File | Changes |
|------|---------|
| `apps/web/src/components/file-tree.tsx` | Add hidden files toggle, click handler, hover state |
| `apps/web/src/components/code-viewer.tsx` | NEW: Read-only code display with highlighting |
| `apps/web/src/lib/settings.ts` | Add `showHiddenFiles: boolean` setting |
| `apps/daemon/` | May need endpoint to read file contents |

### Component Structure

```
FileTree (enhanced)
  ├── HiddenFilesToggle
  ├── FileTreeNode (updated with hover state)
  └── CodeViewer (new sibling panel)
       ├── CodeHeader (filename + copy + IDE button)
       └── HighlightedCode (shiki-rendered)
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Large files slow UI | Truncate display at 10k lines with "View in IDE" prompt |
| Binary files cause errors | Detect binary, show placeholder message |
| Shiki bundle size | Use dynamic import, only load on first file click |

## Open Questions

1. Should we support file search/filter in the tree view? (defer to future)
2. Should clicking a directory in code view show a file listing? (suggest: no, keep simple)
