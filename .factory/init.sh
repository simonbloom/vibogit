#!/bin/bash
set -e

cd /Users/simonbloom/apps-vol11/vibogit

# Install dependencies (idempotent)
bun install

# Verify Rust toolchain
rustc --version > /dev/null 2>&1 || { echo "ERROR: Rust toolchain not found"; exit 1; }
cargo --version > /dev/null 2>&1 || { echo "ERROR: Cargo not found"; exit 1; }

# Verify gh CLI
gh --version > /dev/null 2>&1 || echo "WARNING: gh CLI not found (needed for sync beacon feature)"

echo "Environment ready."
