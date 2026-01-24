---
title: "Quick Commit One-Click Flow"
created: 2026-01-24
status: approved
project11_id: pd7413gdvdgx7hqcxcvhvf4c717zv606
tags: [quick-commit, ux, must-have]
---

# PRD: Quick Commit One-Click Flow

## Problem Statement

The current "Commit" button in ViboGit's main interface is disabled even when there are changes available to commit. Users expect a streamlined one-click commit experience that:
- Shows the number of pending changes
- Auto-generates a commit message using AI
- Commits automatically without additional clicks

Currently, the button checks `status?.staged.length` which is often 0 because files are tracked in UI state but not yet `git add`ed. This creates confusion when "Changes 3" is visible but the button is disabled.

## Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Enable quick commits | Button clickable when changes exist | 100% of the time |
| Reduce commit friction | Clicks to commit | 1 click (down from 3+) |
| Clear affordance | Users understand button state | Badge shows change count |

## User Story

> As a developer, I want to click "Quick Commit" once and have ViboGit automatically stage my changes, generate an appropriate commit message, and commit - so I can commit faster without manual steps.

## Requirements

### Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| QC-1 | Rename button from "Commit" to "Quick Commit" | Must Have |
| QC-2 | Show badge with `totalChanges` count (staged + unstaged + untracked) | Must Have |
| QC-3 | Enable button when `totalChanges > 0` | Must Have |
| QC-4 | On click: auto-stage all files in "Will Commit" selection | Must Have |
| QC-5 | On click: auto-generate AI commit message | Must Have |
| QC-6 | On click: auto-commit after message generated | Must Have |
| QC-7 | Show loading state during the process | Must Have |
| QC-8 | Refresh status after successful commit | Must Have |

### Non-Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| QC-NF1 | Total operation completes in < 5 seconds | Should Have |
| QC-NF2 | Error handling with user-friendly messages | Must Have |

## ASCII UI Layout

### Before (Current)
```
+------------------------------------------------------------------+
| [Pull] [Fetch] [Push]  [Commit] (disabled, no badge)  [PR]       |
+------------------------------------------------------------------+
```

### After (Proposed)
```
+------------------------------------------------------------------+
| [Pull] [Fetch] [Push]  [Quick Commit (3)] (enabled, green)  [PR] |
+------------------------------------------------------------------+
                              |
                              v  (one click)
+------------------------------------------------------------------+
| [Committing...]  (loading spinner, green bg)                     |
+------------------------------------------------------------------+
                              |
                              v  (auto-complete)
+------------------------------------------------------------------+
| [Quick Commit] (back to normal, count updated)                   |
+------------------------------------------------------------------+
```

## ASCII UX Flow

```
[User sees changes] 
       |
       v
[Quick Commit (3)] --click--> [Loading: "Committing..."]
                                        |
                    +-------------------+-------------------+
                    |                                       |
                    v                                       v
            [Stage files]                           [On Error]
                    |                                       |
                    v                                       v
            [Generate AI message]                   [Show error toast]
                    |                                       |
                    v                                       v
            [git commit -m "..."]                   [Reset button state]
                    |
                    v
            [Refresh status]
                    |
                    v
            [Success - button shows new count]
```

## Technical Details

### Files to Modify
- `apps/web/src/components/main-interface.tsx`

### Implementation Steps

1. **Update button text and badge**:
   ```tsx
   <GitBranch className="w-4 h-4" />
   Quick Commit {totalChanges > 0 && `(${totalChanges})`}
   ```

2. **Update enable condition**:
   ```tsx
   disabled={totalChanges === 0 || isCommitting}
   ```

3. **Implement one-click handler**:
   ```tsx
   const handleQuickCommit = async () => {
     if (!repoPath || totalChanges === 0) return;
     setIsCommitting(true);
     try {
       // 1. Stage all changed files
       await send("stageAll", { repoPath });
       
       // 2. Generate AI commit message
       const { message } = await send<{ message: string }>("generateCommitMessage", { repoPath });
       
       // 3. Commit with generated message
       await send("commit", { repoPath, message });
       
       // 4. Refresh status
       await refreshStatus();
     } catch (error) {
       console.error("Quick commit failed:", error);
       // TODO: Show error toast
     } finally {
       setIsCommitting(false);
     }
   };
   ```

4. **Remove old quick commit dialog** (no longer needed)

## Boundaries

- **DO NOT CHANGE**: The existing manual commit flow in Changes tab
- **DO NOT CHANGE**: PR creation flow
- **DO NOT CHANGE**: AI commit message generation logic (reuse existing)

## Acceptance Criteria

- [ ] Button displays "Quick Commit" text
- [ ] Button shows badge with total changes count when > 0
- [ ] Button is enabled when `totalChanges > 0`
- [ ] Button is disabled when `totalChanges === 0`
- [ ] Clicking button shows loading state with spinner
- [ ] All changed files are staged automatically
- [ ] AI commit message is generated automatically
- [ ] Commit executes with generated message
- [ ] Status refreshes after successful commit
- [ ] Button returns to normal state after completion
- [ ] Errors are caught and logged (button resets to clickable)

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| AI message generation fails | Catch error, show toast, reset button |
| User commits unintended files | Files follow existing "Will Commit" selection logic |
| Slow AI response | Show clear loading state, user can wait |
