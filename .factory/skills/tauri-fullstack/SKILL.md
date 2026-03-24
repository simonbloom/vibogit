---
name: tauri-fullstack
description: Implements features spanning both Tauri Rust backend and Next.js TypeScript frontend in the ViboGit desktop app.
---

# Tauri Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use for features that touch both the Rust backend (`apps/desktop/src-tauri/`) and the TypeScript frontend (`packages/ui/`, `packages/shared/`, `apps/desktop/frontend/`). This includes git operation changes, settings modifications, new Tauri commands, and UI features that depend on Rust backend functionality.

## Work Procedure

### 1. Understand the Feature

Read the feature description, preconditions, and expectedBehavior carefully. Then:
- Read AGENTS.md for mission boundaries and conventions
- Read `.factory/library/architecture.md` for command flow patterns
- Read the specific files mentioned in the feature description
- Identify ALL files that need changes (Rust, TypeScript types, frontend components, daemon bridge)

### 2. Plan Changes

Before writing code, enumerate:
- Rust changes needed (new commands, modified functions, new types, new error variants)
- TypeScript type changes (shared types in `packages/shared/src/types.ts`)
- Frontend component changes (UI, settings, command bridge)
- Test changes (new Rust tests)

### 3. Implement Rust Backend First (TDD)

For any Rust changes:
1. **Write failing tests first** in the appropriate test module in `commands.rs` or `git.rs`
2. Run `cd apps/desktop/src-tauri && cargo test` to confirm they fail
3. Implement the Rust changes
4. Run `cargo test` to confirm all tests pass (existing + new)
5. If adding new Tauri commands, register them in `main.rs`'s `invoke_handler`

### 4. Implement TypeScript Changes

1. Update shared types first (`packages/shared/src/types.ts`) if needed
2. Update service/lib files (`packages/ui/src/lib/`)
3. Update or create UI components (`packages/ui/src/components/`)
4. Add command mappings to `daemon-context.tsx` if new Tauri commands were added
5. Run `bun run typecheck` after each significant change

### 5. Verify Everything

Run the full verification suite:
```bash
cd /Users/simonbloom/apps-vol11/vibogit/apps/desktop/src-tauri && cargo test
cd /Users/simonbloom/apps-vol11/vibogit && bun run typecheck
```

Both must pass with zero errors.

### 6. Manual Verification (Browser)

Start the frontend dev server and verify UI changes:
```bash
cd /Users/simonbloom/apps-vol11/vibogit/apps/desktop/frontend && bun run dev &
```
Then use agent-browser to navigate to `http://localhost:4158` and verify:
- Settings UI renders correctly
- New/modified components appear as expected
- Navigation works to reach new sections
- No console errors

**IMPORTANT:** Stop the dev server after verification:
```bash
lsof -ti :4158 | xargs kill 2>/dev/null || true
```

### 7. Commit

Stage all changed files and commit with a clear message describing what was implemented.

## CRITICAL REMINDERS

- **Both views:** main-interface.tsx AND mini-view.tsx have separate implementations for push, commit, etc. Changes must be applied to BOTH.
- **Tauri command registration:** New Rust commands must be added to `tauri::generate_handler![]` in `main.rs` AND mapped in `daemon-context.tsx`.
- **Type consistency:** If you change types in `packages/shared/src/types.ts`, run typecheck immediately to catch cascading errors.
- **No new test frameworks:** Do not install vitest, jest, or any JS test framework. Only Rust tests.

## Example Handoff

```json
{
  "salientSummary": "Implemented smart push in git.rs: ship() now detects behind>0, runs git pull --rebase, then pushes. Added RebaseConflict and PushRejected error variants. Updated handlePush in both main-interface.tsx and mini-view.tsx with sync toast. Added 6 Rust tests. cargo test: 24 passing, bun run typecheck: clean.",
  "whatWasImplemented": "Modified ship() in git.rs to auto-rebase when behind remote. Added GitError::RebaseConflict and GitError::PushRejected variants replacing the AuthFailed catch-all. Updated handlePush in main-interface.tsx and mini-view.tsx to show 'Syncing with remote...' toast during auto-rebase. Added error-specific toast messages for conflict and push-rejected scenarios.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      {
        "command": "cd apps/desktop/src-tauri && cargo test",
        "exitCode": 0,
        "observation": "24 tests passed (18 existing + 6 new: ship_simple_push, ship_rebase_when_behind, ship_conflict_aborts, ship_partial_failure, ship_no_remote, ship_error_classification)"
      },
      {
        "command": "bun run typecheck",
        "exitCode": 0,
        "observation": "All 4 packages pass typecheck with zero errors"
      }
    ],
    "interactiveChecks": [
      {
        "action": "Opened http://localhost:4158, navigated to a repo view, inspected push button",
        "observed": "Push button visible with correct enabled/disabled state, count badge shows ahead number"
      },
      {
        "action": "Opened Settings > AI section",
        "observed": "Only Anthropic and OpenAI in dropdown, no model dropdown visible, API key field with toggle"
      }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "apps/desktop/src-tauri/src/git.rs",
        "cases": [
          { "name": "ship_simple_push", "verifies": "Basic push when not behind remote" },
          { "name": "ship_rebase_when_behind", "verifies": "Auto-rebase then push when behind" },
          { "name": "ship_conflict_aborts", "verifies": "Rebase conflict triggers abort and returns RebaseConflict" },
          { "name": "ship_partial_failure", "verifies": "Rebase succeeds but push fails returns PushRejected" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Rust compilation fails due to dependency issues not resolvable with `cargo build`
- A Tauri command pattern is unclear (e.g., how to register async commands)
- The feature requires changes to files not mentioned in the description that seem risky
- Browser testing reveals the frontend won't start (port conflict, build error)
- The feature depends on another feature's output that doesn't exist yet
