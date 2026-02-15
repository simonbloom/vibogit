---
title: "Sidebar Theme Cycle Icon"
created: 2026-02-15
status: draft
project11_id: pending
tags: [theme, sidebar, navigation, ux]
source_prds:
  - "ViboGit Theme System Implementation (pd74kdxac1m0q6m44860y2xysd7zve93)"
---

# PRD: Sidebar Theme Cycle Icon

## Problem Statement

Users can already switch themes from the settings panel, but there is no quick affordance in the navigation sidebar. This causes repeated navigation away from the main workflow to change themes. A small, one-click sidebar control should show the active theme state and cycle to the next theme with immediate visual feedback.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Fast theme switching | Theme changes in a single click from sidebar with no intermediate screens |
| Visibility of active theme | Sidebar icon always indicates current theme |
| Preserve existing UX | Keep settings panel theme selector unchanged |
| Low friction | One click rotates through 5 states in sequence |
| Accessibility | Keyboard and screen-reader support for theme controls |

## User Stories

| ID | As a... | I want to... | So that... |
|----|---------|--------------|------------|
| US1 | Developer | See the currently active theme in the sidebar | I get immediate context without opening Settings |
| US2 | Developer | Click one icon to move to the next theme | I can switch theme quickly |
| US3 | Developer | Have the same icon style used in settings | The control is visually consistent |
| US4 | Developer | Keep using settings panel theme picker | I still can do direct selection if preferred |
| US5 | Keyboard user | Use focus/activation controls on the sidebar icon | I can change theme without a pointer |

## Functional Requirements

### Must Have

1. Add a new sidebar footer control in `packages/ui/src/components/sidebar/sidebar.tsx`.
2. Show current active theme as an icon in the sidebar control.
3. Reuse theme visuals from `packages/ui/src/components/settings/ThemeToggle.tsx`:
   - Light: `Sun`
   - Dark: `Moon`
   - Ember: `Flame`
   - Matrix: `Binary`
   - System: `Monitor`
4. On click, cycle theme in this order:  
   `light -> dark -> ember -> matrix -> system -> light`.
5. Trigger `setTheme(nextTheme)` from `next-themes` on each click so all theme synchronization remains intact.
6. Update icon immediately after state change to match newly applied theme.
7. Keep settings panel theme selector untouched and fully functional.
8. Add accessible label and tooltip/title indicating current theme and next theme target.

### Should Have

1. Keyboard support for `Enter`/`Space` via button semantics.
2. Optional next-theme hint text when sidebar is expanded.
3. Optional subtle rotation/flip animation on click to signal state transition.

### Could Have

1. Context-specific icon fallback if theme value is undefined (show `Monitor` and default to `light` or system resolution path).
2. Additional compact mode display when sidebar is collapsed (icon-only control).

## Non-Functional Requirements

1. No additional dependency changes.
2. No backend changes.
3. No behavior change to repository switching, sidebar collapse, or settings navigation.
4. The theme should remain persisted through existing config sync flow.

## Technical Considerations

### Existing state and config flow

- Theme state is controlled by `next-themes` and synchronized via `packages/ui/src/lib/use-theme-sync.ts`.
- Settings selector is in `packages/ui/src/components/settings/ThemeToggle.tsx`.
- Sidebar currently owns layout/state in `packages/ui/src/components/sidebar/sidebar.tsx`.
- App shell is `packages/ui/src/components/app-layout.tsx`.

### Suggested implementation approach

1. Add a small theme cycle component inside `Sidebar` footer and mount it next to existing settings control.
2. Build a local theme order list constant (or extract into shared module if preferred):
   - `["light","dark","ember","matrix","system"]`
3. Resolve icon mapping using same Lucide icons and classes as settings toggle.
4. Compute current index, select next theme, and call `setTheme(nextTheme)`.
5. Use a ghost icon button for compact space and avoid heavy controls.
6. On sidebar-collapsed state, render as icon-only button with tooltip.
7. Ensure `mounted` guard exists to avoid mismatch during hydration if needed.

### Potential file touch points

| File | Change |
|------|--------|
| `packages/ui/src/components/sidebar/sidebar.tsx` | Add theme-cycle icon control in footer |
| `packages/ui/src/components/settings/ThemeToggle.tsx` | Optional shared icon mapping refactor for reuse |
| `packages/ui/src/components/settings/sections/AppearanceSettingsSection.tsx` | Optional import remains unchanged |

## ASCII UI Mockup

```
+--------------------------------------+
| VIBOGIT               [collapse]      |
|                                      |
| [Add project]                        |
|                                      |
| Project list...                       |
|                                      |
|                                      |
+--------------------------------------+
| [⚙] Settings     [☀] Theme          |
+--------------------------------------+
```

```
Expanded footer variant:
+--------------------------------------+
| [⚙] Settings         Theme: Light     |
+--------------------------------------+
```

Legend:
- `[☀]` means currently active theme icon in sidebar.
- Theme cycles through Light → Dark → Ember → Matrix → System → Light.

## ASCII UX Journey

```
[Sidebar loaded] --> [Read current theme]
       |
       v
[User clicks theme icon]
       |
       v
[Compute next theme in cycle]
       |
       v
[next-themes setTheme(nextTheme)]
       |
       v
[ThemeSync persists theme] --> [App re-renders]
                               |
                               v
                           [Icon updates]
                               |
                               v
                        [User sees new visual theme]
```

## Success Criteria / Verification

- [ ] Sidebar footer icon exists and renders in both expanded and collapsed states.
- [ ] Icon corresponds to current theme value from `next-themes`.
- [ ] Clicking cycles exactly through 5 themes in configured order.
- [ ] Theme updates are visually applied app-wide.
- [ ] Settings panel theme selector remains unchanged and still works.
- [ ] Keyboard activation toggles theme similarly to pointer click.
- [ ] No regression in theme persistence after restart.
- [ ] Build remains green (`bun run build`, no TS breakage from touched files).

## Risks and Mitigations

1. **Hydration mismatch on initial render**
   - Mitigation: render icon only after mount or guard with theme initialization behavior.
2. **Confusion when value is `system`**
   - Mitigation: keep clear tooltip ("Theme: System") and `Monitor` icon.
3. **Unexpected side effects from theme sequencing**
   - Mitigation: keep sequence exactly shared with settings semantics and centralize order constant.
4. **Inconsistent icon semantics**
   - Mitigation: use same icon set and names as existing `ThemeToggle`.

## Open Questions

1. Should a long-press or double-click behavior be considered, or is one-click cycle only?
2. Should we include compact text labels in expanded sidebar when width permits?
3. Do we want subtle animation on icon transition in v1 or keep it static?
4. Should theme cycle include only selected themes from future feature flags if any are disabled?

## Launch Plan

1. Add sidebar control in UI layer and local theme cycle state logic.
2. Validate icon reuse from existing settings panel and align styles.
3. Update accessibility metadata and tooltip.
4. Manual verification across all themes:
   - Light
   - Dark
   - Ember
   - Matrix
   - System
5. Keep settings panel unchanged and run final validation for sidebar + theme persistence.

## Checkpoint 2 (Decision)

Please review this PRD. If approved, would you like me to:
1. Save it to `docs/prd/sidebar-theme-cycle-icon.md` and create Project11 tickets now
2. Save only the PRD file
3. Make changes to the PRD first
