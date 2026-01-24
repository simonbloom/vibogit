---
title: "IDE Selection Feature"
created: 2026-01-24
status: approved
project11_id: pd7dhz1vtmztr5759572kq1kpx7zv6vr
tags: [settings, editor, ide, ux]
---

# PRD: IDE Selection Feature

## Problem Statement

Currently, ViboGit requires users to manually type an editor command (e.g., "code", "cursor") in a text input field. This is error-prone, not user-friendly, and doesn't provide guidance on available options. Users want a simple dropdown to select their preferred IDE with Cursor and Antigravity as primary options.

## Goals and Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Improve editor selection UX | Time to configure editor | < 3 seconds (1 click) |
| Reduce configuration errors | Support tickets about editor not opening | 0 |
| Support preferred IDEs | Cursor & Antigravity available | 100% |

## User Stories

1. **As a developer**, I want to select my preferred IDE from a dropdown so I don't have to remember CLI commands.
2. **As a Cursor user**, I want Cursor to be the default option so it works out of the box.
3. **As a power user**, I want to add custom editor commands for IDEs not in the list.

## Requirements

### Functional Requirements (P0 - Must Have)
| ID | Requirement |
|----|-------------|
| FR1 | Dropdown in Settings with predefined IDE options |
| FR2 | Default selection: Cursor |
| FR3 | Support: Cursor, Antigravity, VS Code, Zed, Custom |
| FR4 | Custom option shows text input for arbitrary command |
| FR5 | Editor button opens selected IDE at project path |

### Non-Functional Requirements
| ID | Requirement |
|----|-------------|
| NFR1 | Settings persist across sessions (localStorage) |
| NFR2 | Extensible architecture for adding new IDEs |

## ASCII UI Mockups

### Settings Panel - IDE Selector Dropdown

```
+----------------------------------------------------------+
|  Settings                                            [X] |
+----------------------------------------------------------+
|                                                          |
|  AI Provider                                             |
|  +----------------------------------------------------+  |
|  | Anthropic                                      [v] |  |
|  +----------------------------------------------------+  |
|                                                          |
|  API Key                                    [Get key ->] |
|  +----------------------------------------------------+  |
|  | ************                              [eye]    |  |
|  +----------------------------------------------------+  |
|  Keys are stored locally in your browser                 |
|                                                          |
|  Editor                                                  |
|  +----------------------------------------------------+  |
|  | Cursor                                         [v] |  |
|  +----------------------------------------------------+  |
|    |  Cursor           |  <-- Dropdown options           |
|    |  Antigravity      |                                 |
|    |  VS Code          |                                 |
|    |  Zed              |                                 |
|    |  Custom...        |                                 |
|    +-------------------+                                 |
|                                                          |
|  [IF Custom selected:]                                   |
|  Custom Command                                          |
|  +----------------------------------------------------+  |
|  | /path/to/editor                                    |  |
|  +----------------------------------------------------+  |
|  Enter the CLI command to launch your editor             |
|                                                          |
+----------------------------------------------------------+
|                      [ Done ]                            |
+----------------------------------------------------------+
```

## ASCII UX Journey

```
[Click Editor Button] 
        |
        v
[Read settings.editor] --> [Map to command] --> [Execute: {cmd} {path}]
        |                         |
        |                         +-- cursor -> "cursor"
        |                         +-- antigravity -> "antigravity" 
        |                         +-- code -> "code"
        |                         +-- zed -> "zed"
        |                         +-- custom -> settings.customEditorCommand
        v
[IDE Opens at Project Path]


[Open Settings] --> [Select Editor Dropdown] --> [Save to localStorage]
                            |
                            +-- If "Custom" --> [Show custom command input]
```

## Technical Considerations

### Files to Modify
| File | Changes |
|------|---------|
| `apps/web/src/lib/settings.ts` | Add `EDITORS` constant, update `Settings` type |
| `apps/web/src/components/settings-panel.tsx` | Replace text input with dropdown + conditional custom input |
| `apps/daemon/src/system.ts` | Update `openInEditor` to handle editor mapping |

### Editor Command Mapping
```typescript
const EDITORS = [
  { id: "cursor", name: "Cursor", command: "cursor" },
  { id: "antigravity", name: "Antigravity", command: "antigravity" },
  { id: "code", name: "VS Code", command: "code" },
  { id: "zed", name: "Zed", command: "zed" },
  { id: "custom", name: "Custom...", command: null },
] as const;
```

### Settings Schema Update
```typescript
interface Settings {
  // ... existing fields
  editor: "cursor" | "antigravity" | "code" | "zed" | "custom";
  customEditorCommand?: string;
}
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Editor command not found | High | Show toast error with guidance |
| Breaking change for existing users | Medium | Migrate "code" text value to "code" enum |

## Launch Plan

1. Implement in single PR
2. Test on macOS with Cursor and Antigravity installed
3. Merge to main

## Open Questions

1. Confirm Antigravity CLI command (assumed: `antigravity`)
