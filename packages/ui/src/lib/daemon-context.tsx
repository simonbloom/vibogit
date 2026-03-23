"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import type {
  DaemonState,
  ConnectionState,
  RepoHealth,
  GitStatus,
  GitBranch,
  GitCommit,
  Config,
  DevServerConfig,
  DevServerState,
  GitDiff,
  GitHubAuthStatus,
  GitHubListReposResponse,
} from "@vibogit/shared";
import { DEFAULT_CONFIG } from "@vibogit/shared";
import { MINI_COMMIT_COMPLETE } from "./mini-view-events";
import { useWindowActivity } from "./use-window-activity";

const NON_GIT_REPO_MESSAGE = "Folder is empty or not initialized with Git yet.";
const EMPTY_REPO_MESSAGE = "Repository initialized but has no commits yet.";

const isTauri = (): boolean => {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
};

let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriListen: ((event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>) | null = null;
let tauriInitialized = false;

type MockMode = "welcome" | "main";

interface MockParams {
  enabled: boolean;
  mode: MockMode;
  repoPath: string;
}

interface MockFileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: MockFileNode[];
}

const MOCK_REPO_PATH = "/Users/simonbloom/apps-vol11/vibogit";
const MOCK_BRANCHES: GitBranch[] = [
  { name: "main", current: true, tracking: "origin/main", ahead: 2, behind: 0 },
  { name: "feat/figma-export", current: false, tracking: "origin/feat/figma-export", ahead: 0, behind: 0 },
  { name: "design/sidebar-pass", current: false, tracking: "origin/design/sidebar-pass", ahead: 0, behind: 1 },
];
const MOCK_STATUS: GitStatus = {
  branch: "main",
  ahead: 2,
  behind: 0,
  staged: [
    { path: "packages/ui/src/components/sidebar/sidebar.tsx", status: "modified", staged: true },
    { path: "packages/ui/src/components/main-interface.tsx", status: "modified", staged: true },
  ],
  unstaged: [
    { path: "apps/desktop/frontend/src/app/layout.tsx", status: "modified", staged: false },
    { path: "packages/ui/src/lib/daemon-context.tsx", status: "modified", staged: false },
  ],
  untracked: [
    { path: "packages/ui/src/components/export-preview.tsx", status: "untracked", staged: false },
  ],
  isEmptyRepo: false,
};
const MOCK_COMMITS: GitCommit[] = [
  {
    hash: "d2a2a7377f0b4d80f3e62b85b0d23cb5d10d43bf",
    hashShort: "d2a2a73",
    message: "refine desktop layout for capture workflow",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-22T17:50:00.000Z",
    parents: ["91ea1bb4b75da0d3bd6024cc1f0b28c21c6a0a6a"],
    refs: ["HEAD -> main", "origin/main"],
  },
  {
    hash: "91ea1bb4b75da0d3bd6024cc1f0b28c21c6a0a6a",
    hashShort: "91ea1bb",
    message: "ship settings panel refinements",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-22T15:42:00.000Z",
    parents: ["7846107a4b3c5fe7986eb9c131015db2ec74d5db"],
    refs: [],
  },
  {
    hash: "7846107a4b3c5fe7986eb9c131015db2ec74d5db",
    hashShort: "7846107",
    message: "add mini-view polish and project quick links",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-21T21:10:00.000Z",
    parents: ["0d44c6f22fb745fdc590d421db38bccf744dc4f1"],
    refs: [],
  },
  {
    hash: "0d44c6f22fb745fdc590d421db38bccf744dc4f1",
    hashShort: "0d44c6f",
    message: "introduce project sidebar persistence",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-21T13:05:00.000Z",
    parents: ["f52f0c33f7d8efc91226672a2556e61f33d7bfee"],
    refs: [],
  },
  {
    hash: "f52f0c33f7d8efc91226672a2556e61f33d7bfee",
    hashShort: "f52f0c3",
    message: "bootstrap tauri desktop shell",
    author: "Simon Bloom",
    email: "simon.bloom@gmail.com",
    date: "2026-03-20T11:32:00.000Z",
    parents: [],
    refs: [],
  },
];
const MOCK_FILE_TREE: MockFileNode[] = [
  {
    name: "apps",
    path: "apps",
    type: "directory",
    children: [
      {
        name: "desktop",
        path: "apps/desktop",
        type: "directory",
        children: [
          {
            name: "frontend",
            path: "apps/desktop/frontend",
            type: "directory",
            children: [
              {
                name: "src",
                path: "apps/desktop/frontend/src",
                type: "directory",
                children: [
                  {
                    name: "app",
                    path: "apps/desktop/frontend/src/app",
                    type: "directory",
                    children: [
                      { name: "layout.tsx", path: "apps/desktop/frontend/src/app/layout.tsx", type: "file" },
                      { name: "page.tsx", path: "apps/desktop/frontend/src/app/page.tsx", type: "file" },
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
    type: "directory",
    children: [
      {
        name: "ui",
        path: "packages/ui",
        type: "directory",
        children: [
          {
            name: "src",
            path: "packages/ui/src",
            type: "directory",
            children: [
              {
                name: "components",
                path: "packages/ui/src/components",
                type: "directory",
                children: [
                  { name: "main-interface.tsx", path: "packages/ui/src/components/main-interface.tsx", type: "file" },
                  { name: "settings-panel.tsx", path: "packages/ui/src/components/settings-panel.tsx", type: "file" },
                  {
                    name: "sidebar",
                    path: "packages/ui/src/components/sidebar",
                    type: "directory",
                    children: [
                      { name: "sidebar.tsx", path: "packages/ui/src/components/sidebar/sidebar.tsx", type: "file" },
                      { name: "project-list.tsx", path: "packages/ui/src/components/sidebar/project-list.tsx", type: "file" },
                    ],
                  },
                ],
              },
              {
                name: "lib",
                path: "packages/ui/src/lib",
                type: "directory",
                children: [
                  { name: "daemon-context.tsx", path: "packages/ui/src/lib/daemon-context.tsx", type: "file" },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
const MOCK_FILE_CONTENT: Record<string, string> = {
  "apps/desktop/frontend/src/app/layout.tsx": `import Script from "next/script";\n\nexport default function RootLayout({ children }: { children: React.ReactNode }) {\n  return <html><body>{children}</body></html>;\n}\n`,
  "apps/desktop/frontend/src/app/page.tsx": `export { default } from "./app/page";\n`,
  "packages/ui/src/components/main-interface.tsx": `export function MainInterface() {\n  return <div className="grid h-full grid-cols-[220px_1fr]">...</div>;\n}\n`,
  "packages/ui/src/components/settings-panel.tsx": `export function SettingsPanel() {\n  return <div className="flex h-full flex-col bg-background">...</div>;\n}\n`,
  "packages/ui/src/components/sidebar/sidebar.tsx": `export function Sidebar() {\n  return <aside className="flex h-full w-[220px] flex-col border-r bg-sidebar">...</aside>;\n}\n`,
  "packages/ui/src/components/sidebar/project-list.tsx": `export function ProjectList() {\n  return <div className="space-y-1 p-1">...</div>;\n}\n`,
  "packages/ui/src/lib/daemon-context.tsx": `export function DaemonProvider() {\n  return null;\n}\n`,
};
const MOCK_DEV_SERVER_STATE: DevServerState = {
  running: true,
  port: 4158,
  logs: [
    "$ bun run dev",
    "▲ Next.js 15.5.9",
    "Local: http://localhost:4158",
    "Compiled / in 712ms",
  ],
};
const MOCK_DEV_SERVER_CONFIG: DevServerConfig = {
  command: "bun run dev",
  args: [],
  port: 4158,
  explicitPort: 4158,
};

function getMockParams(): MockParams {
  if (typeof window === "undefined") {
    return { enabled: false, mode: "welcome", repoPath: MOCK_REPO_PATH };
  }

  const pathname = window.location.pathname;
  const params = new URLSearchParams(window.location.search);
  const mode = params.get("mock");
  const autoMock = pathname.startsWith("/figma-export");

  if ((!mode && !autoMock) || isTauri()) {
    return { enabled: false, mode: "welcome", repoPath: MOCK_REPO_PATH };
  }

  return {
    enabled: true,
    mode: mode === "welcome" ? "welcome" : "main",
    repoPath: params.get("repo") || MOCK_REPO_PATH,
  };
}

function cloneMockStatus(): GitStatus {
  return {
    ...MOCK_STATUS,
    staged: MOCK_STATUS.staged.map((file) => ({ ...file })),
    unstaged: MOCK_STATUS.unstaged.map((file) => ({ ...file })),
    untracked: MOCK_STATUS.untracked.map((file) => ({ ...file })),
  };
}

function cloneMockBranches(): GitBranch[] {
  return MOCK_BRANCHES.map((branch) => ({ ...branch }));
}

function cloneMockCommits(): GitCommit[] {
  return MOCK_COMMITS.map((commit) => ({
    ...commit,
    parents: commit.parents ? [...commit.parents] : undefined,
    refs: commit.refs ? [...commit.refs] : undefined,
  }));
}

function cloneMockTree(nodes: MockFileNode[]): MockFileNode[] {
  return nodes.map((node) => ({
    ...node,
    children: node.children ? cloneMockTree(node.children) : undefined,
  }));
}

function getMockDiff(filePath: string): GitDiff {
  return {
    path: filePath,
    oldPath: undefined,
    isBinary: false,
    hunks: [
      {
        oldStart: 1,
        oldLines: 3,
        newStart: 1,
        newLines: 4,
        lines: [
          { type: "context", content: "export function Sidebar() {" },
          { type: "delete", content: '  return <aside className="w-16">...</aside>;' },
          { type: "add", content: '  return <aside className="w-[220px] rounded-r-2xl">...</aside>;' },
          { type: "add", content: '  // Mock diff used for browser capture mode.' },
        ],
      },
    ],
  };
}

async function mockSend<T>(
  type: string,
  payload: unknown,
  mockConfigRef: { current: Config }
): Promise<T> {
  const args = (payload ?? {}) as Record<string, unknown>;

  switch (type) {
    case "status":
      return { status: cloneMockStatus() } as T;
    case "branches":
      return { branches: cloneMockBranches() } as T;
    case "watch":
    case "stage":
    case "unstage":
    case "stageAll":
    case "commit":
    case "push":
    case "pull":
    case "fetch":
    case "checkout":
    case "createBranch":
    case "stashSave":
    case "stashPop":
    case "openFinder":
    case "openTerminal":
    case "sendToTerminal":
    case "openEditor":
    case "openBrowser":
    case "devServerStart":
    case "devServerStop":
    case "killPort":
    case "cleanupDevLocks":
    case "writeAgentsConfig":
    case "updateAgentsConfig":
    case "writeDevScriptPort":
    case "gitCloneIntoFolder":
      return {} as T;
    case "pickFolder":
    case "openFolder":
      return { path: null } as T;
    case "isGitRepo":
      return { isRepo: true } as T;
    case "getConfig":
      return { config: mockConfigRef.current } as T;
    case "setConfig": {
      const configPatch = (args.config as Partial<Config>) || {};
      mockConfigRef.current = { ...mockConfigRef.current, ...configPatch };
      return { config: mockConfigRef.current } as T;
    }
    case "listFiles":
      return { tree: cloneMockTree(MOCK_FILE_TREE) } as T;
    case "readFile": {
      const filePath = String(args.filePath || "");
      return {
        content: MOCK_FILE_CONTENT[filePath] || `// Mock content for ${filePath}\n`,
        isBinary: false,
      } as T;
    }
    case "getFavicon":
      return { favicon: null, mimeType: null } as T;
    case "diff": {
      const filePath = String(args.file || "packages/ui/src/components/sidebar/sidebar.tsx");
      return { diff: getMockDiff(filePath) } as T;
    }
    case "log":
      return { commits: cloneMockCommits() } as T;
    case "getRemotes":
      return {
        remotes: [{ name: "origin", refs: { fetch: "https://github.com/simonbloom/vibogit.git" } }],
      } as T;
    case "devServerDetect":
      return { config: { ...MOCK_DEV_SERVER_CONFIG } } as T;
    case "devServerState":
      return { state: { ...MOCK_DEV_SERVER_STATE, logs: [...MOCK_DEV_SERVER_STATE.logs] } } as T;
    case "readAgentsConfig":
      return { config: null } as T;
    case "list-skills":
    case "skills-list":
      return { skills: [] } as T;
    case "githubResolveAuthSource": {
      const status: GitHubAuthStatus = {
        source: "none",
        login: null,
        message: "Mock browser mode",
      };
      return status as T;
    }
    case "githubListRepos": {
      const response: GitHubListReposResponse = {
        repos: [],
        page: Number(args.page || 1),
        perPage: Number(args.perPage || 20),
        hasMore: false,
        authSource: "none",
        authLogin: null,
      };
      return response as T;
    }
    default:
      return {} as T;
  }
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object" && "message" in err) {
    const message = (err as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return "Unknown error";
  }
}

function isNotRepositoryMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return normalized.includes("not a git repository") || normalized.includes("not a repository");
}

async function ensureTauriAPIs(): Promise<boolean> {
  if (!isTauri()) {
    return false;
  }

  if (tauriInitialized) return true;

  try {
    const core = await import("@tauri-apps/api/core");
    const event = await import("@tauri-apps/api/event");
    tauriInvoke = core.invoke;
    tauriListen = event.listen;
    tauriInitialized = true;
    return true;
  } catch (err) {
    console.error("[Backend] Failed to initialize Tauri APIs:", err);
    return false;
  }
}

async function tauriSend<T>(type: string, payload?: unknown): Promise<T> {
  if (!tauriInvoke) {
    throw new Error("Desktop backend is not initialized");
  }

  const args = (payload ?? {}) as Record<string, unknown>;
  const repoPath = (args.repoPath as string) ?? (args.path as string) ?? "";
  
  switch (type) {
    case "status": {
      const result = await tauriInvoke("git_status", { path: repoPath });
      const state = result as {
        branch: string;
        changedFiles: { path: string; status: string }[];
        stagedFiles: { path: string; status: string }[];
        untrackedFiles: string[];
        ahead: number;
        behind: number;
        isEmptyRepo?: boolean;
      };
      return {
        status: {
          branch: state.branch,
          staged: state.stagedFiles.map((f) => ({ path: f.path, status: f.status, staged: true })),
          unstaged: state.changedFiles.map((f) => ({ path: f.path, status: f.status, staged: false })),
          untracked: state.untrackedFiles.map((f) => ({ path: f, status: "untracked", staged: false })),
          ahead: state.ahead,
          behind: state.behind,
          isEmptyRepo: state.isEmptyRepo ?? false,
        }
      } as T;
    }

    case "branches": {
      const result = await tauriInvoke("git_branches", { path: repoPath });
      return { branches: result } as T;
    }

    case "watch": {
      await tauriInvoke("set_project", { path: repoPath });
      return {} as T;
    }

    case "stage": {
      const files = args.files as string[] | undefined;
      await tauriInvoke("git_stage", { path: repoPath, files: files || [] });
      return {} as T;
    }

    case "unstage": {
      const files = args.files as string[] | undefined;
      await tauriInvoke("git_unstage", { path: repoPath, files: files || [] });
      return {} as T;
    }

    case "stageAll": {
      await tauriInvoke("git_stage", { path: repoPath, files: ["*"] });
      return {} as T;
    }

    case "commit": {
      const message = args.message as string | undefined;
      const result = await tauriInvoke("git_save", { path: repoPath, message });
      return result as T;
    }

    case "push": {
      const result = await tauriInvoke("git_ship", { path: repoPath });
      return result as T;
    }

    case "pull": {
      const result = await tauriInvoke("git_sync", { path: repoPath });
      return result as T;
    }

    case "fetch": {
      await tauriInvoke("git_fetch", { path: repoPath });
      return {} as T;
    }

    case "checkout": {
      const branch = (args.branch as string) || (args.ref as string) || "";
      await tauriInvoke("git_checkout", { path: repoPath, branch });
      return {} as T;
    }

    case "createBranch": {
      const name = (args.name as string) || "";
      const checkout = args.checkout as boolean | undefined;
      await tauriInvoke("git_create_branch", { path: repoPath, name, checkout });
      return {} as T;
    }

    case "stashSave": {
      const message = args.message as string | undefined;
      await tauriInvoke("git_stash_save", { path: repoPath, message });
      return {} as T;
    }

    case "stashPop": {
      await tauriInvoke("git_stash_pop", { path: repoPath });
      return {} as T;
    }

    case "log": {
      const limit = args.limit as number | undefined;
      const result = await tauriInvoke("git_log", { path: repoPath, limit }) as unknown[];
      const commits = (result || []).map((c: unknown) => {
        const commit = c as Record<string, unknown>;
        return {
          hash: commit.sha,
          hashShort: commit.shortSha,
          message: commit.message,
          author: commit.author,
          email: commit.email,
          date: new Date((commit.timestamp as number) * 1000).toISOString(),
          parents: commit.parentShas,
          refs: commit.refs || undefined,
        };
      });
      return { commits } as T;
    }

    case "diff": {
      const file = args.file as string | undefined;
      const staged = args.staged as boolean | undefined;

      if (file) {
        const result = await tauriInvoke("git_file_diff", { path: repoPath, file, staged });
        return { diff: result } as T;
      }
      
      const result = await tauriInvoke("git_diff", { path: repoPath });
      return { diff: result } as T;
    }

    case "getRemotes": {
      const result = await tauriInvoke("git_remotes", { path: repoPath });
      return { remotes: result } as T;
    }

    case "openFolder":
    case "pickFolder": {
      const result = await tauriInvoke("add_project_folder");
      return { path: result } as T;
    }

    case "isGitRepo": {
      const checkPath = (args.path as string) || "";
      const result = await tauriInvoke("is_git_repo", { path: checkPath });
      return { isRepo: result } as T;
    }

    case "initGit": {
      const initPath = (args.path as string) || "";
      await tauriInvoke("git_init", { path: initPath });
      return {} as T;
    }

    case "getConfig": {
      try {
        const result = await tauriInvoke("get_config");
        return { config: result } as T;
      } catch (e) {
        console.error("[Tauri] get_config failed:", e);
        return { config: {} } as T;
      }
    }

    case "setConfig": {
      const configPatch = args.config as Record<string, unknown> | undefined;
      const current = await tauriInvoke("get_config") as Record<string, unknown>;
      const merged = { ...current, ...configPatch };
      const result = await tauriInvoke("set_config", { config: merged });
      return { config: result } as T;
    }

    case "listFiles": {
      const showHidden = args.showHidden as boolean | undefined;
      const result = await tauriInvoke("list_files", { path: repoPath, showHidden });
      return { tree: result } as T;
    }

    case "readFile": {
      const filePath = (args.filePath as string) || "";
      const result = await tauriInvoke("read_file", { repoPath, filePath });
      return result as T;
    }

    case "getFavicon": {
      const result = await tauriInvoke("get_favicon", { path: repoPath });
      return result as T;
    }

    case "openFinder": {
      await tauriInvoke("open_in_finder", { path: repoPath });
      return {} as T;
    }

    case "openBrowser": {
      const url = (args.url as string) || "";
      await tauriInvoke("open_in_browser", { url });
      return {} as T;
    }

    case "openTerminal": {
      const terminal = args.terminal as string | undefined;
      await tauriInvoke("open_terminal_with_app", { path: repoPath, terminal });
      return {} as T;
    }

    case "sendToTerminal": {
      const text = (args.text as string) || "";
      const terminal = args.terminal as string | undefined;
      const autoExecute = args.autoExecute as boolean | undefined;
      await tauriInvoke("send_to_terminal", { text, terminal, autoExecute });
      return {} as T;
    }

    case "openEditor": {
      const editorPath = (args.path as string) || "";
      const appName = args.appName as string | undefined;
      const editor = args.editor as string | undefined;
      await tauriInvoke("open_editor_with_app", { path: editorPath, appName, editorCommand: editor });
      return {} as T;
    }

    case "devServerDetect": {
      const result = await tauriInvoke("dev_server_detect", { path: repoPath });
      return { config: result } as T;
    }

    case "devServerStart": {
      const config = args.config as Record<string, unknown> | undefined;
      await tauriInvoke("dev_server_start", { path: repoPath, config });
      return {} as T;
    }

    case "devServerStop": {
      await tauriInvoke("dev_server_stop", { path: repoPath });
      return {} as T;
    }

    case "devServerState": {
      const result = await tauriInvoke("dev_server_state", { path: repoPath });
      return { state: result } as T;
    }

    case "killPort": {
      const port = args.port as number;
      await tauriInvoke("kill_port", { port });
      return {} as T;
    }

    case "cleanupDevLocks": {
      const path = args.path as string;
      await tauriInvoke("cleanup_dev_locks", { path });
      return {} as T;
    }

    case "devServerDiagnose": {
      const port = args.port as number;
      const result = await tauriInvoke("dev_server_diagnose", { path: repoPath, port });
      return { diagnosis: result } as T;
    }

    case "writeAgentsConfig": {
      const targetRepoPath = args.repoPath as string;
      const port = args.port as number;
      await tauriInvoke("write_agents_config", { repoPath: targetRepoPath, port });
      return {} as T;
    }

    case "updateAgentsConfig": {
      const targetRepoPath = args.repoPath as string;
      const port = args.port as number;
      await tauriInvoke("write_agents_config", { repoPath: targetRepoPath, port });
      return {} as T;
    }

    case "writeDevScriptPort": {
      const targetRepoPath = args.repoPath as string;
      const port = args.port as number;
      await tauriInvoke("write_dev_script_port", { repoPath: targetRepoPath, port });
      return {} as T;
    }

    case "readAgentsConfig": {
      const result = await tauriInvoke("read_agents_config", { repoPath });
      return { config: result } as T;
    }

    case "list-skills":
    case "skills-list": {
      const result = await tauriInvoke("list_skills");
      return { skills: result } as T;
    }

    case "githubListRepos": {
      const query = args.query as string | undefined;
      const page = args.page as number | undefined;
      const perPage = args.perPage as number | undefined;
      const result = await tauriInvoke("github_list_repos", { query, page, perPage });
      return result as T;
    }

    case "githubResolveAuthSource": {
      const result = await tauriInvoke("github_resolve_auth_source");
      return result as T;
    }

    case "gitCloneIntoFolder": {
      const path = (args.path as string) || "";
      const cloneUrl = (args.cloneUrl as string) || "";
      const branch = args.branch as string | undefined;
      await tauriInvoke("git_clone_into_folder", { path, cloneUrl, branch });
      return {} as T;
    }

    default:
      throw new Error(`Unknown command: ${type}`);
  }
}

type DaemonAction =
  | { type: "SET_CONNECTION"; payload: ConnectionState }
  | { type: "SET_REPO_PATH"; payload: string | null }
  | { type: "SET_STATUS"; payload: GitStatus | null }
  | { type: "SET_BRANCHES"; payload: GitBranch[] }
  | { type: "SET_REPO_HEALTH"; payload: { health: RepoHealth; message: string | null } }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

const initialState: DaemonState = {
  connection: "disconnected",
  repoPath: null,
  status: null,
  branches: [],
  error: null,
  repoHealth: "ready",
  repoMessage: null,
};

function daemonReducer(state: DaemonState, action: DaemonAction): DaemonState {
  switch (action.type) {
    case "SET_CONNECTION":
      return { ...state, connection: action.payload };
    case "SET_REPO_PATH":
      return { ...state, repoPath: action.payload };
    case "SET_STATUS":
      return { ...state, status: action.payload };
    case "SET_BRANCHES":
      return { ...state, branches: action.payload };
    case "SET_REPO_HEALTH":
      return {
        ...state,
        repoHealth: action.payload.health,
        repoMessage: action.payload.message,
      };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    case "RESET":
      return initialState;
    default:
      return state;
  }
}

interface DaemonContextValue {
  state: DaemonState;
  send: <T = unknown>(type: string, payload?: unknown) => Promise<T>;
  setRepoPath: (path: string | null) => Promise<void>;
  refreshStatus: () => Promise<void>;
  refreshBranches: () => Promise<void>;
  reconnect: () => void;
}

const DaemonContext = createContext<DaemonContextValue | null>(null);

const REFRESH_DEBOUNCE_MS = 250;
const HEARTBEAT_REFRESH_INTERVAL_MS = 10_000;
const POWER_DEBUG_ENABLED = process.env.NEXT_PUBLIC_VIBOGIT_DEBUG_POWER === "1";

export function DaemonProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(daemonReducer, initialState);
  const repoPathRef = useRef<string | null>(null);
  const mockConfigRef = useRef<Config>({ ...DEFAULT_CONFIG, theme: "light" });
  const fileChangeUnlistenRef = useRef<(() => void) | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshInFlightRef = useRef(false);
  const refreshQueuedRef = useRef(false);
  const pendingRefreshRef = useRef(false);
  const debugCountersRef = useRef({
    watcherEventsReceived: 0,
    statusRefreshExecuted: 0,
    statusRefreshSkippedBackground: 0,
    statusRefreshSkippedInflight: 0,
  });
  const { isForeground } = useWindowActivity();
  const isForegroundRef = useRef(isForeground);
  const wasForegroundRef = useRef(isForeground);
  const mockParams = getMockParams();

  const flushDebugCounters = useCallback((reason: string) => {
    if (!POWER_DEBUG_ENABLED) return;
    const c = debugCountersRef.current;
    console.debug("[PowerDebug][daemon]", reason, {
      watcherEventsReceived: c.watcherEventsReceived,
      statusRefreshExecuted: c.statusRefreshExecuted,
      statusRefreshSkippedBackground: c.statusRefreshSkippedBackground,
      statusRefreshSkippedInflight: c.statusRefreshSkippedInflight,
    });
  }, []);

  const send = useCallback(<T = unknown,>(type: string, payload?: unknown): Promise<T> => {
    if (mockParams.enabled) {
      return mockSend<T>(type, payload, mockConfigRef);
    }
    return tauriSend<T>(type, payload);
  }, [mockParams.enabled]);

  const refreshStatusNow = useCallback(async (opts?: { allowBackground?: boolean; source?: string }) => {
    const path = repoPathRef.current;
    if (!path) return;

    const allowBackground = opts?.allowBackground ?? false;
    if (!allowBackground && !isForegroundRef.current) {
      pendingRefreshRef.current = true;
      debugCountersRef.current.statusRefreshSkippedBackground += 1;
      if (debugCountersRef.current.statusRefreshSkippedBackground % 20 === 0) {
        flushDebugCounters("skip-background");
      }
      return;
    }

    if (refreshInFlightRef.current) {
      refreshQueuedRef.current = true;
      debugCountersRef.current.statusRefreshSkippedInflight += 1;
      if (debugCountersRef.current.statusRefreshSkippedInflight % 20 === 0) {
        flushDebugCounters("skip-inflight");
      }
      return;
    }

    refreshInFlightRef.current = true;
    pendingRefreshRef.current = false;

    try {
      const response = await send<{ status: GitStatus }>("status", { repoPath: path });
      if (repoPathRef.current === path) {
        dispatch({ type: "SET_STATUS", payload: response.status });
        dispatch({
          type: "SET_REPO_HEALTH",
          payload: response.status.isEmptyRepo
            ? { health: "emptyRepo", message: EMPTY_REPO_MESSAGE }
            : { health: "ready", message: null },
        });
        debugCountersRef.current.statusRefreshExecuted += 1;
        if (debugCountersRef.current.statusRefreshExecuted % 20 === 0) {
          flushDebugCounters(opts?.source ?? "refresh");
        }
      }
    } catch (err) {
      console.error("[Backend] Failed to refresh status:", err);
    } finally {
      refreshInFlightRef.current = false;
      if (refreshQueuedRef.current) {
        refreshQueuedRef.current = false;
        if (refreshTimerRef.current) {
          clearTimeout(refreshTimerRef.current);
        }
        refreshTimerRef.current = setTimeout(() => {
          refreshTimerRef.current = null;
          void refreshStatusNow({ source: "queued" });
        }, REFRESH_DEBOUNCE_MS);
      }
    }
  }, [flushDebugCounters, send]);

  const scheduleStatusRefresh = useCallback((source: string) => {
    if (!repoPathRef.current) return;

    if (!isForegroundRef.current) {
      pendingRefreshRef.current = true;
      debugCountersRef.current.statusRefreshSkippedBackground += 1;
      return;
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
    }

    refreshTimerRef.current = setTimeout(() => {
      refreshTimerRef.current = null;
      void refreshStatusNow({ source });
    }, REFRESH_DEBOUNCE_MS);
  }, [refreshStatusNow]);

  const connect = useCallback(async () => {
    dispatch({ type: "SET_CONNECTION", payload: "connecting" });

    try {
      if (mockParams.enabled) {
        dispatch({ type: "SET_CONNECTION", payload: "connected" });
        dispatch({ type: "SET_ERROR", payload: null });
        return;
      }

      const initialized = await ensureTauriAPIs();
      if (!initialized) {
        dispatch({ type: "SET_CONNECTION", payload: "error" });
        dispatch({ type: "SET_ERROR", payload: "ViboGit desktop backend is unavailable. Launch via Tauri runtime." });
        return;
      }

      dispatch({ type: "SET_CONNECTION", payload: "connected" });
      dispatch({ type: "SET_ERROR", payload: null });

      if (tauriListen) {
        if (fileChangeUnlistenRef.current) {
          fileChangeUnlistenRef.current();
          fileChangeUnlistenRef.current = null;
        }

        const unlistenFile = await tauriListen("file:change", () => {
          debugCountersRef.current.watcherEventsReceived += 1;
          scheduleStatusRefresh("watcher:file-change");
        });

        const unlistenCommit = await tauriListen(MINI_COMMIT_COMPLETE, () => {
          debugCountersRef.current.watcherEventsReceived += 1;
          scheduleStatusRefresh("watcher:mini-commit");
        });

        fileChangeUnlistenRef.current = () => {
          unlistenFile();
          unlistenCommit();
        };
      }
    } catch (err) {
      console.error("[Backend] Failed to connect:", err);
      dispatch({ type: "SET_CONNECTION", payload: "error" });
      dispatch({ type: "SET_ERROR", payload: getErrorMessage(err) || "Failed to connect to desktop backend" });
    }
  }, [mockParams.enabled, scheduleStatusRefresh]);

  const reconnect = useCallback(() => {
    void connect();
  }, [connect]);

  const setRepoPath = useCallback(async (path: string | null) => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshInFlightRef.current = false;
    refreshQueuedRef.current = false;
    pendingRefreshRef.current = false;

    repoPathRef.current = path;
    dispatch({ type: "SET_REPO_PATH", payload: path });
    dispatch({ type: "SET_ERROR", payload: null });

    if (!path) {
      dispatch({ type: "SET_STATUS", payload: null });
      dispatch({ type: "SET_BRANCHES", payload: [] });
      dispatch({ type: "SET_REPO_HEALTH", payload: { health: "ready", message: null } });
      return;
    }

    try {
      const isRepoResponse = await send<{ isRepo: boolean }>("isGitRepo", { path });
      if (!isRepoResponse.isRepo) {
        dispatch({ type: "SET_STATUS", payload: null });
        dispatch({ type: "SET_BRANCHES", payload: [] });
        dispatch({
          type: "SET_REPO_HEALTH",
          payload: { health: "nonGit", message: NON_GIT_REPO_MESSAGE },
        });
        return;
      }

      await send("watch", { repoPath: path });
      const [statusResponse, branchResponse] = await Promise.all([
        send<{ status: GitStatus }>("status", { repoPath: path }),
        send<{ branches: GitBranch[] }>("branches", { repoPath: path }),
      ]);

      if (repoPathRef.current === path) {
        dispatch({ type: "SET_STATUS", payload: statusResponse.status });
        dispatch({ type: "SET_BRANCHES", payload: branchResponse.branches });
        dispatch({
          type: "SET_REPO_HEALTH",
          payload: statusResponse.status.isEmptyRepo
            ? { health: "emptyRepo", message: EMPTY_REPO_MESSAGE }
            : { health: "ready", message: null },
        });
      }
    } catch (err) {
      const message = getErrorMessage(err);
      if (isNotRepositoryMessage(message)) {
        dispatch({ type: "SET_STATUS", payload: null });
        dispatch({ type: "SET_BRANCHES", payload: [] });
        dispatch({
          type: "SET_REPO_HEALTH",
          payload: { health: "nonGit", message: NON_GIT_REPO_MESSAGE },
        });
        dispatch({ type: "SET_ERROR", payload: null });
        return;
      }

      dispatch({ type: "SET_REPO_HEALTH", payload: { health: "ready", message: null } });
      dispatch({ type: "SET_ERROR", payload: message || "Failed to load project state" });
    }
  }, [send]);

  const refreshStatus = useCallback(async () => {
    await refreshStatusNow({ allowBackground: true, source: "manual" });
  }, [refreshStatusNow]);

  const refreshBranches = useCallback(async () => {
    if (!state.repoPath) return;

    const response = await send<{ branches: GitBranch[] }>("branches", { repoPath: state.repoPath });
    dispatch({ type: "SET_BRANCHES", payload: response.branches });
  }, [state.repoPath, send]);

  useEffect(() => {
    isForegroundRef.current = isForeground;

    if (!wasForegroundRef.current && isForeground && pendingRefreshRef.current) {
      pendingRefreshRef.current = false;
      scheduleStatusRefresh("foreground-resume");
    }

    wasForegroundRef.current = isForeground;
  }, [isForeground, scheduleStatusRefresh]);

  useEffect(() => {
    if (!state.repoPath || !isForeground) return;

    const interval = setInterval(() => {
      scheduleStatusRefresh("heartbeat");
    }, HEARTBEAT_REFRESH_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, [state.repoPath, isForeground, scheduleStatusRefresh]);

  useEffect(() => {
    void connect();

    return () => {
      if (fileChangeUnlistenRef.current) {
        fileChangeUnlistenRef.current();
        fileChangeUnlistenRef.current = null;
      }
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      flushDebugCounters("unmount");
    };
  }, [connect, flushDebugCounters]);

  return (
    <DaemonContext.Provider value={{ state, send, setRepoPath, refreshStatus, refreshBranches, reconnect }}>
      {children}
    </DaemonContext.Provider>
  );
}

export function useDaemon() {
  const context = useContext(DaemonContext);
  if (!context) {
    throw new Error("useDaemon must be used within a DaemonProvider");
  }
  return context;
}
