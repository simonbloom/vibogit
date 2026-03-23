# ViboGit

> Git for the Vibe Coder - desktop-first Git client built with Tauri

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Features

- **Smart Push** — Push even when the remote has new commits. ViboGit automatically rebases your local work on top and pushes in one step. If there are conflicts, it aborts cleanly and tells you exactly what happened.
- **Simplified AI Settings** — Two providers: OpenAI (GPT 5.4) and Anthropic (Sonnet 4.6). Pick your provider, enter your API key, done. No model dropdowns or extra configuration.
- **Sync Beacon** — See your repo status across machines with a simple 6-digit pairing code. Enable the beacon and ViboGit generates a code automatically, backed by a private GitHub Gist. Share the code with your other machine, enter it there, and both machines sync branch, ahead/behind counts, and last-commit info. Requires the `gist` scope on your GitHub CLI token (`gh auth refresh -s gist` if needed).

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
