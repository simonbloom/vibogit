# Environment

Environment variables, external dependencies, and setup notes.

**What belongs here:** Required env vars, external API keys/services, dependency quirks, platform-specific notes.
**What does NOT belong here:** Service ports/commands (use `.factory/services.yaml`).

---

## Dependencies
- **bun** - Package manager and script runner
- **Rust/Cargo** - Backend compilation (rustc 1.93.0)
- **gh CLI** - GitHub CLI for Gist operations (v2.83.2)
- **Next.js 15** - Frontend framework (static export mode for Tauri)
- **Tauri 2.x** - Desktop app framework

## Notes
- `next.config.js` sets `typescript: { ignoreBuildErrors: true }` -- always run `bun run typecheck` separately
- No JS/TS test framework is installed; only Rust tests exist
- The app runs in two modes: Tauri desktop (full functionality) and browser (UI only, no git ops)
