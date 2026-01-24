---
title: "ViboGit Theme System Implementation"
created: 2026-01-24
status: approved
project11_id: pd74kdxac1m0q6m44860y2xysd7zve93
tags: [theme, css, next-themes, matrix]
source_prds:
  - "Theme System PRD - Part 1: Overview"
  - "Theme System PRD - Part 2: CSS Theme Variables"
  - "Theme System PRD - Part 3: Base Styles & Matrix Overrides"
  - "Theme System PRD - Part 4: Scrollbars & Effects"
  - "Theme System PRD - Part 5: Config & Integration"
---

# PRD: ViboGit Theme System Implementation

**Created:** 2026-01-24  
**Status:** Approved  
**Project:** ViboGit

> **IMPORTANT:** This PRD is an implementation roadmap. The actual code and implementation details are in the 5-part "Theme System PRD" series in the Project11 Coding board. Each ticket should reference the specific part containing the code.

---

## Problem Statement

ViboGit currently has a single light theme with basic styling. Users expect modern apps to support theme preferences, and the Project11 theme system provides a polished four-theme experience (Light, Dark, Ember, Matrix) with special effects that would enhance the developer experience.

---

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Theme persistence | Theme choice persists across sessions via localStorage |
| All 4 themes functional | Light, Dark, Ember, Matrix all render correctly |
| Matrix effects working | Digital rain + CRT overlay animate (respects reduced motion) |
| Theme toggle accessible | Toggle in settings panel with keyboard support |
| No performance regression | Page load < 200ms additional overhead |

---

## Source PRD References

| Part | Content | PRD ID |
|------|---------|--------|
| Part 1 | Overview, file structure, color hex values | pd797pz13k7xazdd451ym1bea57zv60d |
| Part 2 | CSS theme variables (all 4 themes) | pd759qxaa08ra3fw1tnwxn3de57ztmg9 |
| Part 3 | Base styles, Matrix overrides, form styling | pd70bxwwyae1ymh96khs4rnaxs7zvc71 |
| Part 4 | Scrollbars, MatrixRain, CRTOverlay, video filters | pd73zd3ewess9t37j8xp07s0kh7ztbsh |
| Part 5 | tailwind.config, ThemeProvider, ThemeToggle, fonts | pd7andbsdj3zx68kky5a4zan2n7ztx15 |

---

## Requirements

### Must Have
1. Install dependencies: `next-themes`, `tailwind-merge`, `@radix-ui/react-toggle-group`
2. Bundle Overpass, Overpass Mono, VT323 fonts locally in `/public/fonts/`
3. Replace `globals.css` with full theme variable system (4 themes) - **See Part 2-3**
4. Create `ThemeProvider` wrapper component - **See Part 5**
5. Create `ThemeToggle` component in settings panel - **See Part 5**
6. Create Matrix effects: `MatrixRain.tsx`, `CRTOverlay.tsx` - **See Part 4**
7. Update `layout.tsx` with ThemeProvider and effects - **See Part 5**
8. Default theme: `light`

### Should Have
1. Video filter SVG components for themed media - **See Part 4**
2. Theme-specific scrollbar styling - **See Part 4**
3. Z-index layer system for consistent stacking - **See Part 2**

---

## Technical Approach

### File Changes

| File | Action | Source |
|------|--------|--------|
| `package.json` | Add next-themes, tailwind-merge, @radix-ui/react-toggle-group | Part 1 |
| `public/fonts/` | Add Overpass, VT323 font files (woff2) | Part 1 |
| `src/fonts/*.css` | Create font-face declarations | Part 5 |
| `src/app/globals.css` | Replace with full theme CSS | Parts 2-3 |
| `tailwind.config.ts` | Extend with semantic colors and fonts | Part 5 |
| `src/providers/ThemeProvider.tsx` | Create next-themes wrapper | Part 5 |
| `src/components/ui/toggle-group.tsx` | Create Radix toggle-group component | New |
| `src/components/effects/MatrixRain.tsx` | Digital rain canvas effect | Part 4 |
| `src/components/effects/CRTOverlay.tsx` | Scanlines + flicker overlay | Part 4 |
| `src/components/effects/index.ts` | Barrel export | Part 1 |
| `src/components/ui/video-filters.tsx` | SVG video filters | Part 4 |
| `src/components/settings/ThemeToggle.tsx` | Theme selection UI | Part 5 |
| `src/components/settings-panel.tsx` | Add ThemeToggle section | Update |
| `src/app/layout.tsx` | Wrap with ThemeProvider, add effects | Part 5 |
| `src/lib/utils.ts` | Add `cn()` utility | Part 5 |

---

## ASCII UI: Settings Panel with Theme Toggle

```
+----------------------------------------------------------+
|  Settings                                           [X]  |
+----------------------------------------------------------+
|                                                          |
|  AI Provider                                             |
|  [Anthropic Claude          v]                           |
|                                                          |
|  API Key                                    Get key ->   |
|  [********************************] [👁]                 |
|                                                          |
|  Editor                                                  |
|  [VS Code                   v]                           |
|                                                          |
|  Terminal App                                            |
|  [iTerm                     v]                           |
|                                                          |
|  +----------------------------------------------------+  |
|  | Theme                                              |  |
|  | Choose how the app looks to you.                   |  |
|  |                                                    |  |
|  | [☀ Light] [🌙 Dark] [🔥 Ember] [01 Matrix] [🖥 Sys] |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Screenshot Folder Path                                  |
|  [~/Screenshots                    ] [Browse]            |
|                                                          |
+----------------------------------------------------------+
|                      [Done]                              |
+----------------------------------------------------------+
```

---

## ASCII UX: Theme Application Flow

```
[App Launch] --> [Check localStorage] --> [Theme Found?]
                                               |
                      +------------------------+------------------------+
                      |                                                 |
                      v                                                 v
                [Apply Saved Theme]                           [Apply Default: light]
                      |                                                 |
                      +------------------------+------------------------+
                                               |
                                               v
                                    [Render with Theme Class]
                                               |
                      +------------------------+------------------------+
                      |                        |                        |
                      v                        v                        v
               [theme=matrix]           [theme=ember]            [theme=light/dark]
                      |                        |                        |
                      v                        v                        v
             [Start MatrixRain]         [Apply Ember]           [Standard Render]
             [Show CRTOverlay]            [Colors]
```

---

## Implementation Phases

| Phase | Tasks | Source PRD | Estimate |
|-------|-------|------------|----------|
| 1 | Dependencies + fonts + utils | Parts 1, 5 | 1 point |
| 2 | globals.css with theme variables | Parts 2-3 | 2 points |
| 3 | tailwind.config.ts update | Part 5 | 1 point |
| 4 | ThemeProvider + layout integration | Part 5 | 1 point |
| 5 | Toggle-group UI component | New (Radix) | 1 point |
| 6 | ThemeToggle + settings-panel update | Part 5 | 1 point |
| 7 | Matrix effects (rain + CRT) | Part 4 | 2 points |
| 8 | Video filters + scrollbars | Part 4 | 1 point |

**Total: 10 points**

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Matrix canvas performance | Throttle to 30fps, pause when tab hidden |
| Font loading flash | Use `font-display: swap`, preload critical fonts |
| Theme flash on load | Use `suppressHydrationWarning` on html element |

---

## Verification Checklist

- [ ] `bun run build` succeeds
- [ ] `bun run typecheck` passes
- [ ] Theme persists after page reload
- [ ] Light: White bg, blue primary, 2px black borders
- [ ] Dark: Slate bg, lighter blue, 1px subtle borders
- [ ] Ember: Dark gray bg, orange primary, gray text
- [ ] Matrix: Black bg, green everything, glowing elements
- [ ] Matrix rain animates (canvas)
- [ ] CRT scanlines visible in Matrix
- [ ] Reduced motion disables animations
- [ ] Theme toggle keyboard accessible
