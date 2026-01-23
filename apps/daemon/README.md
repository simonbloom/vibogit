# vibogit-daemon

Local daemon for [ViboGit](https://vibogit.app) - a web-based Git client.

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

### Using npm/npx

```bash
npx vibogit-daemon
```

## Requirements

- [Bun](https://bun.sh) runtime (v1.0.0 or later)
- macOS (for folder picker and system integration features)

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
- Dev server management
- System integration (open in Finder, Terminal, Editor)

## API

The daemon communicates via WebSocket messages. See the [documentation](https://github.com/simonbloom/vibogit) for the full API reference.

## License

MIT
