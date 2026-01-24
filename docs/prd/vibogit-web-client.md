---
title: "ViboGit - Git for the Vibe Coder"
created: 2026-01-23
status: draft
project11_id: pd751hyb762nrsgm7rp8htyqqh7zrck1
tags: [vibogit, web, nextjs, convex, daemon, vibe-coding]
---

# PRD: ViboGit - Git for the Vibe Coder

## Philosophy

> **"Git should be invisible. You code, you save, you ship."**

ViboGit is designed for the **Vibe Coder** - developers who:
- Code with AI assistants (Cursor, Copilot, Claude)
- Ship fast and iterate quickly
- Don't want to think about branches, staging, or merge conflicts
- Want beautiful tools that spark joy

Traditional git clients expose too much complexity. ViboGit abstracts it away.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         THE VIBE CODER'S MENTAL MODEL                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   TRADITIONAL GIT:                    VIBOGIT:                              │
│   ────────────────                    ────────                              │
│                                                                             │
│   1. git status                       1. Click "Save" ⚡                    │
│   2. git add -p                          (AI writes commit message)         │
│   3. think of commit message                                                │
│   4. git commit -m "..."              2. Click "Ship" 🚀                    │
│   5. git push origin feature/x           (push to remote)                   │
│   6. go to GitHub                                                           │
│   7. create PR                        That's it.                            │
│   8. write PR description                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Problem Statement

Git is powerful but complex. The Vibe Coder doesn't want to:
- Memorize git commands
- Think about what to stage
- Write commit messages
- Understand the difference between fetch and pull
- Parse cryptic merge conflict markers

They want to **code, save their work, and ship it** - with a beautiful UI that shows them just enough to feel in control.

## Target User: The Vibe Coder

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIBE CODER PERSONA                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   WHO THEY ARE:                                                             │
│   • Builds with AI (Cursor, Copilot, Claude, ChatGPT)                       │
│   • Ships MVPs fast, iterates based on feedback                             │
│   • May be new to coding or a veteran who's tired of git                    │
│   • Values aesthetics - tools should look good                              │
│   • Works solo or on small teams                                            │
│                                                                             │
│   WHAT THEY SAY:                                                            │
│   • "I just want to save my work and not lose it"                           │
│   • "Git is confusing, I always mess something up"                          │
│   • "Why do I need to write a commit message? Just describe what I did"     │
│   • "I don't care about branches, I just want to ship"                      │
│                                                                             │
│   WHAT THEY NEED:                                                           │
│   • One-click save (AI writes the commit message)                           │
│   • One-click ship (push to remote, create PR if needed)                    │
│   • Visual confirmation that their work is safe                             │
│   • A beautiful timeline showing their progress                             │
│   • Quick access to their code in the browser, editor, terminal             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Goals & Success Metrics

| Goal | Success Metric |
|------|----------------|
| Simplify git for Vibe Coders | 80% of actions done with ≤2 clicks |
| Beautiful commit visualization | Users say "wow" when they see the timeline |
| Instant feedback loop | < 500ms from file save to UI update |
| Zero git knowledge required | New user can save & ship in < 30 seconds |
| Joy to use | NPS > 50 |

## Core Concepts (Vibe Coder Language)

We translate git concepts into simpler terms:

| Git Term | ViboGit Term | Why |
|----------|--------------|-----|
| Commit | **Save** | Familiar, non-technical |
| Push | **Ship** | Action-oriented, exciting |
| Stage | *(hidden)* | We auto-stage everything |
| Pull | **Sync** | Bidirectional, simple |
| Branch | **Timeline** | Visual, intuitive |
| Merge | **Combine** | Clear action |
| Stash | **Pocket** | Temporary storage metaphor |
| Diff | **Changes** | Plain English |

## User Stories

### Primary (P0)
1. **As a Vibe Coder**, I can click "Save" and my changes are committed with an AI-generated message.
2. **As a Vibe Coder**, I can click "Ship" and my changes are pushed to the remote.
3. **As a Vibe Coder**, I can see a beautiful timeline of my project's history.
4. **As a Vibe Coder**, the app auto-refreshes when I make changes in my editor.
5. **As a Vibe Coder**, I can quickly open my project in the browser, terminal, or editor.

### Secondary (P1)
6. **As a Vibe Coder**, I can see exactly what I changed before saving.
7. **As a Vibe Coder**, I can work on multiple projects in tabs.
8. **As a Vibe Coder**, I can start/stop my dev server from the UI.
9. **As a Vibe Coder**, I can create a PR with one click (AI writes the description).
10. **As a Vibe Coder**, I can "pocket" my changes if I need to switch contexts.

## ASCII UI Mockups

### Main Interface - Simplified View

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌──────────┐ ┌───┐                                            │
│ │ 🟢 myapp │ │ 🔵 api   │ │ + │                                            │
│ └──────────┘ └──────────┘ └───┘                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   myapp                                                                     │
│   ══════════════════════════════════════════════════════════════════════   │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │    ⚡ SAVE                           🚀 SHIP                        │  │
│   │    5 changes ready                   2 saves to ship                │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  CHANGES (5)                                            [Show All]  │  │
│   ├─────────────────────────────────────────────────────────────────────┤  │
│   │                                                                     │  │
│   │   📝 Button.tsx          +12 lines                                  │  │
│   │   📝 helpers.ts          +45 lines                                  │  │
│   │   ✨ newfile.ts          +20 lines (new)                            │  │
│   │   ...2 more                                                         │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  TIMELINE                                              [Expand ↓]   │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│                    [🌐 Open]  [💻 Code]  [📁 Files]  [⚙️]                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Timeline - Beautiful Commit Graph

This is the crown jewel. The commit graph should be **stunning** - like a piece of generative art.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  TIMELINE                                              main ○               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   NOW ─────────────────────────────────────────────────────────────────     │
│                                                                             │
│         ┌────────────────────────────────────────────────────┐              │
│      ◉──┤  Added user authentication                         │ 2h ago      │
│      │  │  Button.tsx, helpers.ts, auth.ts                   │              │
│      │  └────────────────────────────────────────────────────┘              │
│      │                                                                      │
│      │  ┌────────────────────────────────────────────────────┐              │
│      ◉──┤  Fixed loading spinner position                    │ 5h ago      │
│      │  │  Spinner.tsx                                       │              │
│      │  └────────────────────────────────────────────────────┘              │
│      │                                                                      │
│      ●━━━━━━━━━━━●  feature/oauth merged                       1d ago      │
│      │           │                                                          │
│      │           │  ┌────────────────────────────────────────┐              │
│      │           ◉──┤  Implement OAuth flow                  │              │
│      │           │  │  oauth.ts, login.tsx                   │              │
│      │           │  └────────────────────────────────────────┘              │
│      │           │                                                          │
│      │           │  ┌────────────────────────────────────────┐              │
│      │           ◉──┤  Add OAuth provider config             │              │
│      │              │  config.ts                              │              │
│      │              └────────────────────────────────────────┘              │
│      │                                                                      │
│      ◉  Started OAuth integration                              2d ago       │
│      │                                                                      │
│      ⋮                                                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Design Notes:
• ◉ = your commits (accent color, glowing)
• ○ = branch indicator  
• ●━━━● = merge (smooth bezier curves, not hard angles)
• Cards slide in with subtle animation
• Hover shows full details
• Time markers on the right create visual rhythm
• Branches flow like rivers, not railroad tracks
```

### Changes View - What Did I Change?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHANGES                                                           [Close]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   Button.tsx                                                     +12  -3   │
│   ════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│      14    return (                                                         │
│      15      <button                                                        │
│    ╴ 16        className="btn"                                              │
│    ╳ 16        className={clsx(                                             │
│    + 17          "btn",                                                     │
│    + 18          variant === "primary" && "btn-primary",                    │
│    + 19        )}                                                           │
│      20        onClick={onClick}                                            │
│                                                                             │
│   ─────────────────────────────────────────────────────────────────────────│
│                                                                             │
│   helpers.ts                                                     +45  -0   │
│   ════════════════════════════════════════════════════════════════════════ │
│                                                                             │
│    + 1   export function formatDate(date: Date): string {                   │
│    + 2     return date.toLocaleDateString('en-US', {                        │
│    + 3       month: 'short',                                                │
│    + 4       day: 'numeric',                                                │
│    ⋮                                                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

Design Notes:
• Inline diff (no split view by default - simpler)
• Deletions: red with ╴ marker (soft, not aggressive)
• Additions: green with + marker
• Modified: subtle crossout ╳ for the old, clean for the new
• Syntax highlighting matches their editor theme
• Collapsible sections for each file
```

### Save Modal - AI Does the Thinking

When clicking "Save", if there's no AI message yet:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                              💾 SAVE YOUR WORK                              │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │                                                                     │  │
│   │  ✨ Added user authentication with OAuth support                    │  │
│   │                                                                     │  │
│   │  This save includes changes to the login flow, adds Google          │  │
│   │  OAuth as a provider, and updates the user session handling.        │  │
│   │                                                                     │  │
│   │  Files: auth.ts, login.tsx, oauth.ts, session.ts                    │  │
│   │                                                                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                               ↑ AI-generated, editable                     │
│                                                                             │
│                   [Regenerate 🔄]              [Save ⚡]                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Connection Status - Friendly Error

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│                      😴 ViboGit daemon is sleeping                         │
│                                                                             │
│         To wake it up, run this in your terminal:                          │
│                                                                             │
│         ┌─────────────────────────────────────────────┐                    │
│         │  npx vibogit                                │  📋 Copy           │
│         └─────────────────────────────────────────────┘                    │
│                                                                             │
│         Or install it permanently:                                          │
│         brew install vibogit                                                │
│                                                                             │
│                        [Try Again 🔄]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Technical Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         VIBOGIT ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ☁️  CLOUD (Vercel + Convex)                                               │
│   ─────────────────────────────                                             │
│                                                                             │
│   ┌───────────────────────────┐     ┌───────────────────────────┐          │
│   │  Next.js 15               │     │  Convex                   │          │
│   │  ─────────────            │     │  ───────                  │          │
│   │  • React 19               │◀───▶│  • User settings          │          │
│   │  • Tailwind v4            │     │  • Recent projects        │          │
│   │  • shadcn/ui              │     │  • Dev server configs     │          │
│   │  • Vercel AI SDK          │     │                           │          │
│   └───────────────────────────┘     └───────────────────────────┘          │
│              │                                                              │
│              │ WebSocket (localhost:9111)                                   │
│              ▼                                                              │
│   ────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│   💻 LOCAL (User's Mac)                                                     │
│   ─────────────────────                                                     │
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │  ViboGit Daemon (Bun)                                               │  │
│   │  ─────────────────────                                               │  │
│   │                                                                     │  │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │  │
│   │  │ Git Ops     │  │ File Watch  │  │ Dev Servers │  │ Keychain  │  │  │
│   │  │ (simple-git)│  │ (chokidar)  │  │ (Bun.spawn) │  │ (keytar)  │  │  │
│   │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │  │
│   │                                                                     │  │
│   │  Install: npx vibogit  OR  brew install vibogit                     │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. One Primary Action Per Screen
- Main screen: **Save** (with Ship secondary)
- Never show 10 buttons when 2 will do

### 2. AI Does the Tedious Work
- AI writes commit messages
- AI writes PR descriptions  
- AI suggests branch names
- User just approves or edits

### 3. Visual Feedback Over Text
- Timeline graph over commit list
- Color-coded changes over status text
- Animations for state changes

### 4. Progressive Disclosure
- Simple view by default
- "Show All" expands to full details
- Advanced users can access git power when needed

### 5. Beauty Matters
- The Timeline should be artwork
- Smooth animations (60fps)
- Thoughtful color palette
- Typography that's easy to scan

## Tech Stack

| Layer | Technology | Notes |
|-------|------------|-------|
| Web Framework | Next.js 15 | App Router, React 19 |
| Styling | Tailwind CSS v4 | CSS-first config |
| UI Components | shadcn/ui | Zinc base, customized |
| Animations | Framer Motion | For Timeline, transitions |
| Database | Convex | Settings, recent projects |
| AI | Vercel AI SDK | OpenAI for commit messages |
| Daemon Runtime | Bun | Fast, native TypeScript |
| Git Operations | simple-git | High-level git API |
| File Watching | chokidar | Cross-platform |
| Graphs | Custom SVG | For beautiful Timeline |

## The Timeline - Design Deep Dive

The Timeline is the signature feature. It should feel like looking at a river from above - branches flow and merge smoothly.

### Visual Language

```
NODES:
  ◉  Your commit (accent color, subtle glow)
  ○  Someone else's commit (muted)
  ●  Merge point (larger, connects lines)

LINES:
  │  Straight flow (no turns - just down)
  ╲ ╱  Smooth bezier curves for branches
  ━━━  Horizontal merge connector

CARDS:
  Rounded corners (8px)
  Subtle shadow (elevation)
  Slide-in animation on scroll
  Expand on hover for details

SPACING:
  Generous vertical rhythm
  Commits breathe, not cramped
  Time markers create sections (Today, Yesterday, This Week)
```

### Color Palette for Timeline

```css
/* Main branch */
--timeline-main: #e6e6e6;       /* Light gray line */
--timeline-main-node: #e69a4d;  /* Accent for your commits */

/* Feature branches */
--timeline-branch-1: #7c93c3;   /* Soft blue */
--timeline-branch-2: #9b7cb8;   /* Soft purple */
--timeline-branch-3: #7cb88e;   /* Soft green */
--timeline-branch-4: #c3937c;   /* Soft coral */

/* Merges */
--timeline-merge: #e69a4d;      /* Accent color */
```

### Animation Principles

- **Entrance**: Cards fade in + slide up (stagger: 50ms per card)
- **Hover**: Card lifts (translateY: -2px) + shadow increases
- **Branch**: Lines draw themselves (stroke-dashoffset animation)
- **Merge**: Pulse effect on the merge node

## WebSocket Protocol (Simplified)

```typescript
// Client sends simple actions
type ClientMessage = 
  | { action: "save" }                    // Stage all + generate message + commit
  | { action: "save", message: string }   // Stage all + commit with custom message
  | { action: "ship" }                    // Push to remote
  | { action: "sync" }                    // Pull + Push
  | { action: "setProject", path: string }
  | { action: "openInBrowser" }
  | { action: "openInEditor" }
  | { action: "openInTerminal" }
  | { action: "generateMessage" }         // Get AI suggestion
  // ... advanced actions available but hidden by default

// Server sends state updates
type ServerMessage =
  | { type: "state", data: ProjectState }
  | { type: "message", text: string }     // AI-generated commit message
  | { type: "saved", sha: string }
  | { type: "shipped" }
  | { type: "error", message: string }
```

## Implementation Phases

### Phase 1: Core Loop (Week 1-2)
- [ ] Daemon with WebSocket server
- [ ] Web connects to daemon
- [ ] "Save" button (stage all + commit)
- [ ] "Ship" button (push)
- [ ] Changes list (simple, not expanded)
- [ ] Auto-refresh on file changes

### Phase 2: The Timeline (Week 3)
- [ ] Beautiful commit graph
- [ ] Smooth animations
- [ ] Branch visualization
- [ ] Merge indicators
- [ ] Time-based grouping

### Phase 3: AI & Polish (Week 4)
- [ ] AI commit messages
- [ ] AI PR descriptions
- [ ] Quick links (browser, editor, terminal)
- [ ] Multi-tab support
- [ ] Settings with Convex

### Phase 4: Power Features (Week 5)
- [ ] Changes view (inline diff)
- [ ] Branch switching (with "pocket" for unsaved changes)
- [ ] Dev server management
- [ ] PR creation

### Phase 5: Distribution (Week 6)
- [ ] npx vibogit (daemon as npm package)
- [ ] brew install vibogit
- [ ] Documentation
- [ ] Landing page

## Success Looks Like

A Vibe Coder opens ViboGit, sees their project, clicks "Save", AI writes the message, they click "Ship", and their code is deployed. Total time: 5 seconds.

They scroll down and see a beautiful flowing timeline of their project's history - and actually enjoy looking at it.

They never have to think about git. They just code.

---


## Appendix: Advanced Features (Hidden by Default)

For users who want more control, these features are accessible but not prominent:

- Manual staging (click individual files)
- Custom commit messages
- Branch creation/switching
- Stash management
- Conflict resolution (guided)
- Git log with full details

- Rebase (with guardrails)

These live in a "⚙️ Advanced" dropdown, not in the main UI.
