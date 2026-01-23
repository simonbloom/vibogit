---
title: "Per-Project Dev Server Connection"
created: 2026-01-23
status: approved
project11_id: pd7eekqfxgtjj85m145e8kz9hs7zrjr0
tags: [dev-server, connection, ui]
---

# PRD: Per-Project Dev Server Connection

## Problem Statement

Users need to manage dev server connections per-project directly from the ViboGit UI. Currently:
- No way to start/stop dev servers from the UI
- Connection status shows global daemon, not project-specific dev server
- Browser button doesn't know which port to open per project

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| One-click dev server start | < 2 clicks to start server |
| Clear connection status | User knows server state at a glance |
| Per-project port management | Each tab shows its own port |

## User Stories

1. As a user, I want to click "Connect" to start my project's dev server
2. As a user, I want to see "Connected :5557" when my server is running
3. As a user, I want to click "Restart" to quickly restart my dev server
4. As a user, I want to click "Disconnect" to stop my dev server
5. As a user, I want to be prompted for a port if agents.md doesn't have one
6. As a user, I want agents.md auto-updated with my port choice

---

## ASCII UI Layouts

### Header - Disconnected State
```
+--------------------------------------------------------------------------------+
|                                                                                |
|  ProjectName    [ main v ]    [ Connect ]           [📁][🌐][⌨️][</>][⚙️]      |
|                                 (red bg)                                       |
|                                                                                |
+--------------------------------------------------------------------------------+
|  [ Pull ]  [↻]  [ Push ]  [ Commit (3) ]  [ PR ]                              |
+--------------------------------------------------------------------------------+
```

### Header - Connecting State
```
+--------------------------------------------------------------------------------+
|                                                                                |
|  ProjectName    [ main v ]    [ ◐ Connecting... ]   [📁][🌐][⌨️][</>][⚙️]      |
|                                 (yellow bg)                                    |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### Header - Connected State
```
+--------------------------------------------------------------------------------+
|                                                                                |
|  ProjectName    [ main v ]    [ ● :5557 ][↻][✕]     [📁][🌐][⌨️][</>][⚙️]      |
|                                (green)  (restart)                              |
|                                          (disconnect)                          |
|                                                                                |
+--------------------------------------------------------------------------------+
```

### Connected State - Detailed Component
```
+------------------------------------------+
|                                          |
|  [ ● Connected :5557 ] [↻] [✕]           |
|     └── green dot       │    │           |
|     └── port number     │    │           |
|                         │    │           |
|            Restart ─────┘    │           |
|            (icon button)     │           |
|                              │           |
|            Disconnect ───────┘           |
|            (icon button, stops server)   |
|                                          |
+------------------------------------------+
```

### Port Prompt Modal (when no port in agents.md)
```
+--------------------------------------------------+
|                                              [X] |
|  No port found in agents.md                      |
|                                                  |
|  Enter dev server port for this project:         |
|                                                  |
|  +------------------------------------------+    |
|  |  5557                                    |    |
|  +------------------------------------------+    |
|                                                  |
|  [x] Update agents.md with this port             |
|                                                  |
|  [ Cancel ]                    [ Connect ]       |
|                                                  |
+--------------------------------------------------+
```

### Error State
```
+--------------------------------------------------------------------------------+
|                                                                                |
|  ProjectName    [ main v ]    [ ⚠ Failed ][Retry]   [📁][🌐][⌨️][</>][⚙️]      |
|                                 (red text)                                     |
|                                                                                |
+--------------------------------------------------------------------------------+
```

---

## ASCII UX Flows

### Main Connection Flow
```
[User clicks "Connect"]
         │
         ▼
[Read agents.md for port]
         │
         ├── Port found ────────────────────────────┐
         │                                          │
         ▼                                          ▼
[No port found]                              [Kill process on port]
         │                                   lsof -ti:PORT | xargs kill -9
         ▼                                          │
[Show Port Prompt Modal]                            ▼
         │                                   [Start dev server]
         │                                   bun run dev
         ├── User cancels ──► [Stay disconnected]   │
         │                                          ▼
         ▼                                   [Poll until responding]
[User enters port]                           curl localhost:PORT
         │                                          │
         ├── "Update agents.md" checked?            │
         │         │                                │
         │         ▼                                │
         │   [Write port to agents.md]              │
         │                                          │
         └──────────────────────────────────────────┤
                                                    │
                              ┌─────────────────────┤
                              │                     │
                              ▼                     ▼
                    [Timeout 30s]           [Server responds]
                              │                     │
                              ▼                     ▼
                    [Show "Failed"]         [Show "Connected :PORT"]
                    [Offer Retry]
```

### Tab Switch Flow
```
[User switches to Tab B]
         │
         ▼
[Get Tab B's repoPath]
         │
         ▼
[Query devServerState(repoPath)]
         │
         ├── Server running on port 3000
         │         │
         │         ▼
         │   [Show "● :3000" + restart + disconnect]
         │
         └── Server not running
                   │
                   ▼
             [Show "Connect" button]
```

### Restart Flow
```
[User clicks Restart ↻]
         │
         ▼
[Set status: "Restarting..."]
         │
         ▼
[Kill current process]
         │
         ▼
[Start dev server again]
         │
         ▼
[Poll until responding]
         │
         ▼
[Show "Connected :PORT"]
```

### Disconnect Flow
```
[User clicks Disconnect ✕]
         │
         ▼
[Kill process on port]
         │
         ▼
[Show "Connect" button]
```

### Browser Button Flow
```
[User clicks Browser 🌐 button]
         │
         ▼
[Get current tab's port from devServerState]
         │
         ├── Port exists ──► window.open("http://localhost:PORT")
         │
         └── No port ──► Show tooltip "Start dev server first"
```

---

## Technical Considerations

### Daemon Endpoints Needed
```typescript
// Parse agents.md for config
"readAgentsConfig" → { port?: number, devCommand?: string }

// Kill process on port (macOS)
"killPort" → executes: lsof -ti:${PORT} | xargs kill -9 2>/dev/null || true

// Update agents.md with port
"updateAgentsConfig" → writes port to agents.md

// Existing endpoints used:
"devServerStart" → starts the dev server
"devServerStop" → stops the dev server  
"devServerState" → returns { running, port, logs }
```

### agents.md Parsing Patterns
```
Dev server port: 5557
Port: 3000
PORT=8080
- port: 5557
```

### agents.md Update Format
```markdown
## Development
- Dev server port: 5557
- Run dev: `bun run dev`
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Port in use by other app | Kill command handles it; show error if persistent |
| agents.md doesn't exist | Create it with port info |
| Server crashes on start | Show error state with last log lines, offer retry |

---

## Open Questions

None - all clarified in Q&A.
