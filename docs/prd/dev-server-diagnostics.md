---
title: "Dev Server Diagnostic Error Reporting"
created: 2026-02-24
status: draft
tags: [dev-server, error-handling, diagnostics, ai-assist]
---

# PRD: Dev Server Diagnostic Error Reporting

## Problem

When the dev server fails to connect, ViboGit shows "Failed" with a generic message and a Retry button. The user has no idea what went wrong or what to do about it.

The Rust backend already captures stdout/stderr logs (up to 200 lines) and knows whether the process is alive and whether the port is listening. None of this information reaches the error UI. A 30-second timeout is the catch-all for most failures -- wrong port, missing dependencies, crashed process, slow startup -- and they all look identical to the user.

The target user is a solo developer who may not be deeply technical. They need clear, jargon-free explanations and runnable fix commands, not raw log output.

## Goals and success metrics

| Goal | Metric | Target |
|------|--------|--------|
| Reduce user confusion on failure | % of failures that show a specific diagnosis (not "unknown") | > 80% |
| Speed up recovery | Time from failure to successful connection (manual observation) | < 60s for common issues |
| Reduce support questions about dev server | Support tickets / Discord questions mentioning dev server | 50% reduction |

## User stories

1. **As a developer**, when my dev server fails to start, I want to see what went wrong so I can fix it without opening a terminal.
2. **As a developer**, when the fix is a single command (like `bun install`), I want to run it directly from the error card.
3. **As a developer with an AI key configured**, I want the option to have AI analyze my server logs and suggest a fix when the standard diagnostics aren't enough.
4. **As a developer**, I want to see the last few log lines from the failed server without having to find and open the logs tab.

## Current behavior

```
User clicks Connect
        |
        v
App spawns `bun run dev`, sets PORT env var
        |
        v
Polls devServerState every 1s (checks process alive + TCP port connect)
        |
        +-- Both pass within 30s --> "Connected" (green)
        |
        +-- Timeout 30s ----------> "Failed" + generic message + [Retry]
        |
        +-- Spawn exception ------> "Failed to connect" + generic message
```

The only case with a useful error today is when both `bun` and the fallback (`npm`) fail to spawn -- the Rust error message includes the command names.

## Proposed behavior

```
User clicks Connect
        |
        v
App spawns dev server, polls for 30s
        |
        +-- Success --> "Connected" (green) [no change]
        |
        +-- Failure --> Auto-run devServerDiagnose
                            |
                            v
                  +---------------------+
                  | Inline Diagnostic   |
                  | Card                |
                  |                     |
                  | [!] Missing deps    |
                  |                     |
                  | Run `bun install`   |
                  | in your project     |
                  |                     |
                  | [Run bun install]   |
                  | [Fix with AI]       |
                  | [Show logs v]       |
                  | [Retry]             |
                  +---------------------+
```

## Requirements

### Functional

#### R1: Rust diagnostic command (must-have)

New Tauri command `dev_server_diagnose` that takes a repo path and port, performs checks, and returns structured diagnostics.

**Checks performed (in priority order, first match wins):**

| Code | Detection method | Problem (shown to user) | Suggested command |
|------|-----------------|------------------------|-------------------|
| `no_package_json` | `package.json` missing at path | "No package.json found in this directory" | -- |
| `no_dev_script` | package.json exists, no "dev" script | "No 'dev' script found in package.json" | -- |
| `no_node_modules` | `node_modules/` directory missing | "Dependencies aren't installed yet" | `bun install` |
| `command_not_found` | Process dead + logs empty or contain "ENOENT"/"not found" | "Couldn't find '{cmd}' on your system" | -- |
| `port_in_use` | Logs contain "EADDRINUSE" or "address already in use" | "Port {port} is already being used by another app" | `lsof -ti:{port} \| xargs kill` |
| `missing_deps` | Logs contain "MODULE_NOT_FOUND" or "Cannot find module" | "Some packages are missing" | `bun install` |
| `script_error` | Logs contain syntax/compile/type error patterns | "Your code has errors that crashed the server" | -- |
| `wrong_port` | Process alive, port not listening | "Server started but isn't responding on port {port}" | -- |
| `slow_start` | Process alive, port not listening, started < 45s ago | "Server is still starting up (large projects can take a while)" | -- |
| `process_crashed` | Process dead, has logs, no pattern matched | "The dev server stopped unexpectedly" | -- |
| `unknown` | Fallback | "Something went wrong" | -- |

Additional filesystem checks run regardless of process state: `node_modules` existence, `package.json` existence, dev script existence, command on PATH.

**Return type:**

```rust
pub struct DevServerDiagnosis {
    pub process_alive: bool,
    pub port_listening: bool,
    pub last_logs: Vec<String>,           // last 20 lines
    pub problem: String,                  // user-facing problem text
    pub suggestion: String,               // user-facing fix suggestion
    pub suggested_command: Option<String>, // runnable command, if applicable
    pub diagnosis_code: String,           // machine-readable key
}
```

#### R2: Auto-diagnose on failure (must-have)

When `dev-server-connection.tsx` status transitions to `"error"` (timeout or exception), immediately call `devServerDiagnose`. Store the result in component state. No user action required.

#### R3: Inline diagnostic card (must-have)

Replaces the current generic error row. Renders below the toolbar error indicator.

```
+----------------------------------------------------------+
| [!] Dependencies aren't installed yet            [Retry] |
|                                                          |
|  Run `bun install` in your project directory to          |
|  install the packages your app needs.                    |
|                                                          |
|  [Run `bun install`]  [Fix with AI]    [Show logs v]    |
|                                                          |
|  (expanded logs, if toggled)                             |
|  [15:32:01] Error: Cannot find module 'react'            |
|  [15:32:01]     at Module._resolveFilename ...           |
|  [15:32:02] Process exited with code 1                   |
|                                                  [Copy]  |
+----------------------------------------------------------+
```

**Card elements:**
- Problem text as the primary heading (replaces "Failed")
- Suggestion as body text, written for non-technical users
- "Run {command}" button when `suggestedCommand` exists -- sends to terminal via existing `sendToTerminal`
- "Fix with AI" button -- only visible when `getSettings().aiApiKey` is set
- Collapsible log tail (last 20 lines) with Copy button
- Retry button (existing behavior)

#### R4: Run command in terminal (must-have)

When the user clicks "Run {command}", send the command to their configured terminal via the existing `sendToTerminal` daemon command. Respect the `autoExecutePrompt` setting.

#### R5: AI-assisted diagnosis (must-have)

When the user clicks "Fix with AI":

1. New Rust command `ai_diagnose_dev_server` (same pattern as existing `ai_generate_commit`) sends a prompt to the configured provider with:
   - Project path
   - Command and args that were run
   - Port number
   - Diagnosis code and problem text
   - Last 20 log lines

2. Prompt asks for runnable fix command(s) only, no explanation.

3. Response displays inline below the diagnostic card:

```
+------------------------------------------+
| AI Suggestion                            |
|                                          |
|  rm -rf node_modules && bun install      |
|                                          |
|  [Run in Terminal]          [Dismiss]    |
+------------------------------------------+
```

4. "Run in Terminal" sends via `sendToTerminal`.
5. If no AI key is configured, the button is hidden (not disabled).
6. If the AI call fails, show a toast error and keep the standard diagnostics visible.

### Non-functional

- Diagnosis command should complete in < 500ms (filesystem checks + log parsing only, no network calls)
- Log pattern matching uses simple string contains, not regex, for speed
- Card should not shift layout of other toolbar elements when it appears
- AI diagnosis respects the user's configured provider and model from settings

## Technical considerations

### Files affected

| File | Change |
|------|--------|
| `apps/desktop/src-tauri/src/commands.rs` | Add `DevServerDiagnosis` struct, `dev_server_diagnose` fn, `ai_diagnose_dev_server` fn |
| `apps/desktop/src-tauri/src/lib.rs` | Register both new commands |
| `packages/shared/src/types.ts` | Add `DevServerDiagnosis` TypeScript interface |
| `packages/ui/src/lib/daemon-context.tsx` | Add `devServerDiagnose` and `aiDiagnoseDevServer` case mappings |
| `packages/ui/src/components/dev-server-connection.tsx` | Auto-diagnose on failure, diagnostic card, AI fix button, run-command button |

### Dependencies

- No new crates or npm packages required
- AI diagnosis reuses the existing AI provider infrastructure (`ai_generate_commit` pattern)
- Terminal command execution reuses existing `sendToTerminal` infrastructure

### Architecture

```
[dev-server-connection.tsx]
        |
        | (on failure)
        v
[daemon-context.tsx] -- "devServerDiagnose" --> [Tauri invoke]
        |                                             |
        v                                             v
[Diagnostic Card UI]                    [dev_server_diagnose (Rust)]
        |                                    |
        | (Fix with AI clicked)              | checks: process, port,
        v                                    | filesystem, log patterns
[daemon-context.tsx] -- "aiDiagnose" --> [ai_diagnose_dev_server (Rust)]
        |                                    |
        v                                    | calls LLM API
[AI Suggestion Card]                         | returns commands
```

## Risks and mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Log pattern matching misidentifies the problem | User gets wrong suggestion | Order checks by specificity; show logs so user can see for themselves |
| AI suggests a destructive command (e.g., `rm -rf`) | Data loss | Show command before running; never auto-execute AI suggestions regardless of `autoExecutePrompt` setting |
| Diagnosis adds delay to the failure experience | User waits longer | Diagnosis runs in < 500ms (local checks only); show card progressively |
| Too many diagnosis codes make the UI confusing | User overwhelmed | Each code has one clear problem + one clear suggestion; no jargon |

## Open questions

1. Should the diagnostic card persist after the user clicks Retry, or reset?
2. Should we track which diagnosis codes appear most often (anonymous telemetry) to improve pattern matching over time?
3. Should the AI "Fix with AI" button have a loading state that shows what the AI is thinking, or just a spinner?
