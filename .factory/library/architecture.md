# Architecture

Architectural decisions, patterns discovered, and structural notes.

**What belongs here:** Component patterns, data flow, Tauri command registration, state management.

---

## Command Flow
Frontend Component -> `send(action)` -> `daemon-context.tsx` switch -> `tauriInvoke(command)` -> Rust command in `commands.rs` -> domain logic (e.g., `git.rs`)

## Settings Flow
- Frontend reads/writes via `getSettings()` / `saveSettings()` (localStorage)
- Daemon config at `~/.vibogit/config.json` via Tauri `getConfig`/`setConfig`
- Config type in `packages/shared/src/types.ts`

## AI Provider Pattern
- Providers defined in `ai-service.ts` with `AI_PROVIDERS` array
- `getModelForProvider(providerId, modelId?)` resolves model
- Rust backend dispatches to correct API based on `provider` string parameter

## Git CLI Integration Test Pattern
- For `apps/desktop/src-tauri/src/git.rs` workflows that shell out to `git`, use `tempfile` directories with a bare remote plus one or more working clones instead of mocking command output.
- First-push tests should assert both transport effects and tracking semantics after success, including a non-zero `commits_pushed` count when local commits were sent and `status.has_remote == true` once upstream tracking is established.
- Smart-push regression coverage should include at least: simple push, pull-rebase-then-push when remote is ahead, conflict-triggered rebase abort cleanup, and no-remote failure behavior.
