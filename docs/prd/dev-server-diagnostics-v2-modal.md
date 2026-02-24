---
title: "Dev Server Diagnostics v2 - Modal Redesign"
created: 2026-02-24
status: draft
tags: [dev-server, error-handling, diagnostics, modal, ux]
---

# PRD: Dev Server Diagnostics v2 - Modal Redesign

## Problem

The v1 diagnostic card (shipped in 3.7.6) works but has UX issues:

1. **Inline card is cramped.** The toolbar area doesn't give enough room to show the problem, suggestion, logs, and AI prompt. Everything is squeezed into a max-w-[400px] box.
2. **"Fix with AI" button calls the LLM directly** but fails silently when the API call doesn't work. Users expected to see a prompt they could copy and paste into their own AI tool.
3. **No way to see the full picture at a glance.** The logs are collapsed, the AI suggestion is hidden behind a button, and the user has to click multiple things to understand what happened.

## Goal

Replace the inline diagnostic card with a modal that gives the user room to see everything: the problem, the suggestion, the server logs, and a pre-built AI prompt they can copy. The inline error indicator stays slim and clickable.

## User stories

1. **As a developer**, when my dev server fails, I want to click the error to see a full diagnostic view with enough space to read logs and understand the problem.
2. **As a developer**, I want a ready-made prompt I can copy into ChatGPT/Claude/Cursor to get help fixing the issue.
3. **As a developer**, I want to run a suggested fix command directly from the diagnostic view.

## Design

### Inline error indicator (toolbar)

Stays slim. Shows problem text + Retry. Clicking anywhere on it opens the modal.

```
+------------------------------------------------------------------+
|  [!] Couldn't find the dev command on your system   [Retry]      |
+------------------------------------------------------------------+
      ^                                                   ^
      |                                                   |
      +-- clicking anywhere here opens modal              +-- retry
          (except the Retry button itself)                    stays
                                                             inline
```

### Diagnostic modal

Opens on click of the inline error. Full-width modal (max-w-lg / ~550px) with all diagnostic info.

```
+--------------------------------------------------------------+
|                                                              |
|  (dark backdrop, click to close)                             |
|                                                              |
|  +--------------------------------------------------------+  |
|  |                                                        |  |
|  |  Dev Server Error                              [ X ]   |  |
|  |                                                        |  |
|  |  +--------------------------------------------------+  |  |
|  |  |  [!]  Couldn't find the dev command              |  |  |
|  |  |       on your system                             |  |  |
|  |  +--------------------------------------------------+  |  |
|  |                                                        |  |
|  |  What happened                                         |  |
|  |  ------------------------------------------------      |  |
|  |  Make sure your package manager (bun, npm, etc.)       |  |
|  |  is installed and available in your PATH.              |  |
|  |                                                        |  |
|  |  +--------------------------------------------------+  |  |
|  |  |  [>] Suggested fix                               |  |  |
|  |  |                                                  |  |  |
|  |  |  $ bun install                                   |  |  |
|  |  |                                                  |  |  |
|  |  |              [Run in Terminal]                    |  |  |
|  |  +--------------------------------------------------+  |  |
|  |                                                        |  |
|  |  Server logs                                           |  |
|  |  ------------------------------------------------      |  |
|  |  +--------------------------------------------------+  |  |
|  |  | [15:32:01] > bun run dev                         |  |  |
|  |  | [15:32:01] sh: bun: command not found            |  |  |
|  |  | [15:32:02] error: spawn ENOENT                   |  |  |
|  |  |                                                  |  |  |
|  |  |                                                  |  |  |
|  |  |                                          [Copy]  |  |  |
|  |  +--------------------------------------------------+  |  |
|  |                                                        |  |
|  |  Ask AI for help                                       |  |
|  |  ------------------------------------------------      |  |
|  |  +--------------------------------------------------+  |  |
|  |  | My dev server failed to start.                   |  |  |
|  |  |                                                  |  |  |
|  |  | - Command: bun run dev                           |  |  |
|  |  | - Port: 4158                                     |  |  |
|  |  | - Error: Couldn't find the dev command           |  |  |
|  |  |   on your system                                 |  |  |
|  |  |                                                  |  |  |
|  |  | Last logs:                                       |  |  |
|  |  | [15:32:01] sh: bun: command not found            |  |  |
|  |  | [15:32:02] error: spawn ENOENT                   |  |  |
|  |  |                                                  |  |  |
|  |  | What terminal command(s) should I run            |  |  |
|  |  | to fix this?                                     |  |  |
|  |  +--------------------------------------------------+  |  |
|  |  [Copy prompt]                                         |  |
|  |                                                        |  |
|  |                                                        |  |
|  |                        [Retry Connection]   [Close]    |  |
|  |                                                        |  |
|  +--------------------------------------------------------+  |
|                                                              |
+--------------------------------------------------------------+
```

### Sections breakdown

#### 1. Header
```
+--------------------------------------------------------+
|  Dev Server Error                              [ X ]   |
+--------------------------------------------------------+
```
- Title: "Dev Server Error"
- X button to close

#### 2. Problem banner
```
+--------------------------------------------------+
|  [!]  Couldn't find the dev command              |
|       on your system                             |
+--------------------------------------------------+
```
- Red/destructive background tint
- AlertTriangle icon
- `diagnosis.problem` text
- Prominent, first thing the user sees

#### 3. What happened (suggestion)
```
  What happened
  ------------------------------------------------
  Make sure your package manager (bun, npm, etc.)
  is installed and available in your PATH.
```
- Section heading "What happened"
- `diagnosis.suggestion` text
- Plain text, muted foreground

#### 4. Suggested fix (conditional)
Only shows when `diagnosis.suggestedCommand` is set.
```
+--------------------------------------------------+
|  [>] Suggested fix                               |
|                                                  |
|  $ bun install                                   |
|                                                  |
|              [Run in Terminal]                    |
+--------------------------------------------------+
```
- Styled card with slight bg tint
- Command shown in monospace with `$` prefix
- "Run in Terminal" button sends via `sendToTerminal`

#### 5. Server logs
```
  Server logs
  ------------------------------------------------
  +--------------------------------------------------+
  | [15:32:01] > bun run dev                         |
  | [15:32:01] sh: bun: command not found            |
  | [15:32:02] error: spawn ENOENT                   |
  |                                                  |
  |                                          [Copy]  |
  +--------------------------------------------------+
```
- Terminal-style viewer: dark bg (#1e1e1e), monospace, scrollable
- Max height ~200px with overflow scroll
- Copy button copies all log lines
- Shows `diagnosis.lastLogs`
- Hidden if no logs available

#### 6. Ask AI for help (prompt)
```
  Ask AI for help
  ------------------------------------------------
  +--------------------------------------------------+
  | My dev server failed to start.                   |
  |                                                  |
  | - Command: bun run dev                           |
  | - Port: 4158                                     |
  | - Error: Couldn't find the dev command           |
  |   on your system                                 |
  |                                                  |
  | Last logs:                                       |
  | [15:32:01] sh: bun: command not found            |
  | [15:32:02] error: spawn ENOENT                   |
  |                                                  |
  | What terminal command(s) should I run            |
  | to fix this?                                     |
  +--------------------------------------------------+
  [Copy prompt]
```
- Pre-built prompt in a bordered box, muted bg, monospace
- Includes: command, port, diagnosis problem, log tail
- "Copy prompt" button below the box
- Always shown (no API key required -- the user pastes it into their own AI)

#### 7. Footer
```
                        [Retry Connection]   [Close]
```
- "Retry Connection" calls handleConnect and closes modal
- "Close" dismisses the modal

### Example: Missing dependencies
```
+--------------------------------------------------------+
|  Dev Server Error                              [ X ]   |
|                                                        |
|  +--------------------------------------------------+  |
|  |  [!]  Dependencies aren't installed yet           |  |
|  +--------------------------------------------------+  |
|                                                        |
|  What happened                                         |
|  ------------------------------------------------      |
|  Run bun install in your project directory to          |
|  install the packages your app needs.                  |
|                                                        |
|  +--------------------------------------------------+  |
|  |  [>] Suggested fix                               |  |
|  |                                                  |  |
|  |  $ bun install                                   |  |
|  |                                                  |  |
|  |              [Run in Terminal]                    |  |
|  +--------------------------------------------------+  |
|                                                        |
|  Server logs                                           |
|  ------------------------------------------------      |
|  +--------------------------------------------------+  |
|  | [15:32:01] > bun run dev                         |  |
|  | [15:32:01] Error: Cannot find module 'react'     |  |
|  | [15:32:01]     at Module._resolveFilename ...    |  |
|  | [15:32:02] Process exited with code 1            |  |
|  |                                          [Copy]  |  |
|  +--------------------------------------------------+  |
|                                                        |
|  Ask AI for help                                       |
|  ------------------------------------------------      |
|  +--------------------------------------------------+  |
|  | My dev server failed to start.                   |  |
|  |                                                  |  |
|  | - Command: bun run dev                           |  |
|  | - Port: 4158                                     |  |
|  | - Error: Dependencies aren't installed yet       |  |
|  |                                                  |  |
|  | Last logs:                                       |  |
|  | Error: Cannot find module 'react'                |  |
|  |     at Module._resolveFilename ...               |  |
|  | Process exited with code 1                       |  |
|  |                                                  |  |
|  | What terminal command(s) should I run            |  |
|  | to fix this?                                     |  |
|  +--------------------------------------------------+  |
|  [Copy prompt]                                         |
|                                                        |
|                        [Retry Connection]   [Close]    |
+--------------------------------------------------------+
```

### Example: No logs, no suggested command
```
+--------------------------------------------------------+
|  Dev Server Error                              [ X ]   |
|                                                        |
|  +--------------------------------------------------+  |
|  |  [!]  No package.json found in this directory     |  |
|  +--------------------------------------------------+  |
|                                                        |
|  What happened                                         |
|  ------------------------------------------------      |
|  Make sure you've opened the correct project folder.   |
|  This directory doesn't appear to be a Node.js         |
|  project.                                              |
|                                                        |
|  (no suggested fix section)                            |
|  (no server logs section)                              |
|                                                        |
|  Ask AI for help                                       |
|  ------------------------------------------------      |
|  +--------------------------------------------------+  |
|  | My dev server failed to start.                   |  |
|  |                                                  |  |
|  | - Command: bun run dev                           |  |
|  | - Port: 4158                                     |  |
|  | - Error: No package.json found in this           |  |
|  |   directory                                      |  |
|  |                                                  |  |
|  | What terminal command(s) should I run            |  |
|  | to fix this?                                     |  |
|  +--------------------------------------------------+  |
|  [Copy prompt]                                         |
|                                                        |
|                        [Retry Connection]   [Close]    |
+--------------------------------------------------------+
```

## Requirements

### Functional

#### R1: Slim inline error indicator (must-have)
1. Show `diagnosis.problem` text with AlertTriangle icon and Retry button
2. Clicking anywhere on the row (except Retry) opens the diagnostic modal
3. Retry button works inline without opening modal
4. Cursor changes to pointer to indicate clickability

#### R2: Diagnostic modal component (must-have)
1. New component `DiagnosticModal` with props: `isOpen`, `onClose`, `diagnosis`, `onRetry`, `onRunCommand`
2. Fixed overlay with dark backdrop (matches existing PortPromptModal pattern)
3. Max width ~550px, vertically scrollable if content overflows viewport
4. Sections: problem banner, suggestion, suggested fix, server logs, AI prompt, footer
5. Close via X button, backdrop click, Escape key, or Close button

#### R3: Problem banner (must-have)
1. Destructive/red-tinted background
2. AlertTriangle icon + `diagnosis.problem` text
3. Prominent at top of modal

#### R4: Suggested fix section (must-have, conditional)
1. Only renders when `diagnosis.suggestedCommand` is not null
2. Shows command in monospace with `$` prefix
3. "Run in Terminal" button sends to terminal via `sendToTerminal`

#### R5: Server logs viewer (must-have, conditional)
1. Only renders when `diagnosis.lastLogs` has entries
2. Terminal-style: dark bg (#1e1e1e), color (#d4d4d4), monospace font, 11px
3. Max height 200px, overflow-y scroll
4. Copy button copies all log lines to clipboard
5. Matches existing dev-server-logs.tsx styling

#### R6: AI prompt section (must-have)
1. Always shown (no API key required)
2. Pre-built prompt includes: command, port, problem text, log tail
3. Displayed in a bordered box with muted bg and monospace font
4. "Copy prompt" button below the box
5. Prompt template:
   ```
   My dev server failed to start.

   - Command: {command} {args}
   - Port: {port}
   - Error: {problem}

   Last logs:
   {lastLogs (last 10 lines)}

   What terminal command(s) should I run to fix this?
   ```

#### R7: Footer actions (must-have)
1. "Retry Connection" button: calls handleConnect, closes modal
2. "Close" button: dismisses modal

#### R8: Remove old inline card and AI auto-call (must-have)
1. Remove the inline diagnostic card (the expanded one with buttons)
2. Remove `handleAiFix` function and `ai_diagnose_dev_server` Tauri invoke call from the component
3. Remove `aiCommands`, `aiLoading` state
4. Keep the Rust `ai_diagnose_dev_server` command in place (may be useful later)

### Non-functional
- Modal should animate in (fade/scale) matching existing modal patterns
- Modal content should be vertically scrollable on small screens
- Escape key closes modal

## Technical considerations

### Files affected

| File | Change |
|------|--------|
| `packages/ui/src/components/diagnostic-modal.tsx` | **New file** - modal component |
| `packages/ui/src/components/dev-server-connection.tsx` | Replace inline card with slim indicator + modal trigger, remove AI auto-call |

### No backend changes needed
The Rust `dev_server_diagnose` command and `DevServerDiagnosis` type are unchanged. The `ai_diagnose_dev_server` command stays in place but is no longer called from the frontend.

## UX flow

```
User clicks Connect
        |
        v
App spawns dev server, polls for 30s
        |
        +-- Success --> "Connected" (green)
        |
        +-- Failure --> auto-diagnose
                            |
                            v
              +---------------------------+
              | [!] Problem text  [Retry] |  <-- inline, clickable
              +---------------------------+
                            |
                            | (user clicks)
                            v
              +---------------------------+
              |   Diagnostic Modal        |
              |                           |
              |   Problem banner          |
              |   Suggestion text         |
              |   Suggested fix + Run     |
              |   Server logs viewer      |
              |   AI prompt + Copy        |
              |                           |
              |   [Retry]  [Close]        |
              +---------------------------+
```

## Open questions

1. Should the modal auto-open on first failure, or always require a click?
2. Should we add a "Report issue" link in the modal footer?
