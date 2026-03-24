---
title: "Sync Beacon v2 - Lightweight Machine Sync"
created: 2026-03-24
status: approved
project11_id: pd745kxc0d1m9mvcw0eqbeadd583hw0v
tags: [sync-beacon, ux, performance, gist-api]
---

# PRD: Sync Beacon v2 - Lightweight Machine Sync

## Problem Statement

The current Sync Beacon has three critical issues:

1. **Runaway push loop**: A React `useEffect` dependency bug causes pushes every 2-3 seconds instead of every 5 minutes, exhausting GitHub's `gist_update` rate limit (100/hr). The `pushBeacon` callback is in the effect's dependency array and changes every time any repo status changes, causing the effect to tear down and re-run continuously.

2. **Wasteful data**: Pushes all ~20 repos every cycle when the user only cares about the currently open project's status on the other machine.

3. **Confusing pairing UX**: Both machines auto-generate different codes on enable, with no indication they need to share the same code. Users think they're connected (badge shows "Active") when they're actually writing to separate gists.

## Goals & Success Metrics

| Goal | Metric |
|------|--------|
| Efficient API usage | < 20 gist updates/hour under normal 2-3 machine usage |
| Simple pairing | Pairing takes one step on the second machine |
| Useful at a glance | User can see if other machine is ahead/behind on current repo without navigating away |

## User Stories

1. **As a developer with 2 machines**, I want to see at a glance whether my other machine has unpushed commits on the repo I'm currently working on, so I know to pull before starting work.

2. **As a first-time user**, I want to pair my machines in under 30 seconds with a clear "create on one, join on the other" flow, so I don't accidentally create separate beacons.

3. **As a power user with 3 machines**, I want the beacon to use minimal API calls so I never hit GitHub's rate limits during normal use.

## Redesigned UX

### Pairing Flow

```
Machine A (creator):
  Settings > Sync Beacon
  [Create Beacon] --> checks gh auth --> generates code "t082z0"
  Shows: "Share this code with your other machines"
  +--------------------------------------------+
  | Your Beacon Code                           |
  | +------+                                   |
  | |t082z0|  [Copy]                           |
  | +------+                                   |
  | Share this code with your other machines   |
  | to join the same beacon.                   |
  +--------------------------------------------+

Machine B (joiner):
  Settings > Sync Beacon
  +--------------------------------------------+
  | [Create Beacon]  or  [Join Beacon]         |
  +--------------------------------------------+
  Clicks "Join Beacon" -->
  +--------------------------------------------+
  | Enter Pairing Code                         |
  | [______] [Join]                            |
  +--------------------------------------------+
  Types "t082z0" --> validates via pull -->
  "Connected to beacon with 1 other machine"
```

No auto-generate on the second machine. Clear two-path choice.

### Status Display — Inline Badge in Repo Action Bar

Current repo header action bar:
```
| [Pull] [Fetch] [Push(1)] [Commit] |
```

With beacon status (matched by remote URL):
```
| [Pull] [Fetch] [Push(1)] [Commit]  | Hello: ✓ synced |
```

When other machine is ahead:
```
| [Pull] [Fetch] [Push(1)] [Commit]  | Hello: 2 ahead ⚠ |
```

When other machine has no data for this repo:
```
(no badge shown — don't clutter the UI)
```

Only shows for repos where the remote origin URL matches across machines.

### UX Journey

```
[Settings: Sync Beacon]
    |                    |
    v                    v
[Create Beacon]     [Join Beacon]
    |                    |
    v                    v
[Show code +        [Enter code]
 Copy button]            |
    |                    v
    v              [Validate pull]
[Push active             |
 repo on change]         v
    |              [Connected ✓]
    v                    |
[Gist updated]           v
    |              [Push active
    v               repo on change]
[Other machine           |
 reads gist]             v
    |              [Gist updated]
    v
[Badge shown in
 repo header if
 remote URL matches]
```

## Requirements

### Functional

1. **Fix runaway push loop** — Use refs for `pushBeacon`/`refreshBeacon` callbacks so the `useEffect` only depends on `syncBeaconEnabled` and `connection` state (stable values).

2. **Only push active project** — Instead of building `beaconRepos` from all projects, only include the currently active tab's repo with its remote origin URL.

3. **Diff-before-push** — Track last-pushed state (branch, ahead, behind, lastCommitHash) in a ref. Skip the API call entirely if nothing changed.

4. **Minimum push interval** — Never push more than once per 60 seconds, even if state changes rapidly.

5. **Add `remoteUrl` to `BeaconRepo`** — Read origin remote URL via git2 in the Rust backend. Include it in the beacon payload for cross-machine matching.

6. **Match repos by remote URL** — When displaying other machine's status, only show repos where `remoteUrl` matches the current repo's remote URL.

7. **Inline status badge** — Show a compact badge in the repo action bar header showing other machine(s) ahead/behind status. No badge if no match.

8. **Redesign Settings pairing flow** — Two clear paths: "Create Beacon" (generates code) and "Join Beacon" (input field). No auto-generate on the joining machine.

### Non-Functional

1. **Rate limit budget**: < 20 gist PATCH calls per hour with 2-3 machines
2. **Payload size**: ~500 bytes per push (1 repo) vs current ~15KB (20 repos)
3. **Backward compatibility**: New versions should still read old multi-repo gist format gracefully

## Technical Considerations

### GitHub Gist Rate Limits
- `gist_update` resource: 100 PATCH/POST per hour (separate from the 5,000/hr core limit)
- GET requests use the core limit, not gist_update
- With diff-before-push + 60s minimum interval: worst case ~60 updates/hour from one machine, typical ~5-10

### Files to Modify

| File | Change |
|------|--------|
| `packages/ui/src/lib/sync-beacon-context.tsx` | Fix useEffect deps, only push active project, diff-before-push, min interval |
| `packages/ui/src/components/sync-beacon-panel.tsx` | Simplify or remove (replaced by inline badge) |
| `packages/ui/src/components/main-interface.tsx` | Add inline beacon status badge in action bar |
| `packages/ui/src/components/settings/sections/SyncBeaconSettingsSection.tsx` | Redesign: "Create Beacon" / "Join Beacon" flow |
| `apps/desktop/src-tauri/src/commands.rs` | Add `remoteUrl` to `BeaconRepo`, read origin URL from git2 |
| `packages/shared/src/types.ts` | Add `remoteUrl` to `SyncBeaconRepo` type |

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Old versions still running on other machines | Read function handles both old multi-repo and new single-repo format |
| Remote URL mismatch (SSH vs HTTPS) | Normalize URLs before comparison (strip `.git`, normalize `git@` to `https://`) |
| Rate limit hit during burst of changes | 60s minimum interval + diff-before-push prevents bursts |

## Open Questions

1. Should the beacon panel page be kept at all, or fully replaced by the inline badge?
2. Should we show dirty/uncommitted file count from the other machine, or just ahead/behind?
