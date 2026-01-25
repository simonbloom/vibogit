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

## API

The daemon communicates via WebSocket messages. See the [documentation](https://github.com/simonbloom/vibogit) for the full API reference.

## License

MIT
