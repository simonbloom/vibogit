---
title: "ViboGit Local Config System"
created: 2026-01-25
status: approved
project11_id: pd76g8w3efhtnrfhqszf7w8qnx7zw52n
tags: [config, settings, daemon]
---

# PRD: ViboGit Local Config System

## Problem Statement
Currently, ViboGit stores user settings (AI API keys, editor preferences, screenshot paths) in the browser's localStorage. This means:
- Settings are lost when clearing browser data
- Settings don't persist across different browsers
- Settings can't be backed up or version-controlled
- No way to auto-detect machine-specific values (computer name)

## Goals & Success Metrics
- **Goal**: Persist all user settings in `~/.vibogit/config.json` managed by the daemon
- **Success**: Settings survive browser data clears, sync automatically when daemon connects
- **Metric**: Zero localStorage usage for settings after migration

## User Stories
1. As a user, I want my settings to persist even if I clear my browser data
2. As a user, I want my computer name auto-detected so I can identify which machine I'm using
3. As a user, I want my AI API key stored securely on my machine, not in the browser
4. As a user, I want to edit settings from the existing settings panel and have them sync to the config file

## Requirements

### Functional
1. Create `~/.vibogit/` directory if it doesn't exist
2. Store config in `~/.vibogit/config.json`
3. Auto-detect computer name on daemon startup (via `scutil --get ComputerName`)
4. Sync settings bidirectionally: web ↔ daemon
5. Settings panel updates config via WebSocket → daemon writes to file

### Config Schema
```json
{
  "computerName": "MacBook Air",
  "aiProvider": "anthropic",
  "aiApiKey": "sk-...",
  "editor": "cursor",
  "customEditorCommand": "",
  "terminal": "Ghostty",
  "theme": "dark",
  "imageBasePath": "/Users/simon/Desktop",
  "showHiddenFiles": false
}
```

### Non-Functional
- Config file should be human-readable JSON with 2-space indent
- Daemon should create default config if file doesn't exist
- Invalid JSON should fallback to defaults (don't crash)

## Technical Considerations
- **Daemon**: New `ConfigService` class in `apps/daemon/src/config.ts`
- **WebSocket**: New message types: `getConfig`, `setConfig`, `configChanged`
- **Web**: Modify `settings.ts` to use daemon instead of localStorage
- **Existing keychain.ts**: Could be used for API keys later (security revisit)

## ASCII UX Flow
```
[Web App Loads] --> [Connect to Daemon] --> [getConfig] --> [Daemon reads ~/.vibogit/config.json]
                                                |
                                                v
                                    [Web receives config]
                                                |
                                                v
                                    [Populate settings panel]

[User changes setting] --> [setConfig via WS] --> [Daemon writes config.json]
                                                          |
                                                          v
                                              [Broadcast configChanged to all clients]
```

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| File permissions issue | Create with user-only permissions (600) |
| Concurrent writes | Simple last-write-wins for now |
| API key in plain text | Note: Revisit security later (keychain integration) |

## Open Questions
- Should we encrypt the config file?
- Should we support per-project config overrides (`.vibogit/config.json` in repo)?
