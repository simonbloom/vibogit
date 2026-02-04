---
title: "Desktop App Dev Server Connection Fix"
created: 2026-02-04
status: approved
project11_id: pd7fzrgryb8jfy0e0k14t9f9yx80gpjs
tags: [desktop, tauri, dev-server, critical]
---

# PRD: Desktop App Dev Server Connection Fix

## Problem Statement

The ViboGit desktop app's dev server connection feature is fundamentally broken. When users click "Connect", the UI shows a green connected state with a port number, but:
1. The dev server doesn't actually start
2. The port button is unclickable/non-functional  
3. localhost:port is unreachable
4. No server logs are visible

This breaks a core workflow and creates a false sense of success, making the desktop app unusable for its primary purpose.

## Root Cause Analysis

Comparing the working **web app daemon** (TypeScript) with the broken **desktop Tauri backend** (Rust):

| Aspect | Web Daemon (Working) | Tauri Backend (Broken) |
|--------|---------------------|------------------------|
| Process spawn | Bun spawn with stream handling | std::process::Command |
| stdout/stderr | Async readers consume & store logs | Threads discard output silently |
| Running check | Process exists in Map | `kill -0 pid` (unreliable) |
| Port detection | Parsed from actual log output | Only from config (never verified) |
| Log storage | Stored & sent to frontend | Discarded |
| Error handling | Logged and surfaced | Silent failures |

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Server actually starts | `curl localhost:PORT` returns response within 30s of clicking Connect |
| Accurate status | Green = server listening on port (TCP connect succeeds) |
| Browser opens | Clicking green port button opens default browser to localhost:PORT |
| Logs visible | Server output visible in UI panel |
| Multiple projects | Can run dev servers for 3+ projects simultaneously on different ports |

## User Stories

1. **As a developer**, I want to click Connect and have my dev server start, so I can preview my work
2. **As a developer**, I want to click the green port button to open my app in browser
3. **As a developer**, I want to see server logs to debug startup issues
4. **As a developer**, I want accurate status so I know when the server is actually ready

## Requirements

### Functional Requirements (Priority Order)

| ID | Requirement | Priority |
|----|-------------|----------|
| F1 | `dev_server_start` must spawn process with working PATH for bun/npm/pnpm/yarn | Must Have |
| F2 | stdout/stderr must be captured and stored (last 200 lines) | Must Have |
| F3 | `dev_server_state` must verify port is actually listening (TCP connect) | Must Have |
| F4 | `openBrowser` command must open URL in system default browser | Must Have |
| F5 | Logs must be retrievable via `devServerLog` command | Should Have |
| F6 | Port detection from log output (e.g., "localhost:3000") | Should Have |
| F7 | Process exit handling with status code in logs | Should Have |
| F8 | Terminal-like log viewer panel showing dev server output | Should Have |
| F9 | Error toast/notification when dev server fails to start | Must Have |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NF1 | Server should be ready within 30 seconds or show timeout error |
| NF2 | Log storage limited to 200 lines to prevent memory growth |
| NF3 | Must work in sandboxed macOS app bundle (no daemon dependency) |

## ASCII Architecture Diagram

```
+------------------+       +-----------------------+
|  Desktop App     |       |  Tauri Rust Backend   |
|  (React/TS)      |       |                       |
+------------------+       +-----------------------+
|                  |       |                       |
| DevServerPanel   |------>| dev_server_start()    |
|   [Connect]      | invoke|   - spawn process     |
|                  |       |   - capture stdout    |
|                  |       |   - store logs        |
| DevServerStatus  |<------| dev_server_state()    |
|   [:3000]        | result|   - check TCP port    |
|                  |       |   - return logs       |
|                  |       |                       |
| [Click port] ----|------>| open_in_browser()     |
|                  | invoke|   - open::that(url)   |
+------------------+       +-----------------------+
                                    |
                                    v
                           +------------------+
                           | Child Process    |
                           | (bun run dev)    |
                           +------------------+
                           | stdout/stderr--->| captured
                           | listening :3000  | detected
                           +------------------+
```

## ASCII UX Flow

```
[Click Connect] 
      |
      v
[Status: Connecting...] --timeout 30s--> [Status: Error - Timeout]
      |
      | (polling every 1s)
      v
[dev_server_state] 
      |
      +-- running=false --> continue polling
      |
      +-- running=true && port_listening=true
              |
              v
      [Status: Connected :3000]
              |
              +-- [Click :3000] --> [Browser opens localhost:3000]
              |
              +-- [Click Restart] --> [Stop + Start flow]
              |
              +-- [Click Stop] --> [Status: Disconnected]
```

## ASCII UI Layout

```
+----------------------------------------------------------+
|  [Logo]    project11 X  content11 X  bloomin X  vibogit X |
+----------------------------------------------------------+
| bloomin    | main v |  [:7777]  [✏] [↻] [✕]              |
+----------------------------------------------------------+
|  ↓ Pull  |  ↻  | ↑ Push (2) | [Quick Commit (5)] | PR    |
+----------------------------------------------------------+
|                                                           |
|  [File Tree / Changes Panel]                              |
|                                                           |
+----------------------------------------------------------+
|  ▼ Dev Server Logs                                        |
|  +------------------------------------------------------+ |
|  | > bun run dev                                        | |
|  | $ next dev                                           | |
|  |   ▲ Next.js 15.0.0                                   | |
|  |   - Local: http://localhost:7777                     | |
|  |   - Ready in 2.3s                                    | |
|  +------------------------------------------------------+ |
+----------------------------------------------------------+
```

## Technical Considerations

1. **Rust process management**: Use `std::process::Command` with proper stream handling via spawned threads
2. **TCP port check**: Use `std::net::TcpStream::connect_timeout()` to verify port is listening
3. **Log storage**: Use `Arc<Mutex<Vec<String>>>` shared between capture thread and state queries
4. **PATH environment**: Must include `/opt/homebrew/bin`, `/usr/local/bin` for package managers
5. **Browser opening**: Use `open` crate which is already in the project

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Process spawn fails silently | Return error from `dev_server_start`, show in UI |
| Package manager not in PATH | Expand PATH with common locations |
| Port detection fails | Fall back to configured port, warn in logs |
| Memory growth from logs | Cap at 200 lines, rotate oldest |

## Open Questions (Resolved)

| Question | Answer |
|----------|--------|
| Should we show a terminal-like log viewer in the UI? | **Yes** - Add terminal-like log panel |
| Should failed commands surface an error toast/notification? | **Yes** - Show error toasts for failures |

## Implementation Tickets

| Phase | Ticket | Priority | Estimate |
|-------|--------|----------|----------|
| 1 | Fix dev_server_start process spawn with proper PATH | High | 2 |
| 1 | Fix open_in_browser Tauri command | High | 1 |
| 2 | Add stdout/stderr log capture with storage | High | 3 |
| 2 | Fix dev_server_state to verify port is listening via TCP | High | 2 |
| 3 | Add error toast notifications for dev server failures | High | 2 |
| 4 | Add terminal-like log viewer panel for dev server output | Medium | 4 |
| 5 | Integration test: End-to-end dev server connection flow | High | 2 |
