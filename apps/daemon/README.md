# vibogit-daemon

Local daemon for [ViboGit](https://vibogit.com) - a web-based Git client.

## Quick Start

```bash
bunx vibogit-daemon
```

Then open: https://vibogit.com

## Installation

### Using bunx (recommended)

```bash
bunx vibogit-daemon
```

### Global install

```bash
bun add -g vibogit-daemon
vibogit-daemon
```

> **Note:** This package requires [Bun](https://bun.sh) runtime. `npx` is not supported.

## Requirements

- [Bun](https://bun.sh) runtime (v1.0.0 or later)
- macOS (for folder picker and system integration features)

## Configuration

You can configure the dev server port in your project's `agents.md` file:

```markdown
## Development
- Dev server port: 3000
- Run dev: `bun run dev`
```

The daemon will read this port and display it in the ViboGit UI.

## Usage

Start the daemon:

```bash
vibogit-daemon
```

The daemon starts a WebSocket server on port 9111 by default.

### Environment Variables

- `PORT` - WebSocket server port (default: 9111)

## Features

- Git operations (status, commit, push, pull, branch management)
- File system watching for auto-refresh
- Native macOS folder picker
- Dev server management with port configuration
- System integration (open in Finder, Terminal, Editor)
- **Connection indicator** in web app shows real-time daemon status

## API

The daemon communicates via WebSocket messages. See the [documentation](https://github.com/simonbloom/vibogit) for the full API reference.

## Troubleshooting

### Port 9111 already in use

```bash
lsof -ti:9111 | xargs kill -9
```

Then restart the daemon.

### Bun not found

Install Bun first:

```bash
curl -fsSL https://bun.sh/install | bash
```

Then restart your terminal and try again.

### Connection keeps dropping

1. Check if the daemon is still running in your terminal
2. Look for error messages in the daemon output
3. Try restarting the daemon
4. Use the "Retry Connection" button in the web app

### Web app shows "Disconnected"

The web app has a connection indicator in the top-right corner:
- 🟢 Green = Connected
- 🟡 Yellow = Connecting
- 🔴 Red = Disconnected (click "Reconnect" to retry)

## License

MIT
