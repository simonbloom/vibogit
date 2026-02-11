---
title: "Fix Terminal Paste in Desktop App (Send to Terminal)"
created: 2026-02-10
status: approved
project11_id: pd78xx16zwtk6z4gzad05wc3rd80whtp
tags: [desktop, tauri, rust, ghostty, terminal, bug-fix]
---

# PRD: Fix Terminal Paste in Desktop App (Send to Terminal)

## Problem Statement

The ViboGit desktop app's "Send" button in the prompt box fails to paste text into Ghostty (and other non-iTerm terminals). Users who rely on Ghostty as their terminal cannot use the core workflow of composing a prompt and sending it to the terminal.

**Root cause:** The Tauri Rust backend (`commands.rs`) uses AppleScript `keystroke` to type text character-by-character for all non-iTerm terminals. This is slow, breaks on special characters, and does not work reliably with Ghostty. Meanwhile, the daemon (`system.ts`) correctly uses clipboard (`pbcopy`) + `Cmd+V` paste for these terminals.

Additionally, the Rust code unconditionally presses Enter (`key code 36`) after typing, which auto-executes the pasted command -- the daemon does not do this, and it should be user-configurable.

## Goals and Success Metrics

| Goal | Metric |
|------|--------|
| Fix paste into Ghostty | Send button pastes text into Ghostty 100% of the time |
| Fix paste into all terminals | Terminal.app, Warp, kitty all work via clipboard+paste |
| Configurable auto-execute | New "Press Enter after paste" setting in config |
| Parity with daemon | Rust backend behavior matches `system.ts` for all terminal types |

## User Stories

1. **As a user with Ghostty**, I want to click Send and have my prompt pasted into the terminal so I can execute AI commands.
2. **As a user of any terminal**, I want reliable text transfer from the prompt box to my terminal.
3. **As a user**, I want to choose whether the app auto-presses Enter after pasting, so I can review the prompt before executing.

## Requirements

### Functional Requirements

| # | Requirement | Priority |
|---|-------------|----------|
| F1 | Rust `send_to_terminal` uses `pbcopy` + `Cmd+V` for non-iTerm terminals (Ghostty, Terminal.app, Warp, kitty) | Must Have |
| F2 | Remove hardcoded `key code 36` (Enter) from the catch-all terminal handler | Must Have |
| F3 | Add `autoExecutePrompt: boolean` field to `Config` interface (default: `false`) | Should Have |
| F4 | Add toggle in Settings panel for "Press Enter after paste" | Should Have |
| F5 | Pass `autoExecute` flag through `sendToTerminal` message to Rust backend | Should Have |
| F6 | If `autoExecute` is true, press Enter (`key code 36`) after the paste keystroke | Should Have |
| F7 | Daemon `system.ts` also respects the `autoExecute` flag for parity | Should Have |

### Non-Functional Requirements

| # | Requirement |
|---|-------------|
| NF1 | Paste must complete within 500ms of clicking Send |
| NF2 | No regression in iTerm2 `write text` behavior |
| NF3 | Existing clipboard contents are overwritten (acceptable tradeoff) |

## Technical Considerations

### Architecture

```
[PromptBox] --onSubmit--> [main-interface.tsx] --send("sendToTerminal")--> [daemon-context.tsx]
                                                                              |
                                                            (Tauri mode)      |     (Daemon mode)
                                                                |             |           |
                                                    tauriInvoke("send_to_terminal")   WebSocket
                                                                |                        |
                                                    [commands.rs] <-- FIX HERE    [system.ts] <-- ADD autoExecute
```

### Files Affected

| File | Change |
|------|--------|
| `apps/desktop/src-tauri/src/commands.rs` | Rewrite catch-all `_` branch in `send_to_terminal` to use pbcopy + Cmd+V |
| `packages/shared/src/types.ts` | Add `autoExecutePrompt: boolean` to `Config` |
| `packages/ui/src/lib/settings.ts` | Add default for `autoExecutePrompt` |
| `packages/ui/src/components/settings-panel.tsx` | Add toggle for "Press Enter after paste" |
| `packages/ui/src/components/main-interface.tsx` | Pass `autoExecute` in `sendToTerminal` call |
| `packages/ui/src/lib/daemon-context.tsx` | Pass `autoExecute` through to Tauri invoke |
| `apps/daemon/src/system.ts` | Accept and respect `autoExecute` flag |
| `apps/daemon/src/server.ts` | Pass `autoExecute` from message to `sendToTerminal` |

### Rust Fix (Core Change)

Current broken code in `commands.rs`:
```rust
_ => format!(
    r#"tell application "{}"
        activate
    end tell
    delay 0.2
    tell application "System Events"
        keystroke "{}"     // <-- types char by char, breaks with special chars
        key code 36        // <-- presses Enter unconditionally
    end tell"#,
    terminal_app,
    text.replace("\"", "\\\"")
),
```

Fixed code:
```rust
_ => {
    // Copy text to clipboard via pbcopy (like daemon does)
    let mut pbcopy = std::process::Command::new("pbcopy")
        .stdin(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;
    if let Some(mut stdin) = pbcopy.stdin.take() {
        use std::io::Write;
        stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
    }
    pbcopy.wait().map_err(|e| e.to_string())?;

    let enter_part = if auto_execute {
        "\nkey code 36"
    } else {
        ""
    };

    let script = format!(
        r#"tell application "{app}"
            activate
        end tell
        delay 0.3
        tell application "System Events"
            tell process "{app}"
                keystroke "v" using command down{enter}
            end tell
        end tell"#,
        app = terminal_app,
        enter = enter_part
    );

    Command::new("osascript")
        .args(["-e", &script])
        .output()
        .map(|_| ())
        .map_err(|e| e.to_string())
}
```

## ASCII UI Mockup - Settings Panel Addition

```
+-------------------------------------------------------+
|  Settings                                         [X]  |
+-------------------------------------------------------+
|  Terminal App                                          |
|  [Ghostty                              v]              |
|                                                        |
|  Theme                                                 |
|  [Dark                                 v]              |
|                                                        |
|  [x] Press Enter after paste                           |
|      When enabled, automatically presses Enter         |
|      after pasting the prompt into the terminal.       |
|                                                        |
|  Image Base Path                                       |
|  [/Users/you/Desktop/screenshots       ]               |
+-------------------------------------------------------+
```

## ASCII UX Flow

```
[User types prompt] --> [Clicks Send] --> [main-interface builds text]
                                                    |
                                        [send("sendToTerminal", {text, terminal, autoExecute})]
                                                    |
                                    +---------------+----------------+
                                    |                                |
                             [Tauri Mode]                     [Daemon Mode]
                                    |                                |
                          [commands.rs]                     [system.ts]
                                    |                                |
                         +----------+----------+          +----------+----------+
                         |                     |          |                     |
                    [iTerm]              [Other]     [iTerm]              [Other]
                         |                     |          |                     |
                  [write text]         [pbcopy + Cmd+V]  [write text]    [pbcopy + Cmd+V]
                         |                     |          |                     |
                    (optional Enter)    (optional Enter)  (optional Enter) (optional Enter)
```

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Clipboard overwrite | User loses clipboard content | Acceptable tradeoff; same behavior as daemon |
| Accessibility permissions | System Events requires Accessibility access | Already required for current keystroke approach; no change |
| Delay timing | 0.3s delay may be too short on slow machines | Match daemon's 0.3s; can be tuned later |
| Rust recompile required | Change won't appear without full rebuild | Document in PR; post-commit hook handles it |

## Launch Plan

1. Implement fix in Rust backend (core blocker)
2. Add `autoExecutePrompt` config field + settings toggle
3. Wire autoExecute through daemon and Tauri paths
4. Full clean build (Rust + Frontend)
5. Test with Ghostty, Terminal.app, iTerm2
6. Bump version, commit, let post-commit hook build DMG

## Open Questions

None currently; scope is well-defined from investigation.
