---
title: "ViboGit Marketing Page - Shortcut Manager Positioning"
created: 2026-02-23
status: draft
project11_id: pending
tags: [marketing, landing-page, positioning, desktop, conversion]
---

# PRD: ViboGit Marketing Page - Shortcut Manager Positioning

## Philosophy

> **"It does not reinvent the wheel. It makes the wheel turn faster."**

ViboGit is not trying to replace Git, your IDE, or your terminal.  
It is a speed layer for people juggling multiple active projects who want one place to trigger the actions they repeat all day.

## Problem Statement

The current landing page communicates "desktop git client" but undersells ViboGit's strongest real differentiators:

1. It is a shortcut manager for multi-project workflows.
2. The top-right quick links remove context-switch friction (Finder, browser, GitHub, terminal, editor).
3. Quick Commit is an accelerator for frequent commit flow, not a Git replacement.
4. Tool choice is user-controlled (editor + terminal preferences), so ViboGit adapts to existing workflow.

This causes messaging mismatch: users see "another git client" instead of "the control panel that keeps fast-moving projects organized."

## Core Product Principles (Extracted from Codebase)

| Principle | What It Means | Product Evidence |
|-----------|---------------|------------------|
| Reduce context switching | Move between active repos and tools with minimal clicks | `packages/ui/src/components/sidebar/project-list.tsx`, `packages/ui/src/lib/projects-context.tsx` |
| Shortcuts over reinvention | Launch existing tools instead of replacing them | `packages/ui/src/components/main-interface.tsx`, `packages/ui/src/lib/settings.ts` |
| Optimize frequent actions | Compress repetitive git actions into one-click helpers | `packages/ui/src/components/main-interface.tsx`, `apps/desktop/src-tauri/src/git.rs` |
| Stay configurable | Respect user tool preferences (editor/terminal/custom command) | `packages/ui/src/components/settings/sections/ToolsSettingsSection.tsx`, `apps/desktop/src-tauri/src/commands.rs` |
| Keep real git visible | Pull/fetch/push/PR remain explicit; app is not black-box automation | `packages/ui/src/components/main-interface.tsx` |

## Core Skills to Sell

1. **Shortcut Manager (hero feature)**  
   One-click launches to Finder, localhost preview, GitHub, preferred terminal, and preferred IDE from the top-right action strip.
2. **Quick Commit for repetitive flow**  
   Stages changes + generates commit message + commits in one action for "do this 40x/day" moments.
3. **Multi-project command center**  
   Sidebar project list with per-repo status signals (changes, ahead/behind, branch) to prevent getting lost.
4. **Workflow-native targeting**  
   User sets editor and terminal once; all quick actions open the right tool automatically.
5. **Desktop-first speed**  
   Native Tauri app, lightweight, direct local-repo operations.

## Goals and Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Clarify positioning | % of interviewed users who describe ViboGit as "shortcut manager/control panel" | >= 70% |
| Improve conversion intent | Hero CTA click-through to DMG downloads | >= 18% |
| Increase trust in differentiation | Scroll depth to "How it works" + "Not a replacement" sections | >= 55% sessions |
| Improve qualified installs | Clicks on "Download" from users who also view features section | >= 40% of download clicks |

## Target Audience

1. Developers running multiple "vibe coding" projects in parallel.
2. Solo builders/founders who context-switch constantly between repo, terminal, browser preview, and editor.
3. Git-comfortable users who still want speed and fewer repetitive clicks.

## Messaging Strategy

### Positioning Statement

ViboGit is the shortcut manager for repo work: one place to jump into your project tools and run frequent git actions faster, without replacing your existing workflow.

### Message Pillars

1. **Stop getting lost across projects**
2. **Everything you use most is one click away**
3. **Quick Commit accelerates common flow; it does not replace Git**
4. **Use your tools, your way (Cursor/Zed/VS Code/custom + Terminal/iTerm/Ghostty/Warp/Kitty)**

### Messaging Guardrails (Must Follow)

1. Do not claim "replaces Git" or "fully automates Git."
2. Do not position Quick Commit as a magic black box.
3. Always frame ViboGit as a speed layer on top of existing tools.
4. Keep tone direct and practical, not hype-heavy.

## User Stories

1. As a developer with several active repos, I want the page to immediately show that ViboGit helps me stay oriented across projects.
2. As a tool-opinionated developer, I want proof that ViboGit opens my chosen IDE/terminal, not forced defaults.
3. As a skeptical git user, I want confidence that ViboGit speeds up frequent actions without taking away control.
4. As a potential downloader, I want clear macOS download choices and release transparency.

## Scope

### In Scope

1. Rewrite `/` landing page with clear positioning + stronger conversion flow.
2. Highlight top-right quick links and Quick Commit behavior.
3. Add section explicitly stating "not a replacement" philosophy.
4. Keep direct download CTAs for Apple Silicon and Intel.
5. Keep link to releases and GitHub.
6. Ensure responsive desktop/mobile experience.

### Out of Scope

1. Reworking `/app` desktop application UX.
2. Adding authentication, pricing, or billing.
3. Re-architecting release pipeline.

## Requirements

### Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR-1 | Must | Hero headline communicates "shortcut manager for repo workflow" |
| FR-2 | Must | Hero subcopy includes "does not reinvent the wheel" philosophy |
| FR-3 | Must | Dedicated section for top-right Quick Links (Finder, Browser, GitHub, Terminal, Editor) |
| FR-4 | Must | Dedicated section for Quick Commit with explicit "not a git replacement" language |
| FR-5 | Must | Section showing multi-project sidebar/status as anti-chaos value |
| FR-6 | Must | "How it works" section in 3 steps (Connect project -> Jump tools -> Commit/ship faster) |
| FR-7 | Must | Download CTAs for Apple Silicon + Intel Mac remain visible above fold and near page end |
| FR-8 | Must | Keep Tauri runtime redirect behavior from `/` to `/app` |
| FR-9 | Should | Include static screenshot or annotated visual from current app UI |
| FR-10 | Should | Include concise FAQ handling "Is this a git replacement?" |
| FR-11 | Should | Include social proof style proof points (open source, release cadence, desktop native) |

### Non-Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| NFR-1 | Must | Compatible with Next.js static export (`output: "export"`) |
| NFR-2 | Must | Page fully usable on mobile widths (>= 320px) |
| NFR-3 | Must | Meet basic accessibility: semantic headings, keyboard focus, readable contrast |
| NFR-4 | Should | Lighthouse Performance >= 90 on desktop |
| NFR-5 | Should | Avoid layout shift in hero CTA area |

## Information Architecture

1. Hero (positioning + primary downloads)
2. "Why ViboGit exists" (founder pain: getting lost in many projects)
3. Core Skills grid (Shortcut Manager, Quick Commit, Multi-project visibility, Tool targeting, Desktop speed)
4. Product walkthrough ("How it works")
5. "Not a replacement" section
6. Final CTA strip (downloads + releases)
7. Lightweight FAQ

## ASCII UI Mockups

### Desktop Layout

```
+--------------------------------------------------------------------------------------+
| ViboGit                                                             [GitHub] [Docs]  |
+--------------------------------------------------------------------------------------+
| Stop getting lost in your projects                                                     |
| ViboGit is your shortcut manager for repo work. It doesn't reinvent the wheel.       |
| It makes the wheel turn faster.                                                        |
|                                                                                       |
| [Download Apple Silicon] [Download Intel] [View Releases]                            |
+--------------------------------------------------------------------------------------+
| Why I built this                                                                      |
| "I had too many active vibe projects and needed one place for frequent actions."     |
+--------------------------------------------------------------------------------------+
| Core Skills                                                                           |
| [Shortcut Manager] [Quick Commit] [Multi-Project View] [Tool Targeting] [Desktop]    |
+--------------------------------------------------------------------------------------+
| How it works                                                                          |
| 1. Add projects  ->  2. Use quick links (top-right)  ->  3. Quick Commit + Push/PR   |
+--------------------------------------------------------------------------------------+
| Not a Git replacement                                                                 |
| Keep your normal Git flow. ViboGit removes repetitive clicks.                         |
+--------------------------------------------------------------------------------------+
| [Download Apple Silicon] [Download Intel] [Open GitHub Releases]                      |
+--------------------------------------------------------------------------------------+
```

### Mobile Layout

```
+--------------------------------------+
| ViboGit                              |
| Shortcut manager for repo workflow   |
| [Download (Apple Silicon)]           |
| [Download (Intel)]                   |
+--------------------------------------+
| Why it exists                        |
| "Too many projects, too much friction"|
+--------------------------------------+
| Core Skills                          |
| - Quick Links                        |
| - Quick Commit                       |
| - Multi-project status               |
| - IDE/terminal targeting             |
+--------------------------------------+
| Not a replacement                    |
| Keeps git. Speeds repetitive actions |
+--------------------------------------+
```

## ASCII UX Journey

```
[Visitor lands on /]
        |
        v
[Reads hero: "shortcut manager, not replacement"]
        |
        +--> [Understands top-right quick links value]
        |
        +--> [Understands quick commit scope]
        |
        v
[Checks "How it works" + core skills]
        |
        v
[Clicks Download CTA]
        |
        v
[Installs DMG and opens desktop app]
```

## Technical Considerations

### Files Expected to Change

1. `apps/desktop/frontend/src/app/page.tsx`
2. `apps/desktop/frontend/src/app/globals.css` (if additional landing-page styles are needed)
3. `apps/desktop/frontend/public/screenshot.png` (reuse/update visual asset as needed)

### Implementation Notes

1. Preserve existing runtime guard:
   - If running inside Tauri (`__TAURI__`), immediately redirect to `/app`.
2. Keep static rendering compatible with `next export`.
3. Use existing download URLs pattern but avoid brittle hardcoded version strings where possible.
4. Prefer lightweight local assets and avoid heavy runtime dependencies.

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Messaging still sounds like generic git client | High | Make "shortcut manager" language the first message in hero and section headers |
| Users think Quick Commit replaces git expertise | High | Add explicit "not replacement" copy near Quick Commit section |
| Over-index on founder language and lose clarity | Medium | Pair personal story with concrete capability bullets |
| Download links drift from latest release naming | Medium | Use stable release links or verify links at each release |

## Launch Plan

1. Approve PRD copy and messaging hierarchy.
2. Implement landing page redesign on `/`.
3. QA on desktop + mobile widths.
4. Validate Tauri redirect still works.
5. Ship with release notes calling out new positioning.

## Acceptance Criteria

- [ ] Hero clearly states ViboGit is a shortcut manager for repo workflow
- [ ] Page includes explicit "not a git replacement" statement
- [ ] Top-right quick links are explained as primary day-to-day value
- [ ] Quick Commit is framed as frequent-action accelerator
- [ ] Multi-project anti-chaos value is visible
- [ ] Download CTAs for both macOS architectures are present in two locations
- [ ] Tauri runtime still redirects `/` to `/app`
- [ ] Page is responsive and readable on mobile

## Open Questions

1. Which hero line should be canonical: "Stop getting lost in your projects" vs "Shortcuts for your repo workflow"?
2. Should we keep "Vibe Coder" in hero copy, or reserve it for secondary copy only?
3. Do you want a founder quote block with your exact language ("pain in my ass" toned for site voice), or a cleaner paraphrase?
