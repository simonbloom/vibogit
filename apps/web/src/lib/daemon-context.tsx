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
  const repoPath = args?.repoPath as string || "";
  
  switch (type) {
    case "status": {
      const result = await tauriInvoke("git_status", { path: repoPath });
      // Map Tauri ProjectState to daemon GitStatus format
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
          staged: state.stagedFiles.map(f => ({ path: f.path, status: f.status })),
          unstaged: state.changedFiles.map(f => ({ path: f.path, status: f.status })),
          untracked: state.untrackedFiles,
          ahead: state.ahead,
          behind: state.behind,
        }
      } as T;
    }
    
    case "branches": {
      // TODO: Implement branches command in Tauri
      return { branches: [] } as T;
    }
    
    case "watch": {
      // File watching is handled automatically by Tauri's set_project
      await tauriInvoke("set_project", { path: repoPath });
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
    
    case "log": {
      const limit = args?.limit as number | undefined;
      const result = await tauriInvoke("git_log", { path: repoPath, limit });
      return { log: result } as T;
    }
    
    case "diff": {
      const result = await tauriInvoke("git_diff", { path: repoPath });
      return { diff: result } as T;
    }
    
    case "openFolder": {
      const result = await tauriInvoke("add_project_folder");
      return { path: result } as T;
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
