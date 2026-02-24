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
  GitStatus,
  GitBranch,
} from "@vibogit/shared";
import { MINI_COMMIT_COMPLETE } from "./mini-view-events";
import { useWindowActivity } from "./use-window-activity";

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
      };
      return {
        status: {
          branch: state.branch,
          staged: state.stagedFiles.map((f) => ({ path: f.path, status: f.status, staged: true })),
          unstaged: state.changedFiles.map((f) => ({ path: f.path, status: f.status, staged: false })),
          untracked: state.untrackedFiles.map((f) => ({ path: f, status: "untracked", staged: false })),
          ahead: state.ahead,
          behind: state.behind,
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

    default:
      throw new Error(`Unknown command: ${type}`);
  }
}

type DaemonAction =
  | { type: "SET_CONNECTION"; payload: ConnectionState }
  | { type: "SET_REPO_PATH"; payload: string | null }
  | { type: "SET_STATUS"; payload: GitStatus | null }
  | { type: "SET_BRANCHES"; payload: GitBranch[] }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "RESET" };

const initialState: DaemonState = {
  connection: "disconnected",
  repoPath: null,
  status: null,
  branches: [],
  error: null,
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
    case "SET_ERROR":
      return { ...state, error: action.payload, connection: action.payload ? "error" : state.connection };
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
    return tauriSend<T>(type, payload);
  }, []);

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
      dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err.message : "Failed to connect to desktop backend" });
    }
  }, [scheduleStatusRefresh]);

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

    if (!path) {
      dispatch({ type: "SET_STATUS", payload: null });
      dispatch({ type: "SET_BRANCHES", payload: [] });
      return;
    }

    try {
      await send("watch", { repoPath: path });
      const [statusResponse, branchResponse] = await Promise.all([
        send<{ status: GitStatus }>("status", { repoPath: path }),
        send<{ branches: GitBranch[] }>("branches", { repoPath: path }),
      ]);

      if (repoPathRef.current === path) {
        dispatch({ type: "SET_STATUS", payload: statusResponse.status });
        dispatch({ type: "SET_BRANCHES", payload: branchResponse.branches });
      }
    } catch (err) {
      dispatch({ type: "SET_ERROR", payload: err instanceof Error ? err.message : "Failed to load project state" });
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
