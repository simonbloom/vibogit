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
  WebSocketMessage,
} from "@vibogit/shared";

const DAEMON_URL = "ws://localhost:9111";
const RECONNECT_DELAY = 3000;

// Tauri detection and integration
const isTauri = (): boolean => {
  try {
    return typeof window !== 'undefined' && '__TAURI__' in window;
  } catch {
    return false;
  }
};

// Dynamic import for Tauri APIs (only when in Tauri)
let tauriInvoke: ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>) | null = null;
let tauriListen: ((event: string, handler: (event: { payload: unknown }) => void) => Promise<() => void>) | null = null;
let tauriInitialized = false;

async function ensureTauriAPIs(): Promise<boolean> {
  if (!isTauri()) return false;
  if (tauriInitialized) return true;
  
  try {
    const core = await import('@tauri-apps/api/core');
    const event = await import('@tauri-apps/api/event');
    tauriInvoke = core.invoke;
    tauriListen = event.listen;
    tauriInitialized = true;
    return true;
  } catch (err) {
    console.warn('[Tauri] Failed to load APIs:', err);
    return false;
  }
}

// Map daemon message types to Tauri commands
async function tauriSend<T>(type: string, payload?: unknown): Promise<T> {
  if (!tauriInvoke) {
    throw new Error("Tauri not initialized");
  }
  
  const args = payload as Record<string, unknown> | undefined;
  const repoPath = args?.repoPath as string || args?.path as string || "";
  
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
          staged: state.stagedFiles.map(f => ({ path: f.path, status: f.status, staged: true })),
          unstaged: state.changedFiles.map(f => ({ path: f.path, status: f.status, staged: false })),
          untracked: state.untrackedFiles.map(f => ({ path: f, status: "untracked", staged: false })),
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
      const files = args?.files as string[] | undefined;
      await tauriInvoke("git_stage", { path: repoPath, files: files || [] });
      return {} as T;
    }
    
    case "unstage": {
      const files = args?.files as string[] | undefined;
      await tauriInvoke("git_unstage", { path: repoPath, files: files || [] });
      return {} as T;
    }
    
    case "stageAll": {
      await tauriInvoke("git_stage", { path: repoPath, files: ["*"] });
      return {} as T;
    }
    
    case "commit": {
      const message = args?.message as string | undefined;
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
      const branch = args?.branch as string || args?.ref as string || "";
      await tauriInvoke("git_checkout", { path: repoPath, branch });
      return {} as T;
    }
    
    case "createBranch": {
      const name = args?.name as string || "";
      const checkout = args?.checkout as boolean | undefined;
      await tauriInvoke("git_create_branch", { path: repoPath, name, checkout });
      return {} as T;
    }
    
    case "stashSave": {
      const message = args?.message as string | undefined;
      await tauriInvoke("git_stash_save", { path: repoPath, message });
      return {} as T;
    }
    
    case "stashPop": {
      await tauriInvoke("git_stash_pop", { path: repoPath });
      return {} as T;
    }
    
    case "log": {
      const limit = args?.limit as number | undefined;
      const result = await tauriInvoke("git_log", { path: repoPath, limit }) as unknown[];
      // Map sha/shortSha to hash/hashShort for frontend compatibility
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
      const file = args?.file as string | undefined;
      const staged = args?.staged as boolean | undefined;
      
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
      const checkPath = args?.path as string || "";
      const result = await tauriInvoke("is_git_repo", { path: checkPath });
      return { isRepo: result } as T;
    }
    
    case "initGit": {
      const initPath = args?.path as string || "";
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
      const configPatch = args?.config as Record<string, unknown> | undefined;
      const current = await tauriInvoke("get_config") as Record<string, unknown>;
      const merged = { ...current, ...configPatch };
      const result = await tauriInvoke("set_config", { config: merged });
      return { config: result } as T;
    }
    
    case "listFiles": {
      const showHidden = args?.showHidden as boolean | undefined;
      const result = await tauriInvoke("list_files", { path: repoPath, showHidden });
      return { tree: result } as T;
    }
    
    case "readFile": {
      const filePath = args?.filePath as string || "";
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
      const url = args?.url as string || "";
      await tauriInvoke("open_in_browser", { url });
      return {} as T;
    }
    
    case "openTerminal": {
      const terminal = args?.terminal as string | undefined;
      await tauriInvoke("open_terminal_with_app", { path: repoPath, terminal });
      return {} as T;
    }
    
    case "sendToTerminal": {
      const text = args?.text as string || "";
      const terminal = args?.terminal as string | undefined;
      const autoExecute = args?.autoExecute as boolean | undefined;
      await tauriInvoke("send_to_terminal", { text, terminal, autoExecute });
      return {} as T;
    }
    
    case "openEditor": {
      const editorPath = args?.path as string || "";
      const appName = args?.appName as string | undefined;
      const editor = args?.editor as string | undefined;
      await tauriInvoke("open_editor_with_app", { path: editorPath, appName, editorCommand: editor });
      return {} as T;
    }
    
    case "devServerDetect": {
      const result = await tauriInvoke("dev_server_detect", { path: repoPath });
      return { config: result } as T;
    }
    
    case "devServerStart": {
      const config = args?.config as Record<string, unknown> | undefined;
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
      const port = args?.port as number;
      await tauriInvoke("kill_port", { port });
      return {} as T;
    }
    case "cleanupDevLocks": {
      const path = args?.path as string;
      await tauriInvoke("cleanup_dev_locks", { path });
      return {} as T;
    }
    case "writeAgentsConfig": {
      const repoPath = args?.repoPath as string;
      const port = args?.port as number;
      await tauriInvoke("write_agents_config", { repoPath, port });
      return {} as T;
    }
    
    case "readAgentsConfig": {
      const result = await tauriInvoke("read_agents_config", { repoPath });
      return { config: result } as T;
    }
    
    case "updateAgentsConfig": {
      const port = args?.port as number;
      await tauriInvoke("update_agents_config", { repoPath, port });
      return {} as T;
    }
    
    case "list-skills":
    case "skills-list": {
      const result = await tauriInvoke("list_skills");
      return { skills: result } as T;
    }
    
    default:
      console.warn(`[Tauri] Unknown command: ${type}`);
      return {} as T;
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

interface PendingRequest {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
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

export function DaemonProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(daemonReducer, initialState);
  const wsRef = useRef<WebSocket | null>(null);
  const pendingRef = useRef(new Map<string, PendingRequest>());
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const repoPathRef = useRef<string | null>(null);

  const generateId = () => Math.random().toString(36).substring(2, 15);

  const send = useCallback(<T = unknown,>(type: string, payload?: unknown): Promise<T> => {
    // If running in Tauri and initialized, use invoke instead of WebSocket
    if (tauriInitialized && tauriInvoke) {
      return tauriSend<T>(type, payload);
    }
    
    return new Promise((resolve, reject) => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        reject(new Error("Not connected to daemon"));
        return;
      }

      const id = generateId();
      pendingRef.current.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
      });

      wsRef.current.send(JSON.stringify({ type, id, payload }));

      setTimeout(() => {
        if (pendingRef.current.has(id)) {
          pendingRef.current.delete(id);
          reject(new Error("Request timed out"));
        }
      }, 30000);
    });
  }, []);

  const refreshStatusInternal = useCallback(async () => {
    const path = repoPathRef.current;
    if (!path) return;
    try {
      const response = await send<{ status: GitStatus }>("status", { repoPath: path });
      dispatch({ type: "SET_STATUS", payload: response.status });
    } catch (err) {
      console.error("[Daemon] Failed to refresh status:", err);
    }
  }, [send]);

  const connect = useCallback(async () => {
    // If running in Tauri, connect immediately (no WebSocket needed)
    if (isTauri()) {
      try {
        const initialized = await ensureTauriAPIs();
        if (initialized) {
          dispatch({ type: "SET_CONNECTION", payload: "connected" });
          dispatch({ type: "SET_ERROR", payload: null });
          
          // Set up Tauri event listeners for file changes
          if (tauriListen) {
            tauriListen("file:change", () => {
              refreshStatusInternal();
            });
          }
          return;
        }
        // Fall through to WebSocket if Tauri init failed
      } catch (err) {
        console.error("[Tauri] Failed to initialize:", err);
        // Fall through to WebSocket
      }
    }
    
    // WebSocket mode for browser
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    dispatch({ type: "SET_CONNECTION", payload: "connecting" });

    const ws = new WebSocket(DAEMON_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      dispatch({ type: "SET_CONNECTION", payload: "connected" });
      dispatch({ type: "SET_ERROR", payload: null });
    };

    ws.onmessage = (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data);
        const { type, id, payload, error } = message;

        const pending = pendingRef.current.get(id);
        if (pending) {
          pendingRef.current.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(payload);
          }
          return;
        }

        // Handle server-initiated messages (file changes)
        if (type === "fileChange") {
          refreshStatusInternal();
        }
      } catch (err) {
        console.error("[Daemon] Failed to parse message:", err);
      }
    };

    ws.onclose = () => {
      dispatch({ type: "SET_CONNECTION", payload: "disconnected" });
      wsRef.current = null;
      reconnectTimeoutRef.current = setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      dispatch({ type: "SET_ERROR", payload: "Failed to connect to daemon" });
    };
  }, [refreshStatusInternal]);

  const reconnect = useCallback(() => {
    // Clear any pending reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    // Close existing connection if any
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    // Clear pending requests
    pendingRef.current.clear();
    // Initiate new connection
    connect();
  }, [connect]);

  const setRepoPath = useCallback(async (path: string | null) => {
    repoPathRef.current = path;
    dispatch({ type: "SET_REPO_PATH", payload: path });

    if (path) {
      await send("watch", { repoPath: path });
      const response = await send<{ status: GitStatus }>("status", { repoPath: path });
      dispatch({ type: "SET_STATUS", payload: response.status });
      const branchResponse = await send<{ branches: GitBranch[] }>("branches", { repoPath: path });
      dispatch({ type: "SET_BRANCHES", payload: branchResponse.branches });
    } else {
      dispatch({ type: "SET_STATUS", payload: null });
      dispatch({ type: "SET_BRANCHES", payload: [] });
    }
  }, [send]);

  const refreshStatus = useCallback(async () => {
    if (!state.repoPath) return;
    const response = await send<{ status: GitStatus }>("status", { repoPath: state.repoPath });
    dispatch({ type: "SET_STATUS", payload: response.status });
  }, [state.repoPath, send]);

  const refreshBranches = useCallback(async () => {
    if (!state.repoPath) return;
    const response = await send<{ branches: GitBranch[] }>("branches", { repoPath: state.repoPath });
    dispatch({ type: "SET_BRANCHES", payload: response.branches });
  }, [state.repoPath, send]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

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
