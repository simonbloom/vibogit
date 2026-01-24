---
title: "Git Graph Panel Visual Enhancement"
created: 2026-01-24
status: approved
project11_id: pd7df3yn73nm84fpzjadvdv2fs7zvymx
tags: [ui, graph, visualization, gitgraph]
---

# PRD: Git Graph Panel Visual Enhancement

## Problem Statement

The current ViboGit commit graph uses basic SVG lines and simple bezier curves that lack the visual polish and interactivity of industry-standard Git visualization tools like GitKraken. Users expect a beautiful, intuitive graph that makes understanding branch topology effortless and enjoyable.

**Current Issues:**
- Straight vertical lines lack visual elegance
- Sharp, uniform bezier curves for merge/branch points
- No smooth "railroad track" aesthetic
- Missing hover states and interactive feedback
- No branch filtering or visibility controls
- Limited visual distinction between branch types

---

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Beautiful visualization | Smooth bezier curves with rounded transitions at all junction points |
| GitKraken-like aesthetics | Color-coded branches with glow effects and consistent styling |
| Improved interactivity | Hover states, tooltips, and click actions on all graph elements |
| Branch management | Filter/show/hide branches with smooth animations |
| Performance | Render 50 commits with <100ms paint time |

---

## User Stories

1. **As a developer**, I want to see a beautiful railroad-style commit graph so I can quickly understand branch topology
2. **As a developer**, I want to hover over commits to see details without clicking
3. **As a developer**, I want to click on a branch to checkout or see options
4. **As a developer**, I want to filter branches to focus on specific work
5. **As a developer**, I want visual distinction between local/remote branches and tags

---

## Functional Requirements

### P0 - Must Have
| ID | Requirement |
|----|-------------|
| F1 | Smooth cubic bezier curves for all branch/merge lines |
| F2 | Rounded corners where vertical lines meet horizontal curves |
| F3 | Color-coded branches with consistent palette (8 distinct colors) |
| F4 | Commit node styling: filled circles with subtle glow/shadow |
| F5 | HEAD commit highlighted with special styling (ring/pulse) |
| F6 | Hover state on commits showing tooltip with full details |
| F7 | Hover state on branch lines highlighting the entire branch path |

### P1 - Should Have
| ID | Requirement |
|----|-------------|
| F8 | Click on commit node to select (highlight related info) |
| F9 | Right-click context menu on commits (copy SHA, view diff, checkout) |
| F10 | Branch labels positioned inline on the graph |
| F11 | Tag indicators with distinct styling |
| F12 | Merge commit nodes styled differently (double circle) |

### P2 - Nice to Have
| ID | Requirement |
|----|-------------|
| F13 | Branch filter dropdown to show/hide specific branches |
| F14 | Animated transitions when filtering |
| F15 | Compact/expanded view toggle |
| F16 | Dark/light theme-aware colors |

---

## ASCII UI Mockups

### Current State (Before)
```
+----------------------------------------------------------+
|  Graph    |  Message           |  Author    |  Date      |
+----------------------------------------------------------+
|    |      |                    |            |            |
|    o------| Fix login bug      | john       | 2h ago     |
|    |      |                    |            |            |
|    o------| Add feature X      | jane       | 5h ago     |
|    |\     |                    |            |            |
|    | o----| Branch work        | john       | 1d ago     |
|    |/     |                    |            |            |
|    o------| Initial commit     | jane       | 2d ago     |
+----------------------------------------------------------+
```

### Proposed State (After - GitKraken Style)
```
+----------------------------------------------------------+
| [Filter Branches v]                    [Compact] [Expand] |
+----------------------------------------------------------+
|  Graph         |  Message           | Author  |  Date    |
+----------------------------------------------------------+
|                |                    |         |          |
|    ●━━━━━━━━━━━| Fix login bug      | john    | 2h ago   |
|    ┃  [main]   |   (hover: tooltip) |         |          |
|    ┃           |                    |         |          |
|    ◉━━━━━━━━━━━| Merge feature X    | jane    | 5h ago   |
|    ┃╲          |   ◉ = merge commit |         |          |
|    ┃ ╲         |                    |         |          |
|    ┃  ●━━━━━━━━| Add tests          | john    | 1d ago   |
|    ┃  ┃[feat]  |                    |         |          |
|    ┃  ●━━━━━━━━| Feature work       | john    | 1d ago   |
|    ┃ ╱         |                    |         |          |
|    ┃╱          |                    |         |          |
|    ●━━━━━━━━━━━| Initial commit     | jane    | 2d ago   |
|                |   🏷️ v1.0.0        |         |          |
+----------------------------------------------------------+

Legend:
  ●  = Regular commit (filled, with subtle glow)
  ◉  = Merge commit (double ring)
  ━  = Branch line (smooth, 2-3px)
  ╲╱ = Bezier curves (smooth S-curves)
  [] = Branch label (inline, color-coded)
```

### Commit Node Styles
```
  Regular Commit       HEAD Commit        Merge Commit
  
      ╭───╮              ╭───╮              ╭───╮
      │ ● │              │ ◉ │ <-- ring     │ ◎ │
      ╰───╯              ╰───╯              ╰───╯
   fill: branch       fill: accent       fill: branch
   color              + white ring       double circle
   r: 5px             r: 6px + 2px       r: 5px outer
                      outer ring         r: 3px inner
```

### Bezier Curve Detail (Branch/Merge Points)
```
  Branch Out (Smooth S-Curve)      Merge In (Smooth S-Curve)
  
       ┃                                 ┃     ┃
       ┃                                 ┃     ┃
       ●╲                                ╲     ┃
       ┃ ╲                                ╲   ╱
       ┃  ╲                                ╲ ╱
       ┃   ●                                ●
       ┃   ┃                                ┃
       
  Control points:                Control points:
  cx1 = 10% start + 90% end     Mirrored for merge
  cy1 = 60% start + 40% end     direction
  cx2 = 3% start + 97% end
  cy2 = 40% start + 60% end
```

---

## ASCII UX Journey

### Hover Interaction Flow
```
[View Graph] --> [Hover Commit Node] --> [Show Tooltip]
                        |                     |
                        |               +------------------+
                        |               | SHA: abc123...   |
                        |               | Author: John Doe |
                        |               | Date: 2h ago     |
                        |               | Full message...  |
                        v               +------------------+
                 [Hover Branch Line]
                        |
                        v
                 [Highlight Full Branch Path]
                 (increase opacity, add glow)
```

### Context Menu Flow
```
[Right-Click Commit] --> [Show Context Menu]
                               |
                    +----------+-----------+
                    |                      |
              [Copy SHA]            [Checkout]
                    |                      |
              [Copied!]            [Branch switched]
                    
                    
[Right-Click Branch Label] --> [Show Branch Menu]
                                      |
                         +------------+------------+
                         |            |            |
                   [Checkout]    [Delete]    [Rename]
```

### Branch Filter Flow
```
[Click Filter Dropdown] --> [Show Branch List]
                                   |
                    +-----------------------------+
                    | [x] main                    |
                    | [x] feature/login           |
                    | [ ] bugfix/issue-123        |
                    | [ ] origin/develop          |
                    +-----------------------------+
                                   |
                                   v
                    [Toggle Checkbox] --> [Animate Graph]
                                          (fade out/in branches)
```

---

## Technical Considerations

### SVG Path Generation
```typescript
// Smooth bezier curve function (DoltHub-inspired)
function curvePath(start: [number, number], end: [number, number]): string {
  const cx1 = start[0] * 0.1 + end[0] * 0.9;
  const cy1 = start[1] * 0.6 + end[1] * 0.4;
  const cx2 = start[0] * 0.03 + end[0] * 0.97;
  const cy2 = start[1] * 0.4 + end[1] * 0.6;
  
  return `M ${start[0]} ${start[1]} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end[0]} ${end[1]}`;
}
```

### Dependencies
- No new dependencies required (pure SVG + React)
- Consider `framer-motion` for animations (already may be in project)

### Files to Modify
- `apps/web/src/components/commit-history.tsx` - Main refactor
- `apps/web/src/components/commit-graph.tsx` - May consolidate
- New: `apps/web/src/components/graph/` directory structure:
  - `GraphNode.tsx` - Commit node component
  - `GraphLine.tsx` - Branch line component  
  - `GraphTooltip.tsx` - Hover tooltip
  - `GraphContextMenu.tsx` - Right-click menu
  - `BranchFilter.tsx` - Filter dropdown
  - `utils/bezier.ts` - Curve calculations
  - `utils/colors.ts` - Color palette management

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Performance with complex graphs | Medium | Use React.memo, virtualize if needed |
| SVG rendering differences across browsers | Low | Test on Chrome, Firefox, Safari |
| Color accessibility | Medium | Ensure 4.5:1 contrast ratio, use patterns as backup |
| Touch device interactions | Low | Ensure tap works for hover states |

---

## Launch Plan

1. **Phase 1**: Core visual improvements (F1-F7) - Bezier curves, colors, hover states
2. **Phase 2**: Interactivity (F8-F12) - Click actions, context menus, labels
3. **Phase 3**: Advanced features (F13-F16) - Filtering, animations, themes

---

## Open Questions

1. Should we add keyboard navigation for accessibility?
2. Do we want to persist branch filter preferences?
3. Should commits link to external diff views or show inline?
