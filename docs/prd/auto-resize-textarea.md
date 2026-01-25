---
title: "Auto-Resize Textarea for PromptBox"
created: 2026-01-25
status: approved
project11_id: pd75dr0y03mqx039qt3k4vbxbh7zxbw1
tags: [promptbox, textarea, ui, ux]
---

# PRD: Auto-Resize Textarea for PromptBox

## Problem Statement
The PromptBox textarea has a fixed height, requiring users to scroll within a small area when composing longer prompts. Users expect modern text inputs to grow with their content.

## Goals & Success Metrics
- **Goal**: Textarea smoothly expands from 100px to 300px (3x) based on content
- **Success**: Zero user complaints about textarea sizing; natural typing experience

## User Stories
1. As a user, I want the textarea to grow as I type so I can see more of my prompt
2. As a user, I want the textarea to shrink when I delete content to save space
3. As a user, I want smooth transitions so the UI feels polished

## Requirements

### Functional
| Priority | Requirement |
|----------|-------------|
| Must Have | Auto-resize from 100px to 300px based on content height |
| Must Have | Shrink back when content is deleted |
| Must Have | Scroll when content exceeds 300px |
| Should Have | Smooth CSS transition for height changes |

### Non-Functional
- Height transition: ~150ms ease-out
- No layout shift or jank during resize

## ASCII UI Mockup

```
Initial State (100px):
+------------------------------------------+
| Draft your prompt here...                |
|                                          |
+------------------------------------------+

Expanded State (up to 300px):
+------------------------------------------+
| This is a longer prompt that             |
| spans multiple lines and causes          |
| the textarea to grow smoothly            |
| to accommodate the content...            |
|                                          |
|                                          |
|                                          |
|                                          |
+------------------------------------------+

Max Height (300px, scrolling):
+------------------------------------------+
| Very long content that exceeds          |▲
| the maximum height will cause           |█
| the textarea to scroll instead          |█
| of growing further...                   |▼
+------------------------------------------+
```

## Technical Approach
1. Use a hidden "shadow" div or `scrollHeight` to measure content height
2. Set textarea height to `Math.min(scrollHeight, maxHeight)`
3. Apply CSS transition on height property
4. Trigger resize on `onChange` and initial mount

## Files Affected
- `apps/web/src/components/prompt-box/PromptBox.tsx`

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Performance on rapid typing | Debounce or use requestAnimationFrame |
| Layout shift | Use `overflow: hidden` during transition |
