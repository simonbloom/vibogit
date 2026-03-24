"use client";

import type {
  Config,
  DevServerConfig,
  DevServerDiagnosis,
  DevServerState,
  GitBranch,
  GitCommit,
  GitDiff,
  GitFile,
  GitHubAuthStatus,
  GitHubListReposResponse,
  GitHubRepo,
  GitStatus,
} from "@vibogit/shared";
import { DEFAULT_CONFIG } from "@vibogit/shared";
import type { Project, ProjectStatus } from "@vibogit/ui/lib/projects-context";

export const FIGMA_FILE_KEY = "JfpWJvFfrXRCIAqLAWdPaS";
export const MOCK_REPO_PATH = "/Users/simonbloom/projects/vibogit";

export const THEME_NAMES = ["light", "dark", "ember", "matrix"] as const;
export type ThemeName = (typeof THEME_NAMES)[number];

export const TOKEN_GROUPS = [
  {
    title: "Core",
    tokens: [
      "--background",
      "--foreground",
      "--card",
      "--card-foreground",
      "--popover",
      "--popover-foreground",
      "--border",
      "--input",
      "--ring",
      "--radius",
    ],
  },
  {
    title: "Actions",
    tokens: [
      "--primary",
      "--primary-foreground",
      "--secondary",
      "--secondary-foreground",
      "--accent",
      "--accent-foreground",
      "--muted",
      "--muted-foreground",
      "--destructive",
      "--destructive-foreground",
    ],
  },
  {
    title: "Sidebar",
    tokens: [
      "--sidebar-background",
      "--sidebar-foreground",
      "--sidebar-primary",
      "--sidebar-primary-foreground",
      "--sidebar-accent",
      "--sidebar-accent-foreground",
      "--sidebar-border",
      "--sidebar-ring",
    ],
  },
  {
    title: "Nav Icons",
    tokens: [
      "--nav-icon-knowledge",
      "--nav-icon-inputs",
      "--nav-icon-subscriptions",
      "--nav-icon-coding",
      "--nav-icon-spaces",
      "--nav-icon-settings",
    ],
  },
];

const stagedFiles: GitFile[] = [
  {
    path: "apps/desktop/frontend/src/app/figma-capture/screens/page.tsx",
    status: "added",
    staged: true,
  },
  {
    path: "packages/ui/src/components/main-interface.tsx",
    status: "modified",
    staged: true,
  },
];

const unstagedFiles: GitFile[] = [
  {
    path: "packages/ui/src/components/settings-panel.tsx",
    status: "modified",
    staged: false,
  },
  {
    path: "packages/ui/src/components/sidebar/sidebar.tsx",
    status: "modified",
    staged: false,
  },
];

const untrackedFiles: GitFile[] = [
  {
    path: "docs/figma-capture-notes.md",
    status: "untracked",
    staged: false,
  },
];

export const MOCK_STATUS: GitStatus = {
  branch: "feat/figma-capture",
  ahead: 2,
  behind: 1,
  staged: stagedFiles,
  unstaged: unstagedFiles,
  untracked: untrackedFiles,
  isEmptyRepo: false,
};

export const MOCK_BRANCHES: GitBranch[] = [
  { name: "feat/figma-capture", current: true, tracking: "origin/feat/figma-capture", ahead: 2, behind: 1 },
  { name: "main", current: false, tracking: "origin/main" },
  { name: "release/4.0", current: false, tracking: "origin/release/4.0" },
];

export const MOCK_PROJECTS: Project[] = [
  { path: MOCK_REPO_PATH, name: "vibogit", addedAt: 1710502400000 },
  { path: "/Users/simonbloom/projects/shortcut-manager", name: "shortcut-manager", addedAt: 1710156800000 },
  { path: "/Users/simonbloom/projects/design-lab", name: "design-lab", addedAt: 1709984000000 },
];

export const MOCK_PROJECT_STATUSES: Record<string, ProjectStatus> = {
  [MOCK_REPO_PATH]: {
    path: MOCK_REPO_PATH,
    currentBranch: "feat/figma-capture",
    uncommittedCount: stagedFiles.length + unstagedFiles.length + untrackedFiles.length,
    ahead: 2,
    behind: 1,
    isClean: false,
  },
  "/Users/simonbloom/projects/shortcut-manager": {
    path: "/Users/simonbloom/projects/shortcut-manager",
    currentBranch: "main",
    uncommittedCount: 0,
    ahead: 0,
    behind: 0,
    isClean: true,
  },
  "/Users/simonbloom/projects/design-lab": {
    path: "/Users/simonbloom/projects/design-lab",
    currentBranch: "feature/audit",
    uncommittedCount: 3,
    ahead: 1,
    behind: 0,
    isClean: false,
  },
};

export const MOCK_FILE_TREE = [
  {
    name: "apps",
    path: "apps",
    type: "directory" as const,
    children: [
      {
        name: "desktop",
        path: "apps/desktop",
        type: "directory" as const,
        children: [
          {
            name: "frontend",
            path: "apps/desktop/frontend",
            type: "directory" as const,
            children: [
              {
                name: "src",
                path: "apps/desktop/frontend/src",
                type: "directory" as const,
                children: [
                  {
                    name: "app",
                    path: "apps/desktop/frontend/src/app",
                    type: "directory" as const,
                    children: [
                      { name: "page.tsx", path: "apps/desktop/frontend/src/app/page.tsx", type: "file" as const },
                      { name: "layout.tsx", path: "apps/desktop/frontend/src/app/layout.tsx", type: "file" as const },
                  { name: "figma-capture", path: "apps/desktop/frontend/src/app/figma-capture", type: "directory" as const },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "packages",
    path: "packages",
    type: "directory" as const,
    children: [
      {
        name: "ui",
        path: "packages/ui",
        type: "directory" as const,
        children: [
          {
            name: "src",
            path: "packages/ui/src",
            type: "directory" as const,
            children: [
              {
                name: "components",
                path: "packages/ui/src/components",
                type: "directory" as const,
                children: [
                  { name: "main-interface.tsx", path: "packages/ui/src/components/main-interface.tsx", type: "file" as const },
                  { name: "settings-panel.tsx", path: "packages/ui/src/components/settings-panel.tsx", type: "file" as const },
                  { name: "sidebar", path: "packages/ui/src/components/sidebar", type: "directory" as const },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
  {
    name: "README.md",
    path: "README.md",
    type: "file" as const,
  },
];

export const MOCK_FILE_CONTENTS: Record<string, string> = {
  "packages/ui/src/components/main-interface.tsx": `"use client";

import { useState } from "react";

export function MainInterface() {
  const [activeView, setActiveView] = useState("changes");

  return (
    <div className="flex flex-col h-full">
      <header className="border-b bg-muted/30 px-4 py-2">
        <span className="font-medium">ViboGit</span>
      </header>
      <main className="flex-1 p-4">
        Current tab: {activeView}
      </main>
    </div>
  );
}
`,
  "apps/desktop/frontend/src/app/page.tsx": `export { default } from "./app/page";\n`,
  "README.md": `# ViboGit

Git for the Vibe Coder.

This capture route is generated from the real app shell so the Figma file stays aligned with code.
`,
  "docs/figma-capture-notes.md": `# Figma Capture Checklist

- Verify screens route renders every requested state.
- Verify component page includes primitives and app modules.
- Verify style guide reflects the four supported themes.
`,
};

export const MOCK_DIFFS: Record<string, GitDiff> = {
  "packages/ui/src/components/settings-panel.tsx": {
    path: "packages/ui/src/components/settings-panel.tsx",
    isBinary: false,
    hunks: [
      {
        oldStart: 14,
        oldLines: 5,
        newStart: 14,
        newLines: 9,
        lines: [
          { type: "context", content: "interface SettingsPanelProps {", oldLineNumber: 14, newLineNumber: 14 },
          { type: "context", content: "  updateState?: AutoUpdateState & AutoUpdateActions;", oldLineNumber: 15, newLineNumber: 15 },
          { type: "add", content: "  initialTab?: SettingsTabId;", newLineNumber: 16 },
          { type: "context", content: "}", oldLineNumber: 16, newLineNumber: 17 },
          { type: "context", content: "", oldLineNumber: 17, newLineNumber: 18 },
          { type: "delete", content: "export function SettingsPanel({ updateState }: SettingsPanelProps) {", oldLineNumber: 18 },
          { type: "add", content: "export function SettingsPanel({ updateState, initialTab }: SettingsPanelProps) {", newLineNumber: 19 },
        ],
      },
    ],
  },
  "packages/ui/src/components/sidebar/sidebar.tsx": {
    path: "packages/ui/src/components/sidebar/sidebar.tsx",
    isBinary: false,
    hunks: [
      {
        oldStart: 12,
        oldLines: 4,
        newStart: 12,
        newLines: 6,
        lines: [
          { type: "context", content: "  isSettingsActive?: boolean;", oldLineNumber: 12, newLineNumber: 12 },
          { type: "context", content: "  isMacOverlayChrome?: boolean;", oldLineNumber: 13, newLineNumber: 13 },
          { type: "context", content: "  className?: string;", oldLineNumber: 14, newLineNumber: 14 },
          { type: "add", content: "  initialCollapsed?: boolean;", newLineNumber: 15 },
          { type: "context", content: "}", oldLineNumber: 15, newLineNumber: 16 },
        ],
      },
    ],
  },
};

export const MOCK_COMMITS: GitCommit[] = [
  {
    hash: "a1b2c3d4e5f60123456789abcdef0123456789aa",
    hashShort: "a1b2c3d",
    message: "Import figma capture routes into the desktop frontend",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-20T12:15:00.000Z",
    refs: ["HEAD -> feat/figma-capture", "origin/feat/figma-capture"],
    parents: ["b2c3d4e5f60123456789abcdef0123456789aabb"],
  },
  {
    hash: "b2c3d4e5f60123456789abcdef0123456789aabb",
    hashShort: "b2c3d4e",
    message: "Add deterministic mock providers for capture routes",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-20T11:44:00.000Z",
    parents: ["c3d4e5f60123456789abcdef0123456789aabbcc"],
  },
  {
    hash: "c3d4e5f60123456789abcdef0123456789aabbcc",
    hashShort: "c3d4e5f",
    message: "Merge branch 'main' into feat/figma-capture",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-20T10:58:00.000Z",
    parents: [
      "d4e5f60123456789abcdef0123456789aabbccdd",
      "f6a7b80123456789abcdef0123456789aabbccff",
    ],
  },
  {
    hash: "d4e5f60123456789abcdef0123456789aabbccdd",
    hashShort: "d4e5f60",
    message: "Wire style guide token extraction from CSS variables",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-20T10:10:00.000Z",
    parents: ["e5f60123456789abcdef0123456789aabbccddee"],
  },
  {
    hash: "e5f60123456789abcdef0123456789aabbccddee",
    hashShort: "e5f6012",
    message: "Expose internal preview props for capture-only states",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-20T09:32:00.000Z",
    parents: ["f6a7b80123456789abcdef0123456789aabbcc11"],
  },
  {
    hash: "f6a7b80123456789abcdef0123456789aabbccff",
    hashShort: "f6a7b80",
    message: "Refresh settings panel spacing and save states",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-19T17:45:00.000Z",
    refs: ["origin/main", "main"],
    parents: ["f6a7b80123456789abcdef0123456789aabbcc11"],
  },
  {
    hash: "f6a7b80123456789abcdef0123456789aabbcc11",
    hashShort: "f6a7b81",
    message: "Ship app-shell parity for Tauri and browser preview",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-19T12:20:00.000Z",
    parents: ["09ab1c2d3456789abcdef0123456789aabbccdd"],
  },
  {
    hash: "09ab1c2d3456789abcdef0123456789aabbccdd",
    hashShort: "09ab1c2",
    message: "Bootstrap the desktop shell and project sidebar",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-18T15:05:00.000Z",
    parents: [],
  },
];

export const MOCK_REMOTES = [
  {
    name: "origin",
    refs: {
      fetch: "git@github.com:simonbloom/vibogit.git",
      push: "git@github.com:simonbloom/vibogit.git",
    },
  },
];

export const MOCK_GITHUB_REPOS: GitHubRepo[] = [
  {
    id: 1,
    fullName: "simonbloom/vibogit",
    private: false,
    defaultBranch: "main",
    cloneUrl: "https://github.com/simonbloom/vibogit.git",
    sshUrl: "git@github.com:simonbloom/vibogit.git",
    htmlUrl: "https://github.com/simonbloom/vibogit",
  },
  {
    id: 2,
    fullName: "simonbloom/shortcut-manager",
    private: true,
    defaultBranch: "main",
    cloneUrl: "https://github.com/simonbloom/shortcut-manager.git",
    sshUrl: "git@github.com:simonbloom/shortcut-manager.git",
    htmlUrl: "https://github.com/simonbloom/shortcut-manager",
  },
  {
    id: 3,
    fullName: "simonbloom/design-lab",
    private: false,
    defaultBranch: "develop",
    cloneUrl: "https://github.com/simonbloom/design-lab.git",
    sshUrl: "git@github.com:simonbloom/design-lab.git",
    htmlUrl: "https://github.com/simonbloom/design-lab",
  },
];

export const MOCK_AUTH_STATUS: GitHubAuthStatus = {
  source: "gh",
  login: "simonbloom",
  message: "Authenticated via GitHub CLI.",
};

export const MOCK_GITHUB_REPOS_RESPONSE: GitHubListReposResponse = {
  repos: MOCK_GITHUB_REPOS,
  page: 1,
  perPage: 20,
  hasMore: true,
  authSource: "gh",
  authLogin: "simonbloom",
};

export const MOCK_DEV_SERVER_CONFIG: DevServerConfig = {
  command: "bun",
  args: ["run", "dev"],
  port: 4158,
  explicitPort: 4158,
};

export const MOCK_DEV_SERVER_STATE: DevServerState = {
  running: true,
  port: 4158,
  logs: [
    "> vibogit@dev",
    "> next dev -p 4158",
    "",
    "ready - started server on http://localhost:4158",
    "compiled app/figma-capture/screens in 116 ms",
    "GET /figma-capture/screens 200 in 42 ms",
  ],
};

export const MOCK_DEV_SERVER_DIAGNOSIS: DevServerDiagnosis = {
  processAlive: true,
  portListening: true,
  lastLogs: MOCK_DEV_SERVER_STATE.logs,
  problem: "No problem detected.",
  suggestion: "Use the configured port 4158.",
  suggestedCommand: "bun run dev",
  diagnosisCode: "OK",
};

export const MOCK_CONFIG: Config = {
  ...DEFAULT_CONFIG,
  computerName: "studio-macbook",
  aiProvider: "openai",
  aiModel: "gpt-5.3-codex-spark",
  aiApiKey: "sk-demo-vibogit-123456",
  githubPat: "github_pat_demo_123456",
  editor: "cursor",
  terminal: "Ghostty",
  theme: "light",
  imageBasePath: "/Users/simonbloom/Pictures/Screenshots/",
  showHiddenFiles: false,
  cleanShotMode: true,
  autoExecutePrompt: true,
  recentTabs: [
    { id: "tab-vibogit", repoPath: MOCK_REPO_PATH, name: "vibogit" },
    { id: "tab-shortcut", repoPath: "/Users/simonbloom/projects/shortcut-manager", name: "shortcut-manager" },
  ],
  activeTabId: "tab-vibogit",
};

export const MOCK_SKILLS = [
  {
    name: "figma",
    description: "Use the Figma MCP server for design context and capture workflows.",
    path: "/Users/simonbloom/.codex/skills/figma/SKILL.md",
  },
  {
    name: "playwright",
    description: "Drive a browser to verify local pages and capture screenshots.",
    path: "/Users/simonbloom/.codex/skills/playwright/SKILL.md",
  },
  {
    name: "frontend-design",
    description: "Refine polish and visual systems for high-quality frontend output.",
    path: "/Users/simonbloom/.codex/skills/frontend-design/SKILL.md",
  },
];

export const MOCK_UPDATE_STATE = {
  status: "update-available" as const,
  version: "4.1.0",
  notes: "Improved Figma capture workflow and desktop polish.",
  progress: 0,
  error: null,
  async checkForUpdate() {},
  async startUpdate() {},
  async restartApp() {},
  dismiss() {},
};

export function createReadyDaemonState(overrides?: Partial<{
  connection: "disconnected" | "connecting" | "connected" | "error";
  repoPath: string | null;
  error: string | null;
  repoHealth: "ready" | "nonGit" | "emptyRepo";
  repoMessage: string | null;
  status: GitStatus | null;
  branches: GitBranch[];
}>) {
  return {
    connection: "connected" as const,
    repoPath: MOCK_REPO_PATH,
    status: MOCK_STATUS,
    branches: MOCK_BRANCHES,
    error: null,
    repoHealth: "ready" as const,
    repoMessage: null,
    ...overrides,
  };
}
