---
title: "Git Graph Responsive Layout & Extended Branch Lines"
created: 2026-02-06
status: approved
project11_id: pd77mn4ep4vgx3635wxyb9wq8h80nk8t
tags: [graph, ui, layout, desktop]
---

# PRD: Git Graph Responsive Layout & Extended Branch Lines

## Problem Statement

The ViboGit desktop app's git graph view has two layout issues that degrade usability:

1. **Commit messages are hard-truncated at 60 characters** via JavaScript slicing (`message.slice(0, 60) + "..."`), even though the commit details column has ample horizontal space. Users cannot read full commit messages without hovering over the title attribute.

2. **The graph's branch lines stop at the last commit row** instead of extending to the bottom of the visible pane. When a repo has few commits (or the window is tall), there is a large empty gap below the graph that makes it look broken or incomplete.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Commit messages use full available width | Message text fills `flex-1` column, truncated only by CSS `text-overflow: ellipsis` at container edge |
| Full message viewable on interaction | Clicking or hovering a row reveals the complete commit message |
| Graph lines extend to bottom of pane | Main branch vertical line reaches the bottom of the scroll container, even past the last commit |
| No layout breakage | Row height stays fixed at 44px (expanded) / 32px (compact) for virtualization; no jank on scroll |

## User Stories

1. **As a developer**, I want to read as much of the commit message as fits on screen, so I can quickly understand what each commit does without extra interaction.
2. **As a developer**, I want to click/hover a commit to see its full message, so I can read long or multi-line commit messages.
3. **As a developer**, I want the graph lines to extend to the bottom of the window, so the graph looks complete and polished.

## Requirements

### Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-1 | Must Have | Remove JS `messageMaxLength` truncation; let CSS `truncate` (text-overflow: ellipsis) handle overflow responsively |
| FR-2 | Must Have | On click/hover of a commit row, expand to show the full first-line commit message (not multi-line body) |
| FR-3 | Must Have | Expanded message must not break virtualization -- use an overlay/tooltip/popover, not dynamic row height |
| FR-4 | Must Have | Extend the primary branch's vertical line from the last commit node to the bottom of the visible container |
| FR-5 | Should Have | All active lanes (not just primary) extend their vertical lines to the container bottom |
| FR-6 | Should Have | Ref badges (branch/tag labels) stay right-aligned and do not compete with message text |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR-1 | Scroll performance: no measurable FPS drop (virtualization must remain intact) |
| NFR-2 | Works in both desktop (Tauri) and web (daemon) modes |
| NFR-3 | Works in both expanded and compact view modes |

## Technical Considerations

### Current Architecture
- `packages/ui/src/components/commit-history.tsx` -- main graph component with virtualization
- `packages/ui/src/components/graph/ViewModeToggle.tsx` -- defines `VIEW_MODE_CONFIG` with `messageMaxLength`
- Row height is fixed (44px expanded, 32px compact) for virtualization math
- Graph uses `position: absolute` rows inside a container with `height: totalHeight`

### Approach: Message Display (FR-1, FR-2, FR-3)

**Current code (CommitRow, line ~627):**
```tsx
<p className="font-medium truncate" style={{ fontSize }} title={commit.message}>
  {commit.message.length > messageMaxLength
    ? commit.message.slice(0, messageMaxLength) + "..."
    : commit.message}
</p>
```

**New approach:**
- Remove the JS slice; render `commit.message` directly
- Keep CSS `truncate` class (already applied) for responsive ellipsis
- On row hover or click, show the full message in a positioned overlay/tooltip below the row
- The overlay is absolutely positioned relative to the scroll container, so it doesn't affect row heights or virtualization

### Approach: Extended Branch Lines (FR-4, FR-5)

**Current behavior:** `totalHeight = graphRows.length * ROW_HEIGHT` -- the inner div ends exactly at the last commit row.

**New approach:**
- Calculate `extendedHeight = Math.max(totalHeight, containerHeight)` so the inner div always fills the visible area
- After rendering visible commit rows, render an additional SVG (or extend the last row's SVG) that draws vertical continuation lines for all active lanes from the last commit row down to `extendedHeight`
- The continuation lines use the same color as each lane's last active commit

### ASCII UI Mockup -- Current vs. Proposed

**Current (truncated messages, short graph):**
```
+--[ Graph ]----------------------------------------------+
|  ●  fix: use topological sorting and walk...  main      |
|  |                                                       |
|  ●  docs: add critical DMG build instruct...            |
|  |                                                       |
|  ●  fix: graph cutoff - remove duplicate s...           |
|  |                                                       |
|  ●  fix: git graph broken in desktop app -...           |
|  |                                                       |
|     <--- empty space, no line --->                       |
|                                                          |
|                                                          |
+----------------------------------------------------------+
```

**Proposed (full-width messages, extended line):**
```
+--[ Graph ]----------------------------------------------+
|  ●  fix: use topological sorting and walk all bra  main |
|  |                                                       |
|  ●  docs: add critical DMG build instructions to AGE... |
|  |                                                       |
|  ●  fix: graph cutoff - remove duplicate scroll cont... |
|  |                                                       |
|  ●  fix: git graph broken in desktop app - parent ha... |
|  |                                                       |
|  |  <--- line continues to bottom --->                   |
|  |                                                       |
|  |                                                       |
+----------------------------------------------------------+
```

**Proposed (hover/click expanded message):**
```
+--[ Graph ]----------------------------------------------+
|  ●  fix: use topological sorting and walk all bra  main |
|  |  +------------------------------------------------+  |
|  |  | fix: use topological sorting and walk all      |  |
|  |  | branches in Rust revwalk                        |  |
|  |  +------------------------------------------------+  |
|  ●  docs: add critical DMG build instructions to AGE... |
|  |                                                       |
+----------------------------------------------------------+
```

## ASCII UX Journey

```
[User opens Graph tab]
    |
    v
[Sees commit list with full-width messages, CSS ellipsis]
    |
    +---> [Hovers a row] --> [Full message popover appears]
    |                               |
    |                          [Mouse leaves] --> [Popover hides]
    |
    +---> [Scrolls down] --> [Branch lines extend to bottom]
    |
    +---> [Few commits in repo] --> [Lines still reach pane bottom]
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Overlay popover might overlap other rows or go off-screen | Use `z-50` positioning, clamp to container bounds |
| Extended lines cause scroll jank with many commits | Lines only render for the visible viewport region via virtualization |
| Removing `messageMaxLength` could cause layout shift with very long messages | CSS `truncate` + `min-w-0` on flex child prevents this |

## Files Affected

| File | Change |
|------|--------|
| `packages/ui/src/components/commit-history.tsx` | Remove JS message truncation, add message popover, extend totalHeight, render continuation lines |
| `packages/ui/src/components/graph/ViewModeToggle.tsx` | Remove `messageMaxLength` from config (or keep for backward compat but unused) |

## Open Questions

1. Should the extended lines have a fade/gradient at the bottom, or stay solid?
2. Should the message popover also show the commit body (multi-line), or just the full first line?
