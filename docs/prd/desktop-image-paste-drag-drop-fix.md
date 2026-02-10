---
title: "Fix Desktop Image Paste & Drag-Drop in PromptBox"
created: 2026-02-10
status: approved
project11_id: pd7br1qm9skq7scqgqshhhy8r180x640
tags: [desktop, tauri, images, paste, drag-drop, cleanshot]
---

# PRD: Fix Desktop Image Paste & Drag-Drop in PromptBox

## Problem Statement

In the ViboGit desktop (Tauri) app, pasting screenshots and dragging images into the PromptBox are both broken:

1. **Paste**: Fails with "The string did not match..." because it tries to POST to `/api/upload` which doesn't exist (desktop is a static export -- no API routes).
2. **Drag-and-drop**: Does nothing because Tauri's webview intercepts native file drops before HTML5 drag/drop events reach the browser.
3. **Wrong mental model**: The code tries to "upload" images. In the desktop app, images already exist on the user's file system. The app should just record the file path.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Drag image from Finder works | Preview shown, full absolute file path captured |
| Paste screenshot works | Path resolved (via CleanShot lookup or save to disk), preview shown |
| No duplicate files in CleanShot mode | CleanShot toggle finds existing file instead of saving again |
| Copy/submit resolves paths | `[image N]` becomes absolute file path on disk |

## User Stories

1. **As a developer**, I want to drag an image from Finder into the PromptBox and have it capture the full file path so when I copy, it references the correct location.
2. **As a developer using CleanShot**, I want to paste a screenshot and have it find the file CleanShot already saved, without creating a duplicate.
3. **As a developer not using CleanShot**, I want to paste a screenshot and have it saved to my configured folder, with the path recorded.

## Requirements

### Functional Requirements

**FR-1: Skip Upload in Tauri Mode**
- Detect Tauri via `isTauri()` from `@/platform`
- In Tauri mode: never call `fetch("/api/upload")`
- In web mode: keep existing upload behavior unchanged

**FR-2: Tauri Native Drag-Drop**
- Use `getCurrentWebview().onDragDropEvent()` from `@tauri-apps/api/webview`
- On `drop` event: receive `paths: string[]` (absolute file paths from Finder)
- Filter for image extensions (.png, .jpg, .jpeg, .gif, .webp)
- Use `convertFileSrc()` or read file bytes for preview
- Store absolute path as `filePath` on the `PromptImage`
- No files moved -- path comes directly from Tauri's native event

**FR-3: CleanShot Mode Toggle**
- Add a "CleanShot Mode" boolean toggle in Settings
- When ON + paste: call a Rust command `find_recent_image` that scans `imageBasePath` for the most recently created image file within the last 5 seconds
- If a match is found: use that file's absolute path (no duplicate created)
- If no match found (rare): fall back to saving clipboard image to disk
- When OFF + paste: call `save_clipboard_image` to save clipboard data to `imageBasePath` folder, return the absolute path
- Default: OFF

**FR-4: Clipboard Paste -- Save to Disk (non-CleanShot mode)**
- New Rust command `save_clipboard_image` that reads clipboard image data (via `arboard` crate) and saves as PNG to the configured `imageBasePath` folder
- Returns the absolute path of the saved file
- If `imageBasePath` is not set, default to `~/Desktop`
- Filename format: `vibogit-paste-{timestamp}.png`

**FR-5: imageBasePath Default**
- Default to `~/Desktop` if not set (currently defaults to empty string)
- The "Screenshot Folder Path" setting already exists with a `PathSelector`

### Non-Functional Requirements

- Two new Rust commands: `save_clipboard_image` and `find_recent_image`
- Add `arboard` crate dependency for clipboard image access
- Drag-drop uses Tauri's built-in event -- no Rust changes for that
- Existing web app behavior unchanged

## Technical Considerations

### Architecture

```
DRAG-DROP FLOW (Desktop):
[Drag from Finder] --> Tauri onDragDropEvent --> { paths: string[] }
  --> Filter image extensions
  --> preview via convertFileSrc(path)
  --> filePath = path (absolute, from Finder)
  --> No upload, no copy, no move

PASTE FLOW -- CleanShot ON:
[Cmd+V] --> detect Tauri + CleanShot mode
  --> invoke("find_recent_image", { folder: imageBasePath, withinSecs: 5 })
  --> Rust: scan folder for newest image modified in last 5s
  --> Found? --> filePath = that file's path (no duplicate!)
  --> Not found? --> fallback to save_clipboard_image
  --> preview = blob URL from clipboard

PASTE FLOW -- CleanShot OFF:
[Cmd+V] --> detect Tauri, CleanShot off
  --> invoke("save_clipboard_image", { folder: imageBasePath || ~/Desktop })
  --> Rust: arboard reads clipboard -> saves PNG -> returns path
  --> filePath = returned path
  --> preview = blob URL from clipboard

COPY/SUBMIT (unchanged):
[image N] --> img.filePath --> "/Users/simon/Desktop/CleanShot 2026-02-10.png"
```

### ASCII UI Mockup -- Settings with CleanShot Toggle

```
+-----------------------------------------------+
| Settings                              [X]     |
+-----------------------------------------------+
| ...                                           |
| Screenshot Folder Path                        |
| [/Users/simon/Desktop        ] [Browse]       |
|                                               |
| CleanShot Mode                                |
| [ON/OFF toggle]                               |
| When enabled, pasted images are matched to    |
| files already saved by CleanShot instead of   |
| creating duplicates.                          |
+-----------------------------------------------+
```

### ASCII UX Journey

```
DRAG:
[Finder drag] --> [Tauri drop event] --> [paths received] --> [Preview + path stored]

PASTE (CleanShot ON):
[Cmd+V] --> [find_recent_image in folder] --> [Match found] --> [Preview + path stored]
                                                  |
                                          [No match] --> [save_clipboard_image fallback]

PASTE (CleanShot OFF):
[Cmd+V] --> [save_clipboard_image] --> [File saved] --> [Preview + path stored]
```

### Files to Modify

```
apps/desktop/src-tauri/src/commands.rs     - New: save_clipboard_image, find_recent_image
apps/desktop/src-tauri/src/lib.rs          - Register new commands
apps/desktop/src-tauri/Cargo.toml          - Add arboard dependency

packages/ui/src/components/prompt-box/hooks/useImageUpload.ts    - Skip upload in Tauri mode
packages/ui/src/components/prompt-box/hooks/useClipboardPaste.ts - Tauri paste: CleanShot vs save
packages/ui/src/components/prompt-box/PromptBox.tsx              - Add Tauri onDragDropEvent listener
packages/ui/src/lib/daemon-context.tsx                           - tauriSend mappings for new commands
packages/ui/src/components/settings-panel.tsx                    - Add CleanShot toggle
packages/shared/src/types.ts                                     - Add cleanShotMode to Config type
apps/desktop/shared/src/types.ts                                 - Add cleanShotMode to Config type
```

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `arboard` may not support clipboard image on all platforms | Well-maintained crate, macOS support confirmed |
| 5-second window may miss slow CleanShot saves | Falls back to `save_clipboard_image` automatically |
| `imageBasePath` not set | Default to `~/Desktop`; show toast suggesting configuration |
| Multiple images saved in same second | `find_recent_image` picks the newest by modification time |

## Launch Plan

- Desktop only -- no changes to web app
- Ship in next DMG build

## Open Questions

- None remaining
