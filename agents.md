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

## Monorepo Structure
- `/apps/desktop/frontend` - Next.js 15 frontend (static export for Tauri)
- `/apps/desktop/src-tauri` - Tauri 2.x Rust backend
- `/packages/shared` - Shared TypeScript types
- `/packages/ui` - Shared UI components, lib, and styles (imported as `@vibogit/ui`)

## Desktop App (Tauri) Build - CRITICAL

The desktop DMG is built manually using the local Tauri CLI.

### How the build works
1. `bun install` - links workspace packages (especially `@vibogit/ui`)
2. `bun run build` (frontend) - Next.js static export to `apps/desktop/frontend/out/`
3. `cd apps/desktop && node_modules/.bin/tauri build --bundles dmg` - compiles Rust backend + bundles frontend into DMG

### DMG Location
`apps/desktop/src-tauri/target/release/bundle/dmg/ViboGit_<version>_aarch64.dmg`

### Build Log
No automatic build log file is created. If needed, capture one manually:
`cd apps/desktop && node_modules/.bin/tauri build --bundles dmg | tee /tmp/vibogit-build.log`

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

Use this full clean build flow when cutting a DMG:
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
cd apps/desktop && node_modules/.bin/tauri build --bundles dmg
```

### Architecture: Desktop
- **Desktop app** (`apps/desktop`): uses Tauri Rust `invoke()` commands for git operations and local integrations.
- The Rust backend (`src-tauri/src/git.rs`) has its own git implementation using the `git2` crate.
- The frontend command bridge in `packages/ui/src/lib/daemon-context.tsx` maps UI actions to Tauri Rust commands.
- **Any change to Rust code (git.rs, commands.rs, etc.) requires a Rust recompile to appear in the DMG.**

### Common pitfalls
1. **Stale Rust binary**: Cargo incremental compilation may not detect changes if fingerprints are cached. Always clean the binary.
2. **Missing workspace links**: If `@vibogit/ui` imports fail, run `bun install` from the repo root.
3. **Tailwind classes missing in production**: The `@config` directive in `packages/ui/src/index.css` points to `packages/ui/tailwind.config.ts` for content scanning.
4. **`@/` path aliases**: The UI package uses `@/` aliases resolved via webpack config in `apps/desktop/frontend/next.config.js`. These map `@/components`, `@/lib`, `@/providers` to `packages/ui/src/`.

### macOS Gatekeeper (unsigned app warning)
When distributing the DMG to other machines, macOS will block the app with "Apple could not verify" warning. To bypass this, run:
```bash
# After copying to Applications
xattr -cr /Applications/ViboGit.app

# Or on the DMG before opening
xattr -cr /path/to/ViboGit_<version>_aarch64.dmg
```


