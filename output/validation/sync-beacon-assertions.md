# Sync Beacon — Testable User-Facing Assertions

---

## 1. First-Time Setup & Gist Lifecycle

### VAL-BEACON-001: First enable creates a private Gist
**Title:** Enabling Sync Beacon for the first time creates a new private GitHub Gist  
**Description:** When a user toggles Sync Beacon ON for the first time (no Gist ID stored in config), the app calls `gh gist create` to create a new **private** Gist containing the machine's repo status JSON. The newly created Gist ID is persisted to the app config.  
**Pass:** A new private Gist is created, its ID appears in the Settings Gist ID field, and the config file stores the Gist ID.  
**Fail:** No Gist is created, or the Gist is public, or the Gist ID is not persisted.  
**Evidence:** Screenshot of Settings showing Gist ID populated; `gh gist view <id>` confirms private visibility; config file contains `syncBeaconGistId`.

### VAL-BEACON-002: First-time Gist contains valid JSON payload
**Title:** The Gist created on first enable contains well-formed beacon JSON  
**Description:** The Gist content must be valid JSON with at minimum: `machineName`, `timestamp` (ISO 8601), and a `repos` array (may be empty if no repos are open).  
**Pass:** `gh gist view <id>` returns parseable JSON with all required fields.  
**Fail:** Gist content is empty, malformed, or missing required fields.  
**Evidence:** Raw Gist content matches expected schema.

### VAL-BEACON-003: Re-enabling reuses existing Gist ID
**Title:** Disabling and re-enabling Sync Beacon reuses the previously created Gist  
**Description:** After the user toggles Sync Beacon OFF then ON again, the app does NOT create a new Gist. It updates the existing Gist using the stored Gist ID.  
**Pass:** Gist ID in settings is unchanged after disable/re-enable cycle; Gist content is updated with a fresh timestamp.  
**Fail:** A second Gist is created, or the stored Gist ID changes.  
**Evidence:** Before/after comparison of Gist ID field in settings; `gh gist list` shows only one beacon Gist.

---

## 2. Machine Name Configuration

### VAL-BEACON-004: Machine name defaults to system hostname
**Title:** Machine name field defaults to the OS hostname  
**Description:** When Sync Beacon settings are first opened and no custom machine name has been set, the machine name input is pre-populated with the system's hostname (e.g., from `computerName` in config or OS hostname).  
**Pass:** Machine name field shows the system hostname on first visit.  
**Fail:** Machine name field is blank or shows a placeholder unrelated to the hostname.  
**Evidence:** Screenshot of settings field; comparison with `hostname` terminal output.

### VAL-BEACON-005: Custom machine name persists across app restarts
**Title:** User-entered machine name is saved and restored  
**Description:** The user types a custom machine name (e.g., "Work MacBook Pro"), saves settings, quits ViboGit, and relaunches. The custom name appears in the field and is used in the next Gist update.  
**Pass:** After restart, the machine name field shows the custom name; the Gist payload contains the custom name.  
**Fail:** Machine name reverts to default or is empty after restart.  
**Evidence:** Screenshot before quit and after relaunch; Gist JSON showing custom machine name.

### VAL-BEACON-006: Machine name is written to the Gist payload
**Title:** The Gist payload uses the configured machine name  
**Description:** After setting machine name to "Studio iMac" and triggering a beacon update, the Gist JSON's `machineName` field equals "Studio iMac".  
**Pass:** `gh gist view <id>` shows `"machineName": "Studio iMac"`.  
**Fail:** Gist shows a different name or the default hostname.  
**Evidence:** Raw Gist content inspection.

### VAL-BEACON-007: Empty machine name is rejected or falls back
**Title:** Clearing machine name does not result in empty name in Gist  
**Description:** If the user clears the machine name field entirely, the app either prevents saving (validation error) or falls back to the OS hostname.  
**Pass:** Gist never contains an empty `machineName`; UI shows a validation message or auto-fills hostname.  
**Fail:** Gist payload has `"machineName": ""` or `null`.  
**Evidence:** Attempt to save empty name; inspect Gist content.

---

## 3. Enable / Disable Toggle

### VAL-BEACON-008: Toggle ON starts periodic beacon updates
**Title:** Enabling Sync Beacon starts the update interval  
**Description:** When the user toggles Sync Beacon ON, the app immediately writes to the Gist and begins a periodic timer (default 5 minutes).  
**Pass:** Gist is updated within seconds of enabling; subsequent updates occur at the configured interval.  
**Fail:** No Gist update occurs, or periodic updates don't start.  
**Evidence:** Gist timestamps showing initial write and subsequent updates at ~5-minute intervals.

### VAL-BEACON-009: Toggle OFF stops periodic updates
**Title:** Disabling Sync Beacon stops periodic Gist writes  
**Description:** After toggling OFF, no further Gist updates occur. The Gist is NOT deleted — it retains the last-written data.  
**Pass:** Gist content timestamp does not change after toggling OFF and waiting > 1 interval.  
**Fail:** Gist continues to be updated, or Gist is deleted.  
**Evidence:** Gist timestamp unchanged after waiting 10+ minutes with beacon disabled.

### VAL-BEACON-010: Toggle state persists across app restarts
**Title:** Sync Beacon enabled/disabled state survives app restart  
**Description:** User enables Sync Beacon, quits app, relaunches. The toggle remains ON and periodic updates resume automatically.  
**Pass:** Toggle is ON after restart; Gist updates resume without user intervention.  
**Fail:** Toggle resets to OFF, or updates don't resume.  
**Evidence:** Screenshot of settings after restart; Gist timestamp showing fresh update post-restart.

---

## 4. Gist ID Management & Cross-Machine Setup

### VAL-BEACON-011: Gist ID is displayed in settings
**Title:** Settings shows the current Gist ID  
**Description:** When Sync Beacon is enabled and a Gist has been created, the settings panel displays the Gist ID in a read-only field.  
**Pass:** Gist ID field is visible, non-empty, and matches the actual Gist URL.  
**Fail:** Gist ID is hidden, empty, or incorrect.  
**Evidence:** Screenshot of settings; cross-reference with `gh gist list`.

### VAL-BEACON-012: Gist ID can be copied to clipboard
**Title:** User can copy the Gist ID for sharing with other machines  
**Description:** A copy button or click-to-copy action on the Gist ID field copies the ID to the system clipboard.  
**Pass:** After clicking copy, pasting into a text editor yields the correct Gist ID.  
**Fail:** Copy action is missing, or clipboard content doesn't match the Gist ID.  
**Evidence:** Clipboard paste verification.

### VAL-BEACON-013: Machine B can join by entering Gist ID
**Title:** A second machine connects to the beacon by entering the shared Gist ID  
**Description:** On Machine B, the user opens Sync Beacon settings, enters the Gist ID from Machine A, and enables the beacon. Machine B reads the Gist, sees Machine A's data, and also begins writing its own data to the same Gist.  
**Pass:** Machine B's beacon panel shows Machine A's repo status; the Gist now contains entries for both machines.  
**Fail:** Machine B can't read the Gist, or Machine A's data is overwritten instead of appended.  
**Evidence:** Gist JSON showing both machines' entries; Machine B UI showing Machine A's repos.

### VAL-BEACON-014: Invalid Gist ID shows error
**Title:** Entering a non-existent or malformed Gist ID shows a clear error  
**Description:** If the user enters a random string or a Gist ID that doesn't exist / they don't have access to, the app shows an error message and does NOT save the invalid ID.  
**Pass:** Error message displayed (e.g., "Gist not found" or "Access denied"); Gist ID field reverts or remains empty.  
**Fail:** App silently fails, crashes, or stores the invalid ID.  
**Evidence:** Screenshot of error message; config inspection showing no invalid ID stored.

### VAL-BEACON-015: Gist ID field is read-only when auto-created
**Title:** The Gist ID cannot be accidentally edited when it was auto-created  
**Description:** When the app created the Gist automatically (first-time setup), the Gist ID field should be read-only to prevent accidental edits. The user should still be able to copy it.  
**Pass:** Gist ID field is non-editable; copy still works.  
**Fail:** User can type into the auto-created Gist ID field and corrupt it.  
**Evidence:** Attempt to type in the field; observe it's read-only.

---

## 5. Beacon Payload Content (Repo Status Data)

### VAL-BEACON-016: Single open repo is reported in Gist
**Title:** A single open repo appears in the beacon payload  
**Description:** With one repo open in ViboGit, the Gist payload's `repos` array contains exactly one entry with: `repoPath` (or repo name), `branch`, `ahead`, `behind`, `lastCommitMessage`, `lastCommitHash`, and `timestamp`.  
**Pass:** Gist shows one repo entry with all fields populated correctly matching actual git status.  
**Fail:** Repo is missing, or fields are incorrect/empty.  
**Evidence:** Gist JSON vs. `git status` and `git log -1` output for the repo.

### VAL-BEACON-017: Multiple open repos are all reported
**Title:** All open repo tabs are included in the beacon payload  
**Description:** With 3 repos open as tabs in ViboGit, the Gist payload contains 3 repo entries.  
**Pass:** Gist `repos` array length equals 3; each entry matches the corresponding tab's repo.  
**Fail:** Some repos are missing or duplicated.  
**Evidence:** Gist JSON inspection; comparison with open tabs.

### VAL-BEACON-018: Ahead/behind counts are accurate
**Title:** The `ahead` and `behind` counts in the beacon match actual git state  
**Description:** For a repo that is 2 commits ahead and 1 commit behind origin, the beacon payload reports `"ahead": 2, "behind": 1`.  
**Pass:** Beacon values match `git status` or `git rev-list --count` output.  
**Fail:** Counts are 0 when they shouldn't be, or don't match actual state.  
**Evidence:** Side-by-side of Gist payload and terminal `git status`.

### VAL-BEACON-019: Branch name is current at time of write
**Title:** The reported branch reflects the currently checked-out branch  
**Description:** After switching from `main` to `feature/xyz`, the next beacon update reports `"branch": "feature/xyz"`.  
**Pass:** Gist branch field matches the branch shown in ViboGit's UI and `git branch --show-current`.  
**Fail:** Stale branch name persists after switching.  
**Evidence:** Gist JSON after branch switch.

### VAL-BEACON-020: No repos open results in empty repos array
**Title:** Beacon payload has empty repos when no repo tab is open  
**Description:** If the user closes all repo tabs but Sync Beacon is enabled, the Gist is still updated with the machine name and timestamp, but `repos: []`.  
**Pass:** Gist is valid JSON with `"repos": []`; machine entry is still present.  
**Fail:** Gist update fails, or stale repo data persists.  
**Evidence:** Gist content with no repos open.

### VAL-BEACON-021: Last commit info is included
**Title:** Beacon includes the most recent commit message and short hash  
**Description:** For each repo, the beacon includes `lastCommitMessage` and `lastCommitHash` reflecting the HEAD commit.  
**Pass:** Values match `git log -1 --format="%h %s"` output.  
**Fail:** Fields are missing, empty, or show a non-HEAD commit.  
**Evidence:** Gist JSON vs. terminal git log output.

---

## 6. Remote Machines Panel — Viewing Other Machines

### VAL-BEACON-022: Remote machine appears in beacon panel
**Title:** Another machine's data is displayed in the Sync Beacon panel  
**Description:** When Machine B has been writing to the shared Gist, Machine A's beacon panel shows an entry for Machine B with its machine name, repos, and last-updated timestamp.  
**Pass:** Machine B's name and repos are visible in Machine A's UI.  
**Fail:** Panel is empty or shows only the local machine.  
**Evidence:** Screenshot of beacon panel on Machine A showing Machine B's data.

### VAL-BEACON-023: Remote machine shows per-repo details
**Title:** Each remote machine's repos show branch, ahead/behind, and last commit  
**Description:** For each repo listed under a remote machine, the UI displays: repo name/path, branch name, ahead count, behind count, and last commit summary.  
**Pass:** All fields are visible and match the Gist payload.  
**Fail:** Fields are missing or truncated.  
**Evidence:** Screenshot of expanded remote machine entry.

### VAL-BEACON-024: Unpushed work indicator is visible
**Title:** Repos with `ahead > 0` show a visual "unpushed work" indicator  
**Description:** When a remote machine's repo has `ahead >= 1`, the UI displays a prominent visual indicator (e.g., orange badge, warning icon, "X commits ahead" label) to alert the user there's unpushed work on that machine.  
**Pass:** Visual indicator is present and clearly distinguishable for ahead > 0; absent for ahead = 0.  
**Fail:** No visual difference between repos with and without unpushed commits.  
**Evidence:** Screenshots comparing a repo with ahead=0 and ahead=3.

### VAL-BEACON-025: Unpushed work shows commit count
**Title:** The unpushed work indicator shows the exact number of ahead commits  
**Description:** If a remote machine's repo is 5 commits ahead, the indicator says "5 commits ahead" (or "5↑" or similar quantified label), not just a generic warning.  
**Pass:** Count displayed matches the `ahead` value in the Gist.  
**Fail:** Generic "unpushed" label without a count, or incorrect count.  
**Evidence:** Screenshot with specific ahead count visible.

### VAL-BEACON-026: Stale remote machine shows "last seen" age
**Title:** A machine that hasn't updated recently shows how long ago it was last seen  
**Description:** If Machine B's last Gist update was 2 hours ago, Machine A's UI shows "Last updated: 2 hours ago" or similar relative timestamp.  
**Pass:** Relative time is shown and is approximately correct.  
**Fail:** No timestamp shown, or it says "just now" for stale data.  
**Evidence:** Screenshot showing relative time for a machine whose last update was > 1 hour ago.

### VAL-BEACON-027: Local machine is excluded from remote panel
**Title:** The current machine does not appear in the "remote machines" list  
**Description:** The beacon panel shows only OTHER machines. The local machine's own entry is filtered out by matching machine name.  
**Pass:** Local machine name does not appear in the remote machines list.  
**Fail:** Local machine appears as a remote entry, causing confusion.  
**Evidence:** Screenshot of remote panel; verify local machine name is absent.

---

## 7. Manual Refresh

### VAL-BEACON-028: Manual refresh button fetches latest Gist data
**Title:** Clicking the refresh button re-reads the Gist and updates the display  
**Description:** User clicks a "Refresh" button in the beacon panel. The app fetches the current Gist content and refreshes the remote machines display.  
**Pass:** After another machine updates its status, clicking refresh on the local machine shows the new data.  
**Fail:** Data remains stale after clicking refresh; no network request is made.  
**Evidence:** Before/after screenshots of the remote panel around a refresh action; network log showing Gist read.

### VAL-BEACON-029: Manual refresh shows loading state
**Title:** The refresh action shows a loading/spinner indicator  
**Description:** While the Gist is being fetched, the UI shows a loading spinner or "Refreshing..." indicator on the refresh button or panel.  
**Pass:** Loading indicator appears during fetch and disappears when complete.  
**Fail:** No loading feedback; button appears unresponsive.  
**Evidence:** Screenshot captured during refresh showing spinner.

### VAL-BEACON-030: Manual refresh updates "last refreshed" timestamp
**Title:** After manual refresh, a "last refreshed" indicator updates  
**Description:** The panel shows when data was last fetched (e.g., "Last refreshed: just now"). After a manual refresh, this updates.  
**Pass:** Timestamp changes to "just now" or current time after refresh.  
**Fail:** Timestamp is absent or doesn't update.  
**Evidence:** Before/after screenshots of the "last refreshed" indicator.

---

## 8. Auto-Refresh Behavior

### VAL-BEACON-031: Auto-refresh on app focus
**Title:** Bringing ViboGit to the foreground triggers a beacon read  
**Description:** When ViboGit regains window focus (e.g., Cmd+Tab back to it), the app automatically fetches the latest Gist data and updates the remote machines panel.  
**Pass:** Remote machine data updates automatically when switching back to ViboGit without manual refresh.  
**Fail:** Data remains stale until manual refresh after app regains focus.  
**Evidence:** Modify Gist externally, switch to ViboGit, observe data updates.

### VAL-BEACON-032: Auto-refresh does not trigger when beacon is disabled
**Title:** Focus-based refresh is skipped when Sync Beacon is OFF  
**Description:** If Sync Beacon is disabled, switching to ViboGit does NOT make any Gist API calls.  
**Pass:** No Gist read requests when beacon is disabled, even on focus events.  
**Fail:** Gist reads occur despite beacon being disabled.  
**Evidence:** Network/log inspection showing no Gist calls with beacon off.

---

## 9. Update Interval Configuration

### VAL-BEACON-033: Default update interval is 5 minutes
**Title:** The beacon writes to the Gist every 5 minutes by default  
**Description:** Without changing any settings, the beacon updates the Gist approximately every 5 minutes.  
**Pass:** Gist timestamps show ~5-minute gaps between updates.  
**Fail:** Updates are more or less frequent than 5 minutes by a significant margin.  
**Evidence:** Series of Gist timestamps showing consistent ~5-minute intervals.

### VAL-BEACON-034: Update interval is configurable
**Title:** User can change the beacon update interval  
**Description:** The user changes the interval to 2 minutes in settings. The beacon then updates every ~2 minutes.  
**Pass:** After changing to 2 minutes, Gist updates occur at ~2-minute intervals.  
**Fail:** Interval change has no effect; updates continue at old interval.  
**Evidence:** Gist timestamps after interval change.

### VAL-BEACON-035: Interval change takes effect without restart
**Title:** Changing the interval applies immediately  
**Description:** After changing the interval from 5 to 1 minute, the new interval applies without restarting the app.  
**Pass:** Next update occurs ~1 minute after the change, not ~5 minutes.  
**Fail:** Old interval persists until app restart.  
**Evidence:** Timestamp of first update after interval change.

---

## 10. gh CLI Dependency & Authentication

### VAL-BEACON-036: Missing gh CLI shows clear error
**Title:** Sync Beacon shows an error when `gh` CLI is not installed  
**Description:** If `gh` is not in PATH, attempting to enable Sync Beacon shows a user-friendly error message explaining that `gh` CLI is required and how to install it.  
**Pass:** Error message names `gh` CLI, suggests install method (e.g., `brew install gh`), and the toggle does not enable.  
**Fail:** Cryptic error, silent failure, or app crash.  
**Evidence:** Screenshot of error with gh removed from PATH.

### VAL-BEACON-037: Unauthenticated gh CLI shows auth error
**Title:** Sync Beacon shows an error when `gh` is installed but not authenticated  
**Description:** If `gh auth status` reports not authenticated, enabling Sync Beacon shows an error explaining the user must run `gh auth login` first.  
**Pass:** Error message mentions authentication; toggle does not enable or reverts.  
**Fail:** Silent failure or generic error without mentioning auth.  
**Evidence:** Screenshot of error after `gh auth logout`.

### VAL-BEACON-038: gh auth check happens before Gist operations
**Title:** The app validates `gh` auth status before attempting any Gist create/read/update  
**Description:** On enable, the app first checks `gh auth status`. If it fails, no Gist operation is attempted.  
**Pass:** No orphaned Gist creation attempts; error shown proactively.  
**Fail:** App attempts Gist creation and then fails with an opaque error.  
**Evidence:** App logs showing auth check before Gist operations.

---

## 11. Error Handling — Gist Inaccessible / Deleted

### VAL-BEACON-039: Deleted Gist is detected gracefully
**Title:** If the beacon Gist is deleted externally, the app detects and reports it  
**Description:** User deletes the Gist via `gh gist delete <id>`. On the next beacon update or refresh, the app detects the 404 and shows an error with an option to create a new Gist.  
**Pass:** Error message says the Gist was not found; option to "Create New Gist" or "Reset Beacon" is available.  
**Fail:** Silent failure, repeated 404 errors in background, or crash.  
**Evidence:** Screenshot of error state after external Gist deletion.

### VAL-BEACON-040: Permission denied on Gist shows error
**Title:** Accessing a Gist the user doesn't own shows an access error  
**Description:** If Machine B enters a Gist ID that belongs to a different GitHub account (not shared), the app shows "Access denied" or "Permission error".  
**Pass:** Clear error message about permissions; no data shown for inaccessible Gist.  
**Fail:** Generic error or hang.  
**Evidence:** Screenshot of error when using another account's Gist ID.

### VAL-BEACON-041: Network failure during write is handled
**Title:** A network failure during Gist update does not crash or corrupt data  
**Description:** If the network drops during a beacon write, the app logs the failure, retains the local data, and retries on the next interval.  
**Pass:** No crash; error logged or shown transiently; next interval's write succeeds when network returns.  
**Fail:** App crashes, data is lost, or beacon stops permanently.  
**Evidence:** Simulate network drop (e.g., airplane mode); observe recovery after reconnect.

### VAL-BEACON-042: Network failure during read is handled
**Title:** A network failure during Gist read shows stale data with warning  
**Description:** If the network is down when refreshing, the app keeps showing the last-known remote machine data and displays a "Could not refresh — showing cached data" warning.  
**Pass:** Previous data remains visible; warning indicator present.  
**Fail:** Panel goes blank, or no indication that data is stale.  
**Evidence:** Screenshot of panel during network outage.

### VAL-BEACON-043: Corrupted Gist content is handled
**Title:** Malformed JSON in the Gist does not crash the app  
**Description:** If the Gist content is corrupted (e.g., manually edited to invalid JSON), the app detects the parse error and shows an error without crashing.  
**Pass:** Error message about invalid beacon data; app remains functional.  
**Fail:** Unhandled exception, blank screen, or app crash.  
**Evidence:** Manually edit Gist to `{invalid`, then refresh beacon.

---

## 12. Multi-Machine Data Integrity

### VAL-BEACON-044: Two machines can write without overwriting each other
**Title:** Concurrent writes from two machines preserve both entries  
**Description:** Machine A and Machine B both write to the same Gist. Each machine's write includes its own data AND preserves the other machine's data (read-modify-write pattern).  
**Pass:** Gist always contains entries for both machines after both have written.  
**Fail:** One machine's data disappears after the other machine writes.  
**Evidence:** Gist content after interleaved writes from both machines.

### VAL-BEACON-045: Three or more machines are supported
**Title:** The beacon supports more than two machines sharing a Gist  
**Description:** Machines A, B, and C all write to and read from the same Gist. All three entries coexist.  
**Pass:** Gist contains 3 machine entries; each machine's UI shows the other 2.  
**Fail:** Data loss or display issues with 3+ machines.  
**Evidence:** Gist JSON with 3 machine entries; screenshots from each machine.

### VAL-BEACON-046: Machine name conflict shows both entries
**Title:** Two machines with the same name are handled without data loss  
**Description:** If two machines both use "MacBook Pro" as their name, both entries appear in the Gist (differentiated by some unique identifier or timestamp).  
**Pass:** Both machines' data is preserved; UI shows both entries (possibly with disambiguation).  
**Fail:** One machine's data overwrites the other due to name collision.  
**Evidence:** Gist content with two same-name entries.

---

## 13. Settings UI

### VAL-BEACON-047: Sync Beacon section exists in Settings
**Title:** Settings panel has a Sync Beacon configuration section  
**Description:** In the Settings panel, there is a clearly labeled section (or tab) for "Sync Beacon" containing: enable/disable toggle, machine name input, Gist ID display, and update interval setting.  
**Pass:** All four controls are visible and labeled.  
**Fail:** Section is missing, or controls are incomplete.  
**Evidence:** Screenshot of the Sync Beacon settings section.

### VAL-BEACON-048: Settings changes save immediately
**Title:** Sync Beacon setting changes are saved without a separate "Save" button  
**Description:** Consistent with the app's existing auto-save pattern, changes to beacon settings (toggle, machine name, interval) save automatically.  
**Pass:** Changes persist after navigating away from settings and back.  
**Fail:** Changes are lost without explicit save action.  
**Evidence:** Change machine name, switch tabs, return — name is preserved.

### VAL-BEACON-049: Settings show beacon status indicator
**Title:** Settings indicate whether the beacon is actively syncing  
**Description:** When Sync Beacon is enabled, the settings section shows a status indicator (e.g., green dot, "Active", or last successful sync time).  
**Pass:** Status indicator is present and reflects actual sync state.  
**Fail:** No status feedback; user can't tell if beacon is working.  
**Evidence:** Screenshot showing active status indicator.

---

## 14. Beacon Panel Access & Navigation

### VAL-BEACON-050: Beacon panel is accessible from sidebar or navigation
**Title:** Users can access the Sync Beacon panel from the main UI  
**Description:** A sidebar item, toolbar button, or menu entry opens the Sync Beacon panel showing remote machines' status.  
**Pass:** Navigation element exists and opens the beacon panel on click.  
**Fail:** No discoverable way to access the beacon panel.  
**Evidence:** Screenshot showing navigation element and the opened panel.

### VAL-BEACON-051: Beacon panel is hidden when feature is disabled
**Title:** The Sync Beacon panel/nav item is hidden or disabled when the feature is OFF  
**Description:** When Sync Beacon is disabled in settings, the navigation item is either hidden, grayed out, or shows an "Enable in Settings" prompt.  
**Pass:** Panel is inaccessible or clearly marked as disabled.  
**Fail:** Panel opens but shows broken/empty state without guidance.  
**Evidence:** Screenshot with beacon disabled; observe nav state.

---

## 15. Edge Cases & Robustness

### VAL-BEACON-052: App launch with beacon enabled starts syncing immediately
**Title:** On launch with beacon previously enabled, sync resumes automatically  
**Description:** The user had beacon enabled, quit the app, and relaunches. Beacon starts writing and reading on launch without requiring any user action.  
**Pass:** Gist is updated shortly after app launch; remote panel shows data.  
**Fail:** Beacon doesn't start until user visits settings or manually triggers it.  
**Evidence:** Gist timestamp within 1 minute of app launch.

### VAL-BEACON-053: Large number of repos doesn't break Gist
**Title:** Machine with many repos (10+) doesn't exceed Gist size limits  
**Description:** With 15 repos open, the beacon payload is written successfully to the Gist.  
**Pass:** All 15 repos appear in the Gist payload; no truncation or API error.  
**Fail:** Gist write fails due to size, or repos are silently dropped.  
**Evidence:** Gist content showing all 15 repo entries.

### VAL-BEACON-054: Repo with no remote doesn't cause write failure
**Title:** A local-only repo (no git remote) is included in beacon without error  
**Description:** If one of the open repos has no remote configured, it should still appear in the beacon with ahead/behind as 0 (or N/A) and not prevent other repos from being reported.  
**Pass:** Local-only repo appears in payload; other repos are unaffected.  
**Fail:** Beacon write fails entirely, or local-only repo is missing without explanation.  
**Evidence:** Gist content with a mix of remote and local-only repos.

### VAL-BEACON-055: Repo on detached HEAD is handled
**Title:** A repo in detached HEAD state reports correctly  
**Description:** If a repo is in detached HEAD state, the beacon should report the commit hash instead of a branch name, or show "detached HEAD".  
**Pass:** Branch field shows commit hash or "HEAD detached at abc1234".  
**Fail:** Branch is empty, "undefined", or causes a write error.  
**Evidence:** Gist content for a detached HEAD repo.

### VAL-BEACON-056: Rapid tab switching doesn't cause duplicate/stale writes
**Title:** Rapidly opening and closing repo tabs doesn't corrupt beacon data  
**Description:** The user rapidly opens 5 repos and closes 3. The next beacon write reflects only the 2 currently open repos.  
**Pass:** Gist contains exactly the repos that are currently open at write time.  
**Fail:** Stale repos from closed tabs persist, or repos are duplicated.  
**Evidence:** Gist content after rapid tab changes.

### VAL-BEACON-057: Clock skew between machines doesn't break display
**Title:** Timestamps from machines with different system clocks are handled  
**Description:** If Machine A's clock is 10 minutes ahead of Machine B, the UI should still correctly interpret timestamps and show reasonable "last updated" values.  
**Pass:** "Last updated" times are plausible and don't show future times or negative durations.  
**Fail:** "Last updated: in 10 minutes" or other nonsensical displays.  
**Evidence:** Compare displayed time with actual Gist timestamp.

### VAL-BEACON-058: Very long repo paths or names are truncated gracefully
**Title:** Extremely long repo paths don't break the UI layout  
**Description:** A repo with a path like `/Users/user/very/deeply/nested/directory/structure/my-extremely-long-project-name` displays correctly with truncation or tooltip.  
**Pass:** Path is truncated with ellipsis or similar; full path available via tooltip or hover.  
**Fail:** UI breaks, overflows, or path is cut off without indication.  
**Evidence:** Screenshot with a long repo path.

### VAL-BEACON-059: Beacon works after sleep/wake cycle
**Title:** Beacon resumes correctly after macOS sleep and wake  
**Description:** Machine goes to sleep for 30 minutes. On wake, the beacon resumes: writes local data and reads remote data.  
**Pass:** Gist is updated after wake; remote panel refreshes.  
**Fail:** Timer is permanently broken after sleep; no updates until app restart.  
**Evidence:** Gist timestamps showing gap during sleep and resume after wake.

### VAL-BEACON-060: GitHub API rate limits are handled
**Title:** Hitting GitHub API rate limits doesn't crash or permanently disable beacon  
**Description:** If `gh` CLI returns a rate limit error, the beacon backs off gracefully, shows a transient warning, and retries after the rate limit window.  
**Pass:** Warning shown; beacon retries successfully after rate limit expires.  
**Fail:** Beacon stops permanently, or error is not communicated to user.  
**Evidence:** Log showing rate limit handling and successful retry.
