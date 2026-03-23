# ViboGit

> Git for the Vibe Coder - desktop-first Git client built with Tauri

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **Smart Push** — Push even when the remote has new commits. ViboGit automatically rebases your local work on top and pushes in one step. If there are conflicts, it aborts cleanly and tells you exactly what happened.
- **Simplified AI Settings** — Two providers: OpenAI (GPT 5.4) and Anthropic (Sonnet 4.6). Pick your provider, enter your API key, done. No model dropdowns or extra configuration.
- **Sync Beacon** — See your repo status across machines via a shared GitHub Gist. ViboGit periodically reports branch, ahead/behind counts, and last commit to a private Gist so you can check from anywhere whether you have unpushed work on another machine.

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
cd apps/desktop && node_modules/.bin/tauri build --bundles dmg
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
