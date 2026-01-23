# Homebrew Formula for ViboGit

## Installation

### Tap the repository

```bash
brew tap simonbloom/tap
brew install vibogit
```

### Or install directly

```bash
brew install simonbloom/tap/vibogit
```

## Usage

### Start the daemon manually

```bash
vibogit-daemon
```

### Run as a service (background)

```bash
# Start
brew services start vibogit

# Stop
brew services stop vibogit

# Restart
brew services restart vibogit
```

## Setting up your own tap

1. Create a repository named `homebrew-tap`
2. Copy the `vibogit.rb` formula to `Formula/vibogit.rb`
3. Update the `sha256` hash after creating a release:
   ```bash
   shasum -a 256 vibogit-0.1.0.tar.gz
   ```
4. Push to GitHub

## Requirements

- Bun runtime (installed automatically as a dependency)
- macOS (for system integration features)
