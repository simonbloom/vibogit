# Homebrew Tap for ViboGit

This is the official Homebrew tap for [ViboGit](https://vibogit.app).

## Installation

```bash
brew tap vibogit/tap
brew install --cask vibogit
```

Or directly:

```bash
brew install --cask vibogit/tap/vibogit
```

## Updating

```bash
brew upgrade --cask vibogit
```

## Uninstalling

```bash
brew uninstall --cask vibogit
```

## About ViboGit

ViboGit is a beautiful, simple Git client designed for developers who want to focus on building, not managing git commands.

### Features

- ⚡ One-click save (stage + commit)
- 🚀 One-click ship (push to remote)
- 🔄 Auto-sync with visual diff
- 📊 Beautiful timeline view
- 🖥️ Native system tray
- ⌨️ Keyboard shortcuts
- 🔔 Native notifications
- 🔄 Automatic updates

## Links

- [Website](https://vibogit.app)
- [GitHub](https://github.com/vibogit/vibogit)
- [Download](https://vibogit.app/download)

## Publishing Updates

To update the cask after a new release:

1. Download the new DMG
2. Calculate SHA256: `shasum -a 256 ViboGit_*.dmg`
3. Update `Casks/vibogit.rb`:
   - Update `version`
   - Update `sha256`
4. Test: `brew install --cask ./Casks/vibogit.rb`
5. Commit and push

### Automated Updates

Use GitHub Actions to automatically update the cask on new releases:

```yaml
# .github/workflows/update-cask.yml
name: Update Homebrew Cask
on:
  release:
    types: [published]
jobs:
  update:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - name: Update cask
        run: |
          VERSION="${{ github.event.release.tag_name }}"
          VERSION="${VERSION#v}"
          DMG_URL="https://github.com/vibogit/vibogit/releases/download/v${VERSION}/ViboGit_${VERSION}_aarch64.dmg"
          curl -L -o vibogit.dmg "$DMG_URL"
          SHA256=$(shasum -a 256 vibogit.dmg | cut -d ' ' -f1)
          sed -i '' "s/version \".*\"/version \"${VERSION}\"/" Casks/vibogit.rb
          sed -i '' "s/sha256 \".*\"/sha256 \"${SHA256}\"/" Casks/vibogit.rb
      - name: Commit and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add Casks/vibogit.rb
          git commit -m "Update vibogit to ${{ github.event.release.tag_name }}"
          git push
```
