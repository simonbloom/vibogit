# ViboGit Agent Configuration

## Package Manager
- Use `bun` for all package management and running scripts
- Use `bun install` instead of `npm install` or `pnpm install`
- Use `bun run <script>` instead of `npm run` or `pnpm run`
- Use `bun add <package>` to add dependencies

## Development
- Dev server port: 3002
- Run dev: `bun run dev` (from `apps/desktop/frontend`)
- Build: `bun run build`
- Typecheck: `bun run typecheck`
- Daemon: `bun run dev` (from `apps/daemon`, runs on ws://localhost:9111)

## Monorepo Structure
- `/apps/web` - Next.js 15 web application (Vercel deployment)
- `/apps/desktop/frontend` - Next.js 15 frontend (static export for Tauri)
- `/apps/desktop/src-tauri` - Tauri 2.x Rust backend
- `/apps/daemon` - Bun-based local daemon (WebSocket server on port 9111)
- `/packages/shared` - Shared TypeScript types
- `/packages/ui` - Shared UI components, lib, and styles (imported as `@vibogit/ui`)

## Desktop App (Tauri) Build - CRITICAL

The desktop DMG is built automatically via a git post-commit hook (`.git/hooks/post-commit`).

### How the build works
1. `bun install` - links workspace packages (especially `@vibogit/ui`)
2. `bun run build` (frontend) - Next.js static export to `apps/desktop/frontend/out/`
3. `cargo tauri build --bundles dmg` - compiles Rust backend + bundles frontend into DMG

### DMG Location
`apps/desktop/src-tauri/target/release/bundle/dmg/ViboGit_0.1.0_aarch64.dmg`

### Build Log
`/tmp/vibogit-build.log` - watch with `tail -f /tmp/vibogit-build.log`

### CRITICAL: Ensuring the DMG has the latest code
The DMG includes TWO codebases that BOTH must be rebuilt from clean:
1. **Frontend (TypeScript/React)** - compiled by Next.js into `out/`
2. **Backend (Rust)** - compiled by Cargo into `target/release/vibogit`

If you only clean the frontend, Cargo will reuse its cached Rust binary and the DMG
will ship old backend code. If you only clean the bundle directory, both may be stale.

**You MUST clean ALL of these before building:**
```bash
# Frontend
rm -rf apps/desktop/frontend/.next
rm -rf apps/desktop/frontend/out

# Rust binary + incremental cache + fingerprints
rm -f  apps/desktop/src-tauri/target/release/vibogit
rm -f  apps/desktop/src-tauri/target/release/vibogit.d
rm -rf apps/desktop/src-tauri/target/release/.fingerprint/vibogit-*
rm -rf apps/desktop/src-tauri/target/release/incremental/vibogit-*

# Bundle/DMG packaging
rm -rf apps/desktop/src-tauri/target/release/bundle
```

The post-commit hook does all of this automatically. If you ever need to build manually:
```bash
# Full clean build
cd /path/to/vibogit
rm -rf apps/desktop/frontend/.next apps/desktop/frontend/out
rm -f  apps/desktop/src-tauri/target/release/vibogit
rm -rf apps/desktop/src-tauri/target/release/.fingerprint/vibogit-*
rm -rf apps/desktop/src-tauri/target/release/incremental/vibogit-*
rm -rf apps/desktop/src-tauri/target/release/bundle
bun install
cd apps/desktop/frontend && bun run build && cd ../../..
cd apps/desktop/src-tauri && cargo tauri build --bundles dmg
```

### Architecture: Desktop vs Web
- **Web app** (`apps/web`): connects to daemon via WebSocket. Uses daemon for all git operations.
- **Desktop app** (`apps/desktop`): in Tauri mode, uses Rust `invoke()` for git operations (NOT the daemon). The daemon is only used as fallback in browser dev mode.
- The Rust backend (`src-tauri/src/git.rs`) has its own git implementation using the `git2` crate.
- The frontend `tauriSend()` function in `packages/ui/src/lib/daemon-context.tsx` maps daemon message types to Tauri Rust commands.
- **Any change to Rust code (git.rs, commands.rs, etc.) requires a Rust recompile to appear in the DMG.**

### Common pitfalls
1. **Stale Rust binary**: Cargo incremental compilation may not detect changes if fingerprints are cached. Always clean the binary.
2. **Missing workspace links**: If `@vibogit/ui` imports fail, run `bun install` from the repo root.
3. **Tailwind classes missing in production**: The `@config` directive in `packages/ui/src/index.css` points to `packages/ui/tailwind.config.ts` for content scanning.
4. **`@/` path aliases**: The UI package uses `@/` aliases resolved via webpack config in `next.config.js` (desktop) and `next.config.mjs` (web). These map `@/components`, `@/lib`, `@/providers` to `packages/ui/src/`.

### macOS Gatekeeper (unsigned app warning)
When distributing the DMG to other machines, macOS will block the app with "Apple could not verify" warning. To bypass this, run:
```bash
# After copying to Applications
xattr -cr /Applications/ViboGit.app

# Or on the DMG before opening
xattr -cr /path/to/ViboGit_0.1.0_aarch64.dmg
```


