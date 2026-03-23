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
