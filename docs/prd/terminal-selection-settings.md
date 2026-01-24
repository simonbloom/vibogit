---
title: "Terminal Selection in Settings"
created: 2026-01-24
status: approved
project11_id: pd76sp4hpe8ejna4h34h1dvybh7zvp83
tags: [settings, terminal, ux]
---

# PRD: Terminal Selection in Settings

## Problem Statement

Users currently cannot choose their preferred terminal emulator when clicking the Terminal button in ViboGit. The app hardcodes `Terminal.app`, but power users prefer alternatives like Ghostty, iTerm2, Warp, or Kitty for features like GPU acceleration, AI integration, or better customization.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Enable terminal choice | Users can select from 5 terminal options |
| Persist preference | Selection saved to localStorage |
| Seamless UX | Terminal opens in repo directory on click |

## User Stories

1. As a user, I want to select my preferred terminal in Settings so the Terminal button opens it instead of Terminal.app
2. As a Ghostty user, I want my terminal to open at the current repo path when I click the Terminal button

## Requirements

| Priority | Requirement |
|----------|-------------|
| Must Have | Add terminal dropdown to Settings panel with 5 options |
| Must Have | Persist terminal selection in localStorage |
| Must Have | Update daemon to accept terminal parameter |
| Must Have | Open selected terminal at repo path |

## Supported Terminals

| Terminal | App Name | Command |
|----------|----------|---------|
| Terminal.app | Terminal | `open -a Terminal {path}` |
| iTerm2 | iTerm | `open -a iTerm {path}` |
| Ghostty | Ghostty | `open -a Ghostty {path}` |
| Warp | Warp | `open -a Warp {path}` |
| Kitty | kitty | `open -a kitty {path}` |

## ASCII UI Mockup - Settings Panel

```
+----------------------------------------------------------+
|  Settings                                            [X] |
+----------------------------------------------------------+
|                                                          |
|  AI Provider                                             |
|  +----------------------------------------------------+  |
|  | Anthropic                                     [v]  |  |
|  +----------------------------------------------------+  |
|                                                          |
|  API Key                                    Get key ->   |
|  +----------------------------------------------------+  |
|  | sk-ant-...                                    [eye] |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Editor Command                                          |
|  +----------------------------------------------------+  |
|  | code                                               |  |
|  +----------------------------------------------------+  |
|                                                          |
|  Terminal App                              <-- NEW       |
|  +----------------------------------------------------+  |
|  | Ghostty                                       [v]  |  |
|  +----------------------------------------------------+  |
|  Options: Terminal.app, iTerm2, Ghostty, Warp, Kitty    |
|                                                          |
|  Screenshot Folder Path                                  |
|  +----------------------------------------------------+  |
|  | /path/to/screenshots                               |  |
|  +----------------------------------------------------+  |
|                                                          |
|  +----------------------------------------------------+  |
|  |                       Done                         |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
```

## ASCII UX Flow

```
[Click Terminal Button] --> [Read settings.terminal] --> [Send to daemon]
                                                              |
                                                              v
                                            [daemon: openInTerminal(path, terminal)]
                                                              |
                                                              v
                                            [Execute: open -a {terminal} {path}]
```

## Technical Considerations

**Files to Modify:**
1. `apps/web/src/lib/settings.ts` - Add `terminal` field to Settings interface
2. `apps/web/src/components/settings-panel.tsx` - Add Terminal dropdown
3. `apps/web/src/components/main-interface.tsx` - Pass terminal to daemon
4. `apps/daemon/src/system.ts` - Accept terminal parameter in `openInTerminal()`
5. `apps/daemon/src/server.ts` - Pass terminal from payload

**No new dependencies required.**

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| User selects terminal not installed | Graceful error - macOS shows "app not found" dialog |
| Breaking change for existing users | Default to "Terminal" for backwards compatibility |

## Launch Plan

1. Implement in single PR
2. Default value ensures no breaking change
3. No feature flag needed

## Acceptance Criteria

- [ ] Terminal dropdown appears in Settings panel
- [ ] Selection persists after closing/reopening Settings
- [ ] Terminal button opens selected terminal at repo path
- [ ] Default is Terminal.app for backwards compatibility
- [ ] All 5 terminal options available in dropdown
