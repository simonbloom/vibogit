---
title: "Connection Status Bar"
created: 2026-01-27
status: approved
project11_id: pd7cy1qp2dek9w23nd01cxfjq18004t1
tags: [ux, daemon, quick-win]
---

# PRD: Connection Status Bar

## Problem Statement
Users have no visibility into daemon connection status. When the daemon crashes or port gets stuck, users see confusing errors or a blank "Start the daemon" screen with no easy recovery path.

## Goals
1. Always show connection status visually
2. Provide one-click reconnect capability
3. Reduce support burden and user frustration

## Success Metrics
- Zero manual terminal commands needed for reconnection
- Connection issues resolved in < 3 seconds
- User always knows current connection state

## User Stories
1. As a user, I want to see if I am connected to the daemon at a glance
2. As a user, I want to click a button to reconnect when disconnected
3. As a user, I want clear feedback when reconnection is in progress

## Requirements

### Functional
| Priority | Requirement |
|----------|-------------|
| Must | Show connection status indicator (connected/connecting/disconnected/error) |
| Must | Provide "Reconnect" button when disconnected |
| Must | Show spinner during reconnection attempt |
| Should | Display error message on connection failure |
| Should | Auto-hide reconnect button when connected |

### Non-Functional
- Status indicator must update within 100ms of state change
- Reconnect attempt must timeout after 5 seconds
- Component must not block UI rendering

## ASCII UI Mockups

### Header with Status (Connected)
```
+------------------------------------------------------------------+
|  [Logo] ViboGit    [Tabs...]              [⚙️]  [🟢 Connected]   |
+------------------------------------------------------------------+
```

### Header with Status (Disconnected)
```
+------------------------------------------------------------------+
|  [Logo] ViboGit    [Tabs...]    [🔴 Disconnected] [↻ Reconnect]  |
+------------------------------------------------------------------+
```

### Header with Status (Connecting)
```
+------------------------------------------------------------------+
|  [Logo] ViboGit    [Tabs...]              [🟡 Connecting...]     |
+------------------------------------------------------------------+
```

## Technical Details

### Files to Modify
- `apps/web/src/components/connection-indicator.tsx` (new)
- `apps/web/src/app/page.tsx` (add indicator)
- `apps/web/src/lib/daemon-context.tsx` (add manual reconnect)

### Component Structure
```tsx
// connection-indicator.tsx
export function ConnectionIndicator() {
  const { state, reconnect } = useDaemon();
  
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={state.connection} />
      <span>{statusLabel[state.connection]}</span>
      {state.connection === "disconnected" && (
        <Button size="sm" onClick={reconnect}>Reconnect</Button>
      )}
    </div>
  );
}
```

### Daemon Context Changes
Add `reconnect()` function that:
1. Closes existing WebSocket if any
2. Clears pending requests
3. Initiates new connection

## Acceptance Criteria
- [ ] Status dot shows green when connected
- [ ] Status dot shows yellow when connecting
- [ ] Status dot shows red when disconnected
- [ ] Reconnect button appears only when disconnected
- [ ] Clicking Reconnect initiates new WebSocket connection
- [ ] Status updates within 100ms of connection state change
- [ ] Component renders in header area without layout shift

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Reconnect spam | Disable button during connection attempt |
| Memory leaks | Properly cleanup WebSocket on reconnect |
| UI flicker | Debounce rapid state changes |

## Launch Plan
1. Implement ConnectionIndicator component
2. Add reconnect() to daemon context
3. Integrate into page header
4. Test connection scenarios
5. Ship it
