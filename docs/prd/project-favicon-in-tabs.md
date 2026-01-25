---
title: "Project Favicon in Tabs"
created: 2026-01-25
status: approved
project11_id: pd7eyqrcwm1gzfb0hp704c23257zwq9t
tags: [ui, tabs, favicon]
---

# PRD: Project Favicon in Tabs

## Problem Statement
Users with multiple projects open cannot quickly visually distinguish between tabs. Adding project favicons would provide instant visual recognition and improve navigation efficiency.

## Goals & Success Metrics
- **Goal**: Display project favicon in tabs for quick visual identification
- **Success**: Users can identify projects by favicon without reading tab names

## User Stories
1. As a user with multiple projects open, I want to see each project's favicon in its tab so I can quickly find the right project.

## Requirements

| Priority | Requirement |
|----------|-------------|
| Must Have | Look for `favicon.svg` first in project root/public folder |
| Must Have | Fall back to `favicon.ico` if SVG not found |
| Must Have | Display favicon at 21px size to the left of project name |
| Must Have | Show nothing if no favicon exists (no fallback icon) |
| Must Have | Cache favicon lookup results to avoid repeated filesystem checks |

## Technical Considerations

**Favicon Resolution Order:**
1. `{projectRoot}/favicon.svg`
2. `{projectRoot}/public/favicon.svg`
3. `{projectRoot}/favicon.ico`
4. `{projectRoot}/public/favicon.ico`
5. No icon (empty)

**New Daemon Message:**
- `getFavicon` - Returns base64-encoded favicon data or null

**Caching Strategy:**
- Cache favicon data in tabs context per project path
- Invalidate only on tab close/reopen

## ASCII UI Mockup

**Current Tab Bar:**
```
+----------------------------------------------------------+
| [Logo]  [vibogit    x] [other-project    x]  [+]         |
+----------------------------------------------------------+
```

**With Favicons:**
```
+----------------------------------------------------------+
| [Logo]  [🔷 vibogit x] [📦 other-proj  x]  [+]           |
+----------------------------------------------------------+
         ^               ^
         |               |
    21px favicon    21px favicon
```

**Tab Detail:**
```
+------------------------+
| [favicon] name    [x]  |
|   21px     text   close|
+------------------------+
```

## ASCII UX Flow

```
[Tab Renders] --> [Check Cache] --yes--> [Display Cached Favicon]
                       |
                      no
                       v
               [Call getFavicon] --> [Daemon Checks Files] --> [Return Data]
                                              |
                          +-------------------+
                          v
                [Cache Result] --> [Display or Empty]
```

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Large ICO files slow down UI | Limit file size check (< 100KB) |
| Invalid favicon data | Graceful fallback to no icon |

## Open Questions
- None at this time
