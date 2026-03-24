# Smart Push – Testable User-Facing Assertions

## Happy Path: Push when ahead & remote is up-to-date

### VAL-PUSH-001 — Push succeeds when local is ahead and remote has no new commits
**Behavior:** User has local commits not on remote (`ahead > 0`, `behind == 0`). Clicking Push pushes all commits to remote and shows success toast.
**Pass criteria:** `git push` succeeds; toast displays "Pushed successfully"; `ahead` resets to 0 after status refresh.
**Evidence:** Success toast visible; `status.ahead` is 0 post-push; remote ref matches local HEAD.

### VAL-PUSH-002 — Push button is enabled only when ahead > 0
**Behavior:** Push button is clickable only when `status.ahead > 0`. When `ahead == 0`, the button is disabled (greyed out, non-interactive).
**Pass criteria (main-interface):** Button has `disabled` attribute when `ahead == 0`; button is enabled when `ahead > 0`.
**Pass criteria (mini-view):** Same behavior in the mini-view button.
**Evidence:** Inspect button `disabled` prop; attempt click when disabled yields no action; badge shows ahead count.

### VAL-PUSH-003 — Push button shows commit count badge when ahead
**Behavior:** When `ahead > 0`, the Push button displays the ahead count (e.g., "Push (3)" in main-interface, or a green number in mini-view).
**Pass criteria:** Badge text matches `status.ahead` value exactly.
**Evidence:** Visual inspection of button label/badge text matching the `ahead` count from status.

### VAL-PUSH-004 — Push button visual styling reflects ahead state
**Behavior:** When `ahead > 0`, main-interface button uses green filled variant (`bg-green-600`); when `ahead == 0`, uses outline variant. Mini-view arrow icon turns green when ahead.
**Pass criteria:** CSS class `bg-green-600` present when `ahead > 0`; `text-green-500` on mini-view icon when `ahead > 0`.
**Evidence:** Inspect element classes or computed styles.

---

## Core Feature: Smart Push (pull-before-push when behind)

### VAL-PUSH-010 — Smart Push auto-rebases when remote is ahead
**Behavior:** User has local commits (`ahead > 0`) AND remote has commits not locally present (`behind > 0`). Clicking Push automatically performs `git pull --rebase` then `git push` without user intervention.
**Pass criteria:** Push completes successfully; local branch now includes both local and remote commits; remote and local refs match; no manual steps required.
**Evidence:** `git log` shows remote commits rebased under local commits; `ahead == 0` and `behind == 0` post-push.

### VAL-PUSH-011 — "Syncing with remote..." toast shown during auto-rebase
**Behavior:** When Smart Push detects `behind > 0` and initiates pull-before-push, a progress toast reading "Syncing with remote..." is displayed.
**Pass criteria:** Toast appears before the rebase+push completes; toast is visible during the operation.
**Evidence:** Visual presence of "Syncing with remote..." toast during the operation; toast disappears or transitions to success/error once done.

### VAL-PUSH-012 — Smart Push succeeds with non-conflicting divergent histories
**Behavior:** Local has commits touching file A; remote has commits touching file B (no overlap). Smart Push rebases cleanly and pushes.
**Pass criteria:** No error; both sets of changes present on remote after push; success toast shown.
**Evidence:** Post-push `git log` contains both commit sets; files A and B both have expected content.

---

## Error Path: Rebase conflicts during Smart Push

### VAL-PUSH-020 — Rebase conflict aborts cleanly and shows clear error
**Behavior:** Local and remote both modified the same lines in the same file. Smart Push attempts `git pull --rebase`, hits a conflict, aborts the rebase, and shows a user-friendly error message.
**Pass criteria:** Rebase is aborted (working tree is clean, no `.git/rebase-merge` directory); error toast is shown with a message indicating merge conflict (NOT "AuthFailed"); local branch is unchanged from pre-push state.
**Evidence:** Error toast contains "conflict" or equivalent clear message; `git status` shows no rebase-in-progress; no partial rebase state left behind.

### VAL-PUSH-021 — No data loss on conflict during Smart Push
**Behavior:** When a rebase conflict causes Smart Push to abort, all local commits and working tree changes are preserved exactly as they were before the push attempt.
**Pass criteria:** `git log` shows same commits as before push; working tree files unchanged; `git diff` shows no unexpected changes.
**Evidence:** Compare `git log --oneline` and `git diff` before and after the failed push attempt.

### VAL-PUSH-022 — Push button re-enables after conflict abort
**Behavior:** After a conflict causes Smart Push to fail, the Push button returns to its enabled state (not stuck in loading/disabled).
**Pass criteria:** `isPushing` state resets to `false`; button shows arrow icon (not spinner); button is clickable.
**Evidence:** Button is visually in non-loading state; clicking it again triggers a new push attempt.

---

## Error Classification: No more misleading AuthFailed

### VAL-PUSH-030 — Push failure when behind does NOT show "AuthFailed"
**Behavior:** (Pre-fix regression check) When push fails because remote is ahead, the error message must NOT contain "Authentication failed" or "AuthFailed".
**Pass criteria:** Error toast message does not include "auth", "authentication", or "AuthFailed" (case-insensitive) when the actual cause is diverged history.
**Evidence:** Capture toast text on push failure with behind > 0; verify it describes the actual issue.

### VAL-PUSH-031 — Genuine auth failure still shows authentication error
**Behavior:** When push fails due to actual authentication issues (expired token, revoked access), the error message correctly indicates an authentication problem.
**Pass criteria:** Error toast contains "authentication" or similar auth-related message; does NOT show a generic or conflict message.
**Evidence:** Force auth failure (e.g., invalid credential); capture toast text.

### VAL-PUSH-032 — Network error shows appropriate error message
**Behavior:** When push fails due to network issues (no internet, DNS failure), the error message indicates a network/connectivity problem, not "AuthFailed".
**Pass criteria:** Error toast contains network-related language (e.g., "network", "connection", "resolve host") or a clear generic failure; NOT "AuthFailed".
**Evidence:** Disable network; attempt push; capture toast text.

---

## Edge Case: No remote configured

### VAL-PUSH-040 — Push with no remote configured shows NoRemote error
**Behavior:** Repository has no "origin" remote. Clicking Push shows an error about missing remote, not an auth error.
**Pass criteria:** Error maps to `GitError::NoRemote`; toast shows "No remote configured" or equivalent.
**Evidence:** Open a repo with no remotes; attempt push; verify error toast text.

### VAL-PUSH-041 — Push button state on repo with no remote
**Behavior:** When `has_remote` is false, `ahead` and `behind` are 0 (as per `get_ahead_behind` logic), so the Push button should be disabled.
**Pass criteria:** Push button is disabled; no crash or unexpected behavior.
**Evidence:** Open repo without remote; verify button disabled state.

---

## Loading/Progress State

### VAL-PUSH-050 — Push button shows spinner while pushing
**Behavior:** While the push operation is in progress, the Push button displays a spinning loader icon (Loader2 with animate-spin) instead of the arrow icon.
**Pass criteria (main-interface):** `<Loader2 className="w-4 h-4 animate-spin" />` rendered during push.
**Pass criteria (mini-view):** `<Loader2 className="w-3.5 h-3.5 animate-spin" />` rendered during push.
**Evidence:** Visual spinner visible; DOM element is Loader2 component with spin animation.

### VAL-PUSH-051 — Push button is disabled during push operation
**Behavior:** While push is in progress (`isPushing === true`), the Push button is disabled to prevent double-push.
**Pass criteria:** Button `disabled` attribute is true during push; rapid clicking does not trigger multiple pushes.
**Evidence:** Inspect disabled state during push; check that only one push command is sent.

### VAL-PUSH-052 — Push button re-enables after successful push
**Behavior:** After push completes successfully, `isPushing` resets to false. Since `ahead` should now be 0, button returns to disabled-because-nothing-to-push state.
**Pass criteria:** Spinner disappears; button is in outline/disabled state; no stuck loading state.
**Evidence:** Button returns to non-spinning arrow icon; `disabled` attribute corresponds to `ahead == 0`.

### VAL-PUSH-053 — Push button re-enables after failed push
**Behavior:** After push fails (any error), `isPushing` resets to false in the `finally` block. Button returns to enabled state (if `ahead > 0` still).
**Pass criteria:** Spinner disappears; if `ahead > 0`, button is clickable; if `ahead == 0`, button is disabled.
**Evidence:** Button state matches expected enabled/disabled based on current `ahead` value.

---

## Status Refresh After Push

### VAL-PUSH-060 — Status refreshes after successful push
**Behavior:** After push succeeds, `refreshStatus()` is called, updating `ahead`, `behind`, and other status fields.
**Pass criteria:** `status.ahead` updates to 0; `status.behind` stays 0 (or updates appropriately); UI reflects new state.
**Evidence:** Status bar / buttons update to reflect post-push state without manual refresh.

### VAL-PUSH-061 — Status refreshes after failed push
**Behavior:** After push fails, the current implementation in main-interface does NOT call `refreshStatus()` on error path (only in try block). Mini-view also only refreshes on success. Status should still reflect pre-push state accurately.
**Pass criteria:** Status values remain consistent and accurate after a push failure; no stale or corrupted state.
**Evidence:** Check `ahead`/`behind` counts match reality after failed push.

---

## Cross-View Consistency

### VAL-PUSH-070 — Push behavior is identical in main-interface and mini-view
**Behavior:** The Smart Push feature (auto-rebase-then-push) works identically whether triggered from the main interface or the mini-view.
**Pass criteria:** Same backend command (`push` → `git_ship`) is invoked; same success/error handling occurs; same toast messages appear.
**Evidence:** Trigger push from both views with same repo state; compare behavior and toasts.

### VAL-PUSH-071 — Mini-view push button disabled conditions match main-interface
**Behavior:** Mini-view push button is disabled when `!repoPath || !isRepoReady || isPushing || !status?.ahead`. Main-interface: `!isRepoReady || isPushing || (status?.ahead || 0) === 0`. Both effectively disable when `ahead == 0`.
**Pass criteria:** Both buttons are disabled/enabled under identical conditions.
**Evidence:** Compare button state across views for various `ahead` values (0, 1, 5).

---

## Backend: ship() function behavior

### VAL-PUSH-080 — ship() detects behind > 0 and performs pull --rebase before push
**Behavior:** The `ship()` Rust function checks ahead/behind status. When `behind > 0`, it runs `git pull --rebase origin <branch>` before `git push origin <branch>`.
**Pass criteria:** Rebase pull is executed only when behind > 0; plain push when behind == 0; command sequence is correct.
**Evidence:** Rust stderr logs show "Pulling via git CLI" (rebase) before "Pushing via git CLI" when behind; only push log when not behind.

### VAL-PUSH-081 — ship() returns accurate commits_pushed count
**Behavior:** Currently hardcoded to `commits_pushed: 1`. After Smart Push, this should reflect the actual number of commits pushed.
**Pass criteria:** `commits_pushed` matches the actual number of local commits pushed to remote.
**Evidence:** Push 3 local commits; verify `ShipResult.commits_pushed == 3`. (Note: may remain as enhancement; current code hardcodes 1.)

### VAL-PUSH-082 — ship() aborts rebase on conflict and returns MergeConflict error
**Behavior:** When `git pull --rebase` fails with conflict, `ship()` runs `git rebase --abort` and returns `GitError::MergeConflict` (not `GitError::AuthFailed`).
**Pass criteria:** Error variant is `MergeConflict`; rebase is aborted; no partial rebase state.
**Evidence:** Inspect returned error type; check `ls .git/rebase-merge` does not exist post-error.

### VAL-PUSH-083 — ship() with no remote returns NoRemote error
**Behavior:** If "origin" remote doesn't exist, `ship()` returns `GitError::NoRemote` immediately without attempting push.
**Pass criteria:** Error variant is `NoRemote`; no `git push` command attempted.
**Evidence:** Rust stderr shows no push attempt; returned error is `NoRemote`.

---

## Summary Table

| ID | Title | Category |
|----|-------|----------|
| VAL-PUSH-001 | Push succeeds when ahead & remote up-to-date | Happy path |
| VAL-PUSH-002 | Push button enabled only when ahead > 0 | Button state |
| VAL-PUSH-003 | Push button shows commit count badge | Button state |
| VAL-PUSH-004 | Push button visual styling reflects ahead state | Button state |
| VAL-PUSH-010 | Smart Push auto-rebases when remote is ahead | Core feature |
| VAL-PUSH-011 | "Syncing with remote..." toast during auto-rebase | Progress |
| VAL-PUSH-012 | Smart Push succeeds with non-conflicting divergent histories | Core feature |
| VAL-PUSH-020 | Rebase conflict aborts cleanly with clear error | Error: conflict |
| VAL-PUSH-021 | No data loss on conflict during Smart Push | Error: conflict |
| VAL-PUSH-022 | Push button re-enables after conflict abort | Error: conflict |
| VAL-PUSH-030 | Push failure when behind does NOT show "AuthFailed" | Error classification |
| VAL-PUSH-031 | Genuine auth failure still shows auth error | Error classification |
| VAL-PUSH-032 | Network error shows appropriate error message | Error classification |
| VAL-PUSH-040 | No remote configured shows NoRemote error | Edge case |
| VAL-PUSH-041 | Push button state on repo with no remote | Edge case |
| VAL-PUSH-050 | Push button shows spinner while pushing | Loading state |
| VAL-PUSH-051 | Push button disabled during push operation | Loading state |
| VAL-PUSH-052 | Push button re-enables after successful push | Loading state |
| VAL-PUSH-053 | Push button re-enables after failed push | Loading state |
| VAL-PUSH-060 | Status refreshes after successful push | Status refresh |
| VAL-PUSH-061 | Status refreshes after failed push | Status refresh |
| VAL-PUSH-070 | Push behavior identical in main-interface and mini-view | Cross-view |
| VAL-PUSH-071 | Mini-view push disabled conditions match main-interface | Cross-view |
| VAL-PUSH-080 | ship() detects behind > 0 and pull --rebase before push | Backend |
| VAL-PUSH-081 | ship() returns accurate commits_pushed count | Backend |
| VAL-PUSH-082 | ship() aborts rebase on conflict, returns MergeConflict | Backend |
| VAL-PUSH-083 | ship() with no remote returns NoRemote error | Backend |
