#!/bin/bash
set -e

# ViboGit macOS Build Script
# Usage: ./scripts/build-macos.sh [--sign]

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TAURI_DIR="$PROJECT_DIR/src-tauri"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║           ViboGit macOS Build                             ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Check for Rust
if ! command -v cargo &> /dev/null; then
    echo "Error: Rust is not installed. Install from https://rustup.rs"
    exit 1
fi

# Check for Tauri CLI
if ! command -v cargo-tauri &> /dev/null; then
    echo "Installing Tauri CLI..."
    cargo install tauri-cli
fi

# Parse arguments
SIGN_APP=false
for arg in "$@"; do
    case $arg in
        --sign)
            SIGN_APP=true
            shift
            ;;
    esac
done

# Build
echo ""
echo "Building ViboGit..."
cd "$TAURI_DIR"

if [ "$SIGN_APP" = true ]; then
    echo "Building with code signing..."
    
    # Check for signing identity
    if [ -z "$APPLE_SIGNING_IDENTITY" ]; then
        echo "Warning: APPLE_SIGNING_IDENTITY not set. Using ad-hoc signing."
        export APPLE_SIGNING_IDENTITY="-"
    fi
    
    cargo tauri build
else
    echo "Building without code signing (development)..."
    cargo tauri build
fi

echo ""
echo "Build complete!"
echo ""
echo "Output files:"
ls -la "$TAURI_DIR/target/release/bundle/dmg/" 2>/dev/null || echo "  DMG: Not found"
ls -la "$TAURI_DIR/target/release/bundle/macos/" 2>/dev/null || echo "  App: Not found"

echo ""
echo "To install:"
echo "  1. Open the DMG file"
echo "  2. Drag ViboGit to Applications"
echo "  3. Launch from Applications or Spotlight"
