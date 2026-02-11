---
title: "Project Favicon/Logo in Sidebar"
created: 2026-02-11
status: approved
project11_id: pd756frhe6wm7v6mcnag1ey11x80yxcb
tags: [ui, sidebar, favicon, logo]
---

# PRD: Project Favicon/Logo in Sidebar

## Problem Statement

The sidebar project list currently displays a small colored dot next to each project name. This makes it hard to visually distinguish between projects at a glance, especially as users add more repositories. If a project has a favicon or logo file in its repository, displaying that image instead of the generic dot would let users instantly recognize projects without reading the name.

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Faster visual project identification | Users can identify the correct project without reading the name |
| Leverage existing assets | Projects with favicons/logos show them automatically with no user configuration |
| Graceful fallback | Projects without logos show a distinct letter-based avatar |

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US1 | Developer | See my project's logo/favicon in the sidebar | I can instantly pick out the right project |
| US2 | Developer | See a letter avatar when no logo exists | Each project still looks distinct |
| US3 | Developer | Have logos load without configuration | It just works when a favicon exists in my repo |

## Requirements

### Functional Requirements

| ID | Priority | Requirement |
|----|----------|-------------|
| FR1 | Must | Display project favicon/logo as a ~48px image in the project item, replacing the colored dot |
| FR2 | Must | Fall back to a colored circle with the first letter of the project name when no logo is found |
| FR3 | Must | Search local repo files for favicons (existing `get_favicon` Tauri command paths: `public/favicon.ico`, `public/favicon.png`, `static/favicon.ico`, `static/favicon.png`, `src/favicon.ico`, `favicon.ico`) |
| FR4 | Should | Also search for common logo files: `logo.png`, `logo.svg`, `icon.png`, `public/logo.png`, `public/logo.svg` |
| FR5 | Should | Cache favicon data in memory to avoid re-reading files on every render |
| FR6 | Should | Invalidate cache when project list refreshes or a new project is added |
| FR7 | Must | Work in both expanded and collapsed sidebar modes |

### Non-Functional Requirements

| ID | Requirement |
|----|-------------|
| NFR1 | Favicon loading must not block sidebar rendering (async load) |
| NFR2 | Images should render as base64 data URLs (already how `get_favicon` returns them) |
| NFR3 | Letter fallback avatars should use deterministic colors based on project name |

## Technical Considerations

### Existing Infrastructure
- **Rust backend** already has `get_favicon` command in `commands.rs` that searches common favicon paths and returns base64-encoded data + MIME type
- **Tauri command mapping** already exists in `daemon-context.tsx` (`getFavicon` -> `get_favicon`)
- The `Project` interface has `path` and `name` fields available

### Changes Needed

**1. Expand `get_favicon` Rust command** to also search for logo files:
```
logo.png, logo.svg, icon.png, public/logo.png, public/logo.svg,
public/icon.png, assets/logo.png, assets/icon.png
```

**2. Add favicon state to `ProjectsContext`**:
```typescript
interface ProjectsState {
  // ... existing fields
  favicons: Record<string, { data: string; mimeType: string } | null>;
}
```

**3. New `ProjectAvatar` component**:
```typescript
function ProjectAvatar({ project, favicon, size }: Props) {
  if (favicon?.data) {
    return <img src={`data:${favicon.mimeType};base64,${favicon.data}`} ... />;
  }
  return <LetterAvatar name={project.name} size={size} />;
}
```

**4. Update `project-item.tsx`**:
- Replace the `<span className="w-2 h-2 rounded-full">` dot with `<ProjectAvatar>`
- Accept favicon data as a prop
- Adjust layout spacing for the larger 48px avatar

**5. Update `project-list.tsx`**:
- Fetch favicons for all projects on mount and when projects change
- Pass favicon data down to each `ProjectItem`

## ASCII UI Mockups

### Project Item with Logo (Expanded Sidebar)

```
+------------------------------------------+
|  +------+                                |
|  |      |  vibogit                   v   |
|  | LOGO |  main                          |
|  |      |                                |
|  +------+                                |
+------------------------------------------+

+------------------------------------------+
|  +------+                                |
|  | LOGO |  my-website               ^3   |
|  | .png |  feature/redesign              |
|  +------+                                |
+------------------------------------------+
```

### Project Item with Letter Fallback (Expanded Sidebar)

```
+------------------------------------------+
|  +------+                                |
|  |      |                                |
|  |  A   |  api-server                .2  |
|  |      |  develop                       |
|  +------+                                |
+------------------------------------------+
```

### Collapsed Sidebar

```
+-------+
| +---+ |
| | V | |  <-- 48px logo, centered
| +---+ |
|   v   |
+-------+
| +---+ |
| | A | |  <-- Letter avatar fallback
| +---+ |
|  .2   |
+-------+
```

## ASCII UX Journey

```
[App Launch] --> [Load Projects] --> [For each project]
                                          |
                                          v
                                   [Call get_favicon(path)]
                                          |
                              +-----------+-----------+
                              v                       v
                       [Favicon found]         [No favicon]
                              |                       |
                              v                       v
                    [Cache base64 data]    [Generate letter avatar]
                              |                       |
                              +-----------+-----------+
                                          v
                                   [Render ProjectAvatar]
                                          |
                                          v
                              [Show in project-item.tsx]
```

## Design & UX Notes

| Element | Style |
|---------|-------|
| Logo image | 48px, rounded-lg (8px radius), object-cover |
| Letter avatar | 48px circle, bold centered letter, deterministic bg color |
| Color generation | Hash project name to pick from a palette of 8-10 distinct colors |
| Selected state | Subtle ring/border around the avatar + accent background on row |
| Collapsed mode | Avatar centered, same 48px size |

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Large favicon files slow down sidebar | Medium | Cap file read at 512KB, skip larger files |
| SVG favicons could contain scripts | Low | Render SVGs as img tags (no inline SVG), which sandboxes them |
| Many projects = many file reads on startup | Medium | Load favicons in parallel, cache in memory |
| Favicon changes not reflected | Low | Re-fetch on manual refresh or project re-add |

## Open Questions

1. Should we support SVG logos or only raster formats (PNG, ICO)?
2. Should there be a way for users to manually set a project icon?
