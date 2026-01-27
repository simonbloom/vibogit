---
title: "Documentation & Onboarding Improvements"
created: 2026-01-27
status: approved
project11_id: pd7774dkbtcg9a8k2rex3mwxns801r9y
tags: [documentation, onboarding, ux]
---

# PRD: Documentation & Onboarding Improvements

## Problem Statement
1. **No root README** - Project has no main README.md explaining what ViboGit is
2. **Outdated daemon instructions** - UI shows `npx vibogit-daemon` but daemon requires Bun
3. **Poor first-time experience** - Users see bare "Start the daemon" screen with minimal guidance
4. **Missing installation options** - Homebrew option not mentioned in UI

## Goals
1. Create comprehensive root README for GitHub
2. Update first-time user UI with better onboarding
3. Provide multiple installation methods (bunx, homebrew, global)
4. Make the disconnected state helpful, not frustrating

## Success Metrics
- New users can get running in < 2 minutes
- Zero confusion about Bun vs npm requirement
- Installation success rate > 95%

## User Stories
1. As a new user visiting GitHub, I want to understand what ViboGit is and how to install it
2. As a first-time user in the web app, I want clear step-by-step instructions to get started
3. As a user who prefers Homebrew, I want to see that option prominently
4. As a returning user whose daemon stopped, I want quick instructions to restart

## Requirements

### 1. Root README.md (New File)
| Priority | Requirement |
|----------|-------------|
| Must | Project title, tagline, and screenshot |
| Must | Quick start instructions (< 30 seconds to first use) |
| Must | Installation methods: bunx, homebrew, global |
| Must | Requirements section (Bun, macOS) |
| Should | Features list with icons/emojis |
| Should | Link to web app (vibogit.com) |
| Should | Development setup for contributors |

### 2. First-Time UI (Disconnected State)
| Priority | Requirement |
|----------|-------------|
| Must | Show ViboGit logo and tagline |
| Must | Step-by-step numbered instructions |
| Must | Multiple install options (tabs or accordion) |
| Must | Copy-to-clipboard button for commands |
| Must | "Reconnect" button using new reconnect() function |
| Should | Animated connection indicator |
| Should | Link to GitHub for troubleshooting |

### 3. Update Daemon README
| Priority | Requirement |
|----------|-------------|
| Must | Fix any outdated commands |
| Should | Add troubleshooting section |
| Should | Add connection indicator info |

## Acceptance Criteria
- [ ] Root README.md exists with all Must requirements
- [ ] OnboardingScreen component shows on disconnected state
- [ ] Copy buttons work and show feedback
- [ ] Install method tabs switch correctly
- [ ] Reconnect button calls reconnect() from daemon context
- [ ] All commands use `bunx` not `npx`
- [ ] Homebrew instructions are accurate
- [ ] TypeScript compiles: `bun run typecheck` exits 0
