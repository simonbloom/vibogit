# User Testing

Testing surface: tools, URLs, setup steps, isolation notes, known quirks.

**What belongs here:** How to manually test features, what URLs to visit, account/fixture setup.

---

## Testing Surface
- **Frontend dev server:** `http://localhost:4158` (start with `cd apps/desktop/frontend && bun run dev`)
- **Browser mode:** UI renders without Tauri, but git operations and Tauri commands won't function
- **Tauri dev mode:** `cd apps/desktop && bun run dev` (full app with Rust backend)

## What Can Be Tested in Browser Mode
- Settings UI: provider dropdown, API key fields, toggle states, navigation
- Sync Beacon UI: settings section layout, remote machines panel layout
- Component rendering, styling, responsive layout

## What Requires Tauri / Cargo Tests
- Git push/pull operations (smart push logic)
- AI commit/PR generation (requires Tauri invoke)
- Sync beacon Gist operations (requires Tauri invoke)
- These are verified via `cargo test` in `apps/desktop/src-tauri`

## Known Quirks
- Frontend in browser shows "not connected" states for Tauri-dependent features
- `isTauri()` check uses `window.__TAURI__` detection


## Validation Concurrency
- **web-ui**: max concurrent validators `2` on this machine. Browser/UI checks are light enough to run in parallel given 64 GB RAM, but keep at most two sessions to avoid port contention and flaky timing around dev-server startup.
- **tauri-rust-cli**: max concurrent validators `1`. Assertions that rely on real Tauri invoke behavior, local git repos, or cargo-backed flows should be serialized to avoid shared-state interference and contention around local config, git fixtures, and desktop runtime assumptions.

## Flow Validator Guidance: web-ui
- Use the shared frontend dev server at `http://localhost:4158`.
- Stay in browser-only scope: verify navigation, rendering, DOM state, persistence via localStorage, and visible error/loading states that do not require a real Tauri backend.
- Do not mutate global repo state or rely on git operations succeeding in browser mode.
- Each validator should keep its own browser session and only touch localStorage/sessionStorage for its assigned assertions.

## Flow Validator Guidance: tauri-rust-cli
- Prefer source inspection plus existing automated verification (`bun run typecheck`, `cargo test`) for backend-backed assertions.
- If you create temporary git fixtures, keep them under a unique temp directory and clean them up.
- Do not modify `~/.vibogit` or real user repos unless the assigned assertion explicitly requires persisted config behavior; prefer isolated temp config when possible.
- Serialize validators on this surface because assertions may touch shared local config and gh auth state.
