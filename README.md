# ViboGit

> Git for the Vibe Coder - desktop-first Git client built with Tauri

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Install

Use the latest DMG release and move `ViboGit.app` to `/Applications`.

If macOS blocks launch:

```bash
xattr -cr /Applications/ViboGit.app
```

## Development

```bash
git clone https://github.com/simonbloom/vibogit.git
cd vibogit
bun install
cd apps/desktop && bun run dev
```

## Build

```bash
bun install
cd apps/desktop/frontend && bun run build
cd ../src-tauri && cargo tauri build --bundles dmg
```

## Repository Layout

```
vibogit/
├── apps/desktop/frontend   # Next.js frontend (static export)
├── apps/desktop/src-tauri  # Rust backend + desktop bundling
├── homebrew-tap            # Homebrew cask tap for desktop app
└── packages/ui + shared    # Shared UI and types
```

## License

MIT
