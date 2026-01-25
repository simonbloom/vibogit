---
title: "Skill Quick References in PromptBox"
created: 2026-01-25
status: approved
project11_id: pd768n9mr04vfhwaf7qep8j00s7zxhn4
tags: [promptbox, skills, ux, daemon]
---

# PRD: Skill Quick References in PromptBox

## Problem Statement

Users frequently reference Factory skills in their prompts (e.g., "Please use Project11 skill to...") but must:
1. Remember exact skill names from memory
2. Manually type the full phrase each time
3. Have no discoverability for available skills

This creates friction, especially with multiple skills installed.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Reduce friction for skill references | < 3 keystrokes to insert skill reference |
| Improve skill discoverability | 100% of installed skills visible in autocomplete |
| Match existing UX patterns | Use `/` trigger (consistent with command patterns) |

## User Stories

1. **As a user**, I want to type `/` and see my available skills so I can quickly reference one
2. **As a user**, I want to search/filter skills as I type (e.g., `/pro` shows `project11`)
3. **As a user**, I want the selected skill to insert a properly formatted reference

## Requirements

### Functional Requirements

| Priority | Requirement |
|----------|-------------|
| Must Have | `/` character triggers skill autocomplete dropdown |
| Must Have | Read skills from `~/.factory/skills/` directory (via daemon) |
| Must Have | Show skill name + description in dropdown |
| Must Have | Keyboard navigation (↑↓, Enter, Escape) |
| Must Have | Fuzzy search/filter as user types |
| Should Have | Insert formatted phrase: `Please use [skill-name] skill to ` |
| Should Have | Config for skills directory path (uses `computerName` like imageBasePath) |
| Nice to Have | Show skill icon/emoji if available |

### Non-Functional Requirements

- Performance: Autocomplete appears in < 100ms
- Accessibility: Full keyboard navigation support

## Technical Considerations

### Architecture

```
+------------------+     WebSocket      +------------------+
|   PromptBox      | <----------------> |     Daemon       |
|   (Next.js)      |                    |   (Bun/9111)     |
+------------------+                    +------------------+
        |                                        |
        v                                        v
  useSkillAutocomplete()              fs.readdir(skillsPath)
        |                                        |
        v                                        v
  Render dropdown                    Parse SKILL.md frontmatter
  with skill list                    Extract name + description
```

### Skill Discovery

Skills are stored at `~/.factory/skills/<skill-name>/SKILL.md` with YAML frontmatter:

```yaml
---
name: project11
description: Manage your project11.app Kanban boards...
---
```

### Daemon API Addition

New WebSocket message type:

```typescript
// Request
{ type: 'list-skills' }

// Response  
{ 
  type: 'skills-list',
  skills: [
    { name: 'project11', description: 'Manage your project11.app...', path: '/Users/.../project11' },
    { name: 'browser', description: 'Automate Chrome with CDP...', path: '/Users/.../browser' }
  ]
}
```

### Files to Modify

| File | Change |
|------|--------|
| `apps/daemon/src/handlers/` | Add `list-skills` handler |
| `apps/web/src/components/prompt-box/hooks/` | Create `useSkillAutocomplete.ts` |
| `apps/web/src/components/prompt-box/PromptBox.tsx` | Add `/` trigger logic |
| `apps/web/src/components/prompt-box/components/` | Create `SkillAutocompletePanel.tsx` |
| `packages/shared/src/types.ts` | Add `Skill` type |

## ASCII UI Mockups

### Autocomplete Dropdown (after typing `/`)

```
+----------------------------------------------------------+
| Draft your prompt here...                                |
| /pro|                                                    |
| +--------------------------------------------------+     |
| | project11                                    [P] |     |
| | Manage your project11.app Kanban boards...       |     |
| +--------------------------------------------------+     |
| | problem-analyzer                             [P] |     |
| | Systematic problem analysis for debugging...     |     |
| +--------------------------------------------------+     |
| | product-management                           [P] |     |
| | Assist with core product management...           |     |
| +--------------------------------------------------+     |
+----------------------------------------------------------+
| 0 chars           @ files  /skills   Clear  Copy  Send   |
+----------------------------------------------------------+
```

### After Selection (skill inserted)

```
+----------------------------------------------------------+
| Draft your prompt here...                                |
| Please use project11 skill to |                          |
|                                                          |
|                                                          |
+----------------------------------------------------------+
| 35 chars          @ files  /skills   Clear  Copy  Send   |
+----------------------------------------------------------+
```

## ASCII UX Journey

```
[Typing in PromptBox]
        |
        | types "/"
        v
[Skill Autocomplete Opens]
        |
        | continues typing "pro"
        v
[Filtered: project11, problem-analyzer, product-management]
        |
        | ↓ or clicks
        v
[Highlights project11]
        |
        | Enter or click
        v
[Inserts: "Please use project11 skill to "]
        |
        | Continues typing task
        v
[Complete prompt ready]
```

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Daemon not connected | Show empty state: "Connect daemon to see skills" |
| No skills installed | Show message: "No skills found in ~/.factory/skills/" |
| Conflict with existing `/` usage | Currently no `/` command in PromptBox |
| Skills path varies by machine | Use `computerName` config pattern (already solved) |

## Implementation Decisions

1. **Insertion format**: `Please use [skill] skill to ` (explicit, clear to Droid)
2. **Coexistence with @ files**: Both triggers work simultaneously (@ for files, / for skills)
