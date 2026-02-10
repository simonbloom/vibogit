---
title: "Fix Image Previews & Copy Images to Screenshot Folder"
created: 2026-02-10
status: approved
project11_id: pd75vpjace146rqtj4zkc7trn180x29a
tags: [desktop, tauri, images, preview, drag-drop, clipboard, cleanshot]
---

# PRD: Fix Image Previews & Copy Images to Screenshot Folder

## Problem Statement

In the ViboGit desktop app (v0.1.6), image handling in the PromptBox has two remaining issues after the initial drag-drop/paste implementation:

1. **Broken image previews**: All three image insertion methods (drag from Finder, CleanShot paste, clipboard save) show broken `?` icons instead of thumbnails. The `convertFileSrc()` asset protocol URLs fail to load due to Tauri scope/glob matching issues with paths containing spaces, `@2x`, and hidden directories like `Library/Application Support`.

2. **Dragged images reference volatile paths**: When dragging from Finder, the image path points to whatever location the user dragged from (Desktop, Downloads, temp folder). If the original file is moved/deleted, the reference breaks. Images should be copied to the configured Screenshot Folder for safety.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Image previews render correctly | All 3 methods show thumbnail in PromptBox |
| Dragged images are safe copies | File exists in Screenshot Folder after drag |
| CleanShot/paste images also copied | All images consolidated in one folder |
| No duplicate filenames on copy | Timestamp suffix prevents overwrites |
| Copy/submit still resolves paths | `[image N]` becomes absolute path to copied file |

## User Stories

1. **As a developer**, I drag an image from Finder and see a working thumbnail preview, with the file safely copied to my Screenshot Folder.
2. **As a CleanShot user**, I paste a screenshot and see a working preview, with the image copied to my Screenshot Folder.
3. **As a developer**, I paste from clipboard (non-CleanShot) and see a working preview of the saved image.

## Requirements

### Functional Requirements

**FR-1: Base64 preview via Rust command**
- New Rust command `read_image_as_data_url(path: String) -> String` that reads a file from disk and returns `data:image/png;base64,...`
- Detects MIME type from extension (png/jpg/gif/webp)
- Add `base64` crate to Cargo.toml

**FR-2: Copy image to Screenshot Folder via Rust command**
- New Rust command `copy_image_to_folder(sourcePath: String, destFolder: String) -> String` that copies an image file to the destination folder
- If filename already exists, appends timestamp suffix (e.g., `image-1739212345.png`)
- Returns the absolute path of the copied file
- Uses `imageBasePath` from config as destination; falls back to Desktop

**FR-3: Update drag-drop handler**
- After receiving file paths from Tauri `onDragDropEvent`:
  1. Call `copy_image_to_folder` to copy each image to Screenshot Folder
  2. Call `read_image_as_data_url` on the copied path to get preview
  3. Store the copied path as `filePath` on `PromptImage`

**FR-4: Update CleanShot/paste handler**
- After `find_recent_image` or `save_clipboard_image` resolves a path:
  1. If the resolved path is NOT already in the Screenshot Folder, call `copy_image_to_folder`
  2. Call `read_image_as_data_url` on the final path to get preview
  3. Update `PromptImage` with data URL preview and copied file path

**FR-5: Remove asset protocol dependency (cleanup)**
- Revert `assetProtocol` config from `tauri.conf.json` (no longer needed)
- Revert CSP changes (no `asset:` or `http://asset.localhost` needed)
- Remove `protocol-asset` feature from Cargo.toml
- Keep `fs:scope` in capabilities (still needed for file operations)

## Technical Approach

| File | Change |
|------|--------|
| `Cargo.toml` | Add `base64 = "0.22"`, remove `protocol-asset` feature |
| `commands.rs` | Add `read_image_as_data_url` + `copy_image_to_folder` |
| `lib.rs` | Register both new commands |
| `tauri.conf.json` | Revert asset protocol + CSP to `null` |
| `PromptBox.tsx` | Drag-drop: copy + data URL preview; Paste: copy + data URL preview |

## Tickets (3 tickets, ~5 story points)

**Ticket 1 (2 SP)**: Rust commands -- `read_image_as_data_url` and `copy_image_to_folder`
**Ticket 2 (2 SP)**: Update PromptBox drag-drop + paste handlers to copy files and use data URL previews
**Ticket 3 (1 SP)**: Cleanup -- remove asset protocol config, revert CSP, remove `protocol-asset` feature

## Risks

| Risk | Mitigation |
|------|------------|
| Large images produce huge base64 strings | Cap at 10MB (existing maxImageSize); thumbnails are displayed at 80px height so browser handles efficiently |
| Copy fails if Screenshot Folder doesn't exist | `copy_image_to_folder` creates the folder if missing |
| `save_clipboard_image` already saves to Screenshot Folder | Skip the copy step if path is already inside destFolder |
