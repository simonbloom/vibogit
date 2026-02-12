# ViboGit

> **Git for the Vibe Coder** - A modern web-based Git client with local daemon

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

## Quick Start

```bash
bunx vibogit-daemon
```

Then open: **https://vibogit.com**

That's it! The web app connects to your local daemon automatically.

## Installation

### Using bunx (recommended)

No installation needed - just run:

```bash
bunx vibogit-daemon
```

### Using Homebrew

```bash
brew install simonbloom/tap/vibogit
vibogit-daemon
```

To run as a background service:

```bash
brew services start vibogit
```

### Global Install

```bash
bun add -g vibogit-daemon
vibogit-daemon
```

## Features

- 🎨 **Visual Staging** - Stage files with a click, see diffs inline
- 🌿 **Branch Management** - Create, switch, and manage branches visually
- 📊 **Commit History** - Browse your commit log with a clean UI
- 🔄 **Push & Pull** - Sync with remotes without touching the terminal
- 🖥️ **Dev Server Integration** - See your dev server status and port
- 📁 **Multi-Project Tabs** - Work on multiple repos in one window
- 🔌 **Connection Indicator** - Always know if the daemon is running

## Requirements

- **[Bun](https://bun.sh)** runtime (v1.0.0 or later)
- **macOS** (for native folder picker and system integration)

### Installing Bun

```bash
curl -fsSL https://bun.sh/install | bash
```

## How It Works

ViboGit consists of two parts:

1. **Web App** (https://vibogit.com) - The UI you interact with
2. **Local Daemon** - Runs on your machine, performs Git operations

The daemon runs a WebSocket server on port 9111. The web app connects to it to execute Git commands on your local repos.

## Need Help Setting Up?

Copy this prompt and paste it into Claude, ChatGPT, or your favorite AI:

```
Help me set up ViboGit on my Mac. Please:

1. Check if Bun is installed (run: bun --version)
2. If not installed, install Bun (run: curl -fsSL https://bun.sh/install | bash)
3. Start the ViboGit daemon (run: bunx vibogit-daemon)
4. Keep the daemon running and tell me when it says "WebSocket server running"
5. Then I can open https://vibogit.com in my browser

If you encounter any errors, help me troubleshoot. Common issues:
- Port 9111 in use: run "lsof -ti:9111 | xargs kill -9" first
- Permission errors: may need to restart terminal after Bun install
```

## Development

This is a monorepo managed with Turborepo:

```
vibogit/
├── apps/
│   ├── web/          # Next.js 15 web application
│   └── daemon/       # Bun-based local daemon
├── packages/
│   └── shared/       # Shared TypeScript types
└── homebrew/         # Homebrew formula
```

### Setup

```bash
# Clone the repo
git clone https://github.com/simonbloom/vibogit.git
cd vibogit

# Install dependencies
bun install

# Start development
bun run dev
```

### Commands

| Command | Description |
|---------|-------------|
| `bun run dev` | Start all apps in development mode |
| `bun run build` | Build all apps |
| `bun run typecheck` | Run TypeScript checks |

## Troubleshooting

### macOS "Apple could not verify" warning

When opening the desktop app for the first time, macOS may block it. Run this command to allow it:

```bash
xattr -cr /Applications/ViboGit.app
```

### Port 9111 already in use

```bash
lsof -ti:9111 | xargs kill -9
```

### Bun not found

Install Bun first:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart your terminal.

### Connection keeps dropping

Check if the daemon is still running. Look for error messages in the terminal where you started it.

## License

MIT
