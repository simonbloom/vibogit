---
title: "Git Graph Visualization Rebuild"
created: 2026-02-04
status: approved
project11_id: pd79vbta4khdb67qr5zrxwexz980hvx7
tags: [frontend, git-graph, visualization, performance]
---

# PRD: Git Graph Visualization Rebuild

## Problem Statement

The current git graph in ViboGit is broken. The `buildGraph()` lane assignment algorithm in `commit-history.tsx` has fundamental flaws:

1. **Merge edges cross over other branches/commits** - No forbidden-column detection; columns are reused naively causing visual overlaps
2. **Branch color is tied to column index, not branch identity** - When a branch shifts columns, its color changes, making it impossible to visually track a branch
3. **Bezier curves add complexity with no payoff** - The S-curves in `bezier.ts` produce confusing paths for merges; straight lines + right angles are cleaner
4. **No virtualization** - All rows render in the DOM simultaneously
5. **Column compaction is broken** - `columns[nodeCol] = null` frees slots but reusing them creates crossed edges

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Visually correct graph with no crossing edges | Zero overlap/crossing bugs on repos with up to 20 active branches |
| Each branch has a stable, distinct color | Same branch = same color from first commit to last |
| Smooth scrolling at 500 commits | 60fps scroll, < 16ms per frame |
| Clean right-angle line routing | No bezier curves; only vertical lines + L-shaped corners with small radius |

## User Stories

- **US1**: As a developer, I want to see a clean graph where each branch is a distinct color so I can visually follow branch history.
- **US2**: As a developer, I want merge lines to route cleanly without crossing other branches so the graph is readable.
- **US3**: As a developer, I want to hover over a commit node and see details (author, date, full message, refs).
- **US4**: As a developer, I want to right-click a commit to copy SHA, checkout, cherry-pick, or revert.
- **US5**: As a developer, I want the graph to load quickly even with 500 commits.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| FR1 | Implement proper lane assignment algorithm with forbidden-column detection (based on gitamine's straight-branches algorithm) | Must Have |
| FR2 | Assign colors per branch identity (first-parent chain), not per column index | Must Have |
| FR3 | Draw edges as vertical lines + L-shaped right-angle corners (no bezier curves) | Must Have |
| FR4 | Render commit nodes: regular (filled circle), HEAD (ring + glow), merge (double circle) | Must Have |
| FR5 | Show branch/tag ref badges on commit rows | Must Have |
| FR6 | Virtualized rendering: only render visible rows + buffer | Must Have |
| FR7 | Tooltip on hover with commit details | Should Have |
| FR8 | Right-click context menu (copy SHA, checkout, cherry-pick, revert) | Should Have |
| FR9 | Branch highlight on hover (dim other branches) | Should Have |
| FR10 | Compact and expanded view modes | Nice to Have |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | 60fps scrolling with 500 commits |
| NFR2 | Graph layout computation < 50ms for 500 commits |
| NFR3 | 8 distinct branch colors that cycle, high contrast on dark background |

## Technical Design

### Algorithm: Straight-Branch Lane Assignment

Based on the gitamine algorithm by Pierre Vigier, adapted for our use case:

```
1. Topological sort commits (already sorted by daemon via git log)
2. Maintain active_lanes[] array
3. For each commit c:
   a. Compute forbidden columns J(c) = columns occupied between
      c and any merge-child that would cause edge crossing
   b. If c has a branch-child d whose lane is not in J(c):
      - c takes d's lane (straight continuation)
   c. Otherwise, append c to a new lane
   d. Free lanes of other branch-children (set to nil, don't remove)
   e. Record: c.lane, edges to parents (vertical or L-shaped)
```

Key difference from current code: lanes are never removed/shifted, only set to nil. This guarantees branches stay in the same column.

### Branch Color Assignment

```
- Track branch identity via first-parent chain
- When a commit is the first parent of its child, it inherits the child's color
- When a commit starts a new branch (second+ parent), assign next color from palette
- Color palette: 8 high-contrast colors cycling
```

### Edge Drawing (Right-Angle Only)

Three edge types, all using straight lines with small rounded corners:

```
1. VERTICAL: Same column parent -> child
   Path: M x,y1 L x,y2

2. MERGE-IN: Branch column merges into node column
   Goes vertical down from source column, then right-angle turn horizontal to target
   Path: M x1,y1 L x1,(y2-r) Q x1,y2 (x1+dir*r),y2 L x2,y2

3. BRANCH-OUT: Node column spawns branch to new column
   Goes horizontal from source, then right-angle turn vertical down
   Path: M x1,y1 L (x2-dir*r),y1 Q x2,y1 x2,(y1+r) L x2,y2

Where r = corner radius (4-6px), dir = direction sign (+1 or -1)
```

### Virtualized Rendering

```
- Only render rows visible in viewport + 10-row buffer above/below
- Use absolute positioning with transform for each row
- Track scroll position to determine visible range
- Total height = totalCommits * ROW_HEIGHT (set on container)
```

## ASCII UI Mockup

```
+----------------------------------------------------------+
| [Branches (3/5) v]                          [Compact|Exp] |
+----------------------------------------------------------+
|  GRAPH        | Message              | SHA   | Author | T |
+----------------------------------------------------------+
|  o---------+  | Merge feature/auth   | a3f2c | Simon  | 2h|
|  |         |  |                      |       |        |   |
|  |         o  | Add login validation | 8b1d4 | Alice  | 3h|
|  |         |  |                      |       |        |   |
|  o         |  | Fix typo in readme   | c9e7f | Simon  | 4h|
|  |         |  |                      |       |        |   |
|  |         o  | Create auth module   | 1d5a2 | Alice  | 5h|
|  |         |  |                      |       |        |   |
|  o---------+  | Start feature branch | f4b8e | Simon  | 6h|
|  |            |                      |       |        |   |
|  o            | Initial commit       | 0a1b2 | Simon  | 1d|
+----------------------------------------------------------+

Branch colors (8-color palette, high contrast on dark bg):
  Blue (#3b82f6)    Green (#22c55e)    Amber (#f59e0b)    Red (#ef4444)
  Purple (#8b5cf6)  Pink (#ec4899)     Cyan (#06b6d4)     Teal (#14b8a6)
```

## ASCII UX Journey

```
[Open Repo] --> [Graph Tab] --> [See commit graph with colored branches]
                    |
                    |-- [Hover node] --> [Tooltip: SHA, author, date, message]
                    |-- [Right-click node] --> [Context menu: Copy SHA, Checkout, etc]
                    |-- [Hover branch line] --> [Highlight branch, dim others]
                    |-- [Scroll] --> [Virtualized: smooth 60fps]
                    +-- [Click Branches filter] --> [Toggle branch visibility]
```

## Files Affected

| File | Change |
|------|--------|
| `frontend/src/components/commit-history.tsx` | **Rewrite** buildGraph algorithm, virtualized rendering |
| `frontend/src/components/graph/GraphLine.tsx` | **Rewrite** to right-angle paths only |
| `frontend/src/components/graph/utils/bezier.ts` | **Delete** (replaced by right-angle utilities) |
| `frontend/src/components/graph/utils/edges.ts` | **New** right-angle edge path utilities |
| `frontend/src/components/graph/utils/colors.ts` | **Modify** for branch-identity coloring |
| `frontend/src/components/graph/GraphNode.tsx` | **Minor** adjustments |
| `frontend/src/components/graph/GraphTooltip.tsx` | **Keep** mostly as-is |
| `frontend/src/components/graph/GraphContextMenu.tsx` | **Keep** mostly as-is |
| `frontend/src/components/graph/BranchFilter.tsx` | **Keep** mostly as-is |
| `frontend/src/components/graph/index.ts` | **Update** exports |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Lane algorithm doesn't handle edge cases (octopus merges, etc.) | Test against repos with heavy merging patterns |
| Performance with 500 commits | Virtualization + memoized SVG rows |
| Color cycling makes adjacent branches same color | 8 colors with max-distance assignment between adjacent lanes |

## Launch Plan

| Phase | Scope | Estimate |
|-------|-------|----------|
| 1 | Core algorithm: lane assignment + right-angle edges + branch colors | 8 pts |
| 2 | Virtualized rendering + performance | 5 pts |
| 3 | Tooltip, context menu, branch highlight, filter | 3 pts |
| 4 | View modes (compact/expanded), polish | 2 pts |

**Total: 18 story points**

## Open Questions

1. Should we add "load more" pagination beyond 500 commits, or hard cap?
2. Should `git log --all` be added as future work for cross-branch visualization?
