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
