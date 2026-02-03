---
title: "ViboGit Tauri Desktop Parity (Option B)"
created: 2026-02-03
status: approved
project11_id: pd73expad4c24pa06medarg5c580fy81
tags: [vibogit, tauri, desktop, parity]
---

# PRD: ViboGit Tauri Desktop Parity (Option B)

## Problem Statement
The Tauri desktop app is unstable and incomplete: many daemon `send()` commands are missing or stubbed, response shapes diverge from `@vibogit/shared` types, and React hydration fails when empty/incorrect payloads are returned. This causes unresponsive UI and feature gaps compared to the web app.

## Goals
- Achieve **full parity** with the web app for macOS desktop, including dev-server control, skills, agents, and launcher actions.
- Eliminate runtime/hydration failures from bad command responses.
- Align all Rust serialization with shared TypeScript contracts.

## Success Metrics
- **100% of web `send()` commands implemented with typed responses** matching `@vibogit/shared`.
- Zero hydration/runtime errors during a 30‑minute session.
- All core Git flows (status/diff/commit/branch/stash) complete without UI stalls.

## Target Users
- Mixed user base: power users and casual users using the desktop app for Git workflows.

## Scope
### In Scope (Must Have)
- Implement **all missing Tauri commands** and response shapes.
- Align serialization with shared contracts.
- Restore full app functionality: Git, dev server, skills, agents, launchers, file/config operations.
- macOS only.

### Out of Scope
- Windows/Linux parity
- New UI features beyond parity
- Net-new Git operations not present in web app

## User Stories
1. As a user, I can open a repo and see accurate git status, staged/unstaged lists, and diffs.
2. As a user, I can stage/unstage files, commit, checkout branches, and stash without errors.
3. As a user, I can start/stop/restart the dev server and kill ports from the desktop app.
4. As a user, I can open Finder/Terminal/Editor/Browser from the desktop app.
5. As a user, I can manage skills and agents configs with the same behavior as the web app.

## Functional Requirements

### Command Parity (Must Have)
Implement and wire the following commands with typed responses:

- Repo/meta: `getFavicon`, `getRemotes`, `listFiles`, `readFile`
- Config: `getConfig`, `setConfig`
- Git: `initGit`, `status`, `log`, `diff`, `stage`, `unstage`, `stageAll`, `checkout`, `createBranch`, `stashSave`
- Dev server: `devServerStart`, `devServerStop`, `devServerRestart`, `devServerState`, `killPort`
- Launchers: `openFinder`, `openTerminal`, `sendToTerminal`, `openEditor`, `openBrowser`
- Skills/Agents: `list-skills`, `readAgentsConfig`, `updateAgentsConfig`

### Response Shape Alignment (Must Have)
- `status` returns `{ staged: GitFile[], unstaged: GitFile[] }`.
- `log` returns `{ commits: GitCommit[] }`.
- `diff` returns `{ diff: GitDiff }`.
- `config` returns `Config` from `@vibogit/shared`.
- All errors return structured, non-empty payloads (no `{}` stubs).

### Error Handling (Should Have)
- Each command returns explicit error codes/messages on failure.
- Unsupported actions surface a clear UI-friendly error.

## Non-Functional Requirements
- Correctness: all payloads conform to shared types.
- Stability: no React hydration failures or UI lockups.
- Performance: typical Git operations return within 2s.
- Security: avoid exposing sensitive paths or secrets in logs.

## Technical Considerations
- Align Rust structs with `@vibogit/shared` types using `serde` rename/wrapper patterns.
- Ensure `daemon-context.tsx` mappings cover all commands.
- Add serialization tests or command contract checks where feasible.
- Avoid empty stubs; return typed errors or real data.

## ASCII UI Mockup (Main Desktop)
```
+----------------------------------------------------------+
| ViboGit                                  [User] [Prefs]  |
+----------------------------------------------------------+
| Sidebar     | Repo: my-project                            |
| - Repos     | +-------------------+   +-----------------+ |
| - Branches  | | Status            |   | Diff/Details    | |
| - Skills    | | - Staged          |   | [file diff]     | |
| - Agents    | | - Unstaged        |   |                 | |
| - Settings  | +-------------------+   +-----------------+ |
|             | +-------------------+                     |
|             | | Commit Message    |  [Commit] [Stash]   |
|             | +-------------------+                     |
+----------------------------------------------------------+
```

## ASCII UX Journey (Core Flow)
```
[Open App] --> [Select Repo] --> [Status + Diff]
     |                  |             |
     v                  v             v
[Launch Tools]     [Stage/Unstage] --> [Commit] --> [Push]
```

## Risks & Mitigations
- Missing command parity causes runtime errors → maintain a parity checklist and validate every `send()` route.
- Type drift between Rust and TS → enforce serde mappings and spot-check responses against shared types.
- Dev server commands hang → add timeouts and structured errors.

## Launch Plan
1. Implement command parity + type alignment.
2. Manual QA: clone/status/commit/branch/stash/dev server flows.
3. Release macOS build.
4. Monitor errors and regressions.

## Open Questions
- Add telemetry for command failures?
- Feature flags for dev-server/skills if optional?
