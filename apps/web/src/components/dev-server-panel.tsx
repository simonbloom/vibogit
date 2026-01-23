"use client";

import { useState, useEffect, useRef } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import {
  Play,
  Square,
  RefreshCw,
  Globe,
  ChevronDown,
  ChevronRight,
  Terminal,
  Loader2,
} from "lucide-react";
import type { DevServerConfig, DevServerState } from "@vibogit/shared";

interface DevServerPanelProps {
  repoPath: string | null;
}

export function DevServerPanel({ repoPath }: DevServerPanelProps) {
  const { send } = useDaemon();
  const [isExpanded, setIsExpanded] = useState(false);
  const [config, setConfig] = useState<DevServerConfig | null>(null);
  const [state, setState] = useState<DevServerState>({ running: false, logs: [] });
  const [isLoading, setIsLoading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Detect dev server config
  useEffect(() => {
    if (!repoPath) return;

    const detect = async () => {
      try {
        const response = await send<{ config: DevServerConfig | null }>("devServerDetect", {
          path: repoPath,
        });
        setConfig(response.config);
      } catch (error) {
        console.error("Failed to detect dev server:", error);
      }
    };

    detect();
  }, [repoPath, send]);

  // Get initial state
  useEffect(() => {
    if (!repoPath) return;

    const getState = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: repoPath,
        });
        setState(response.state);
      } catch (error) {
        console.error("Failed to get dev server state:", error);
      }
    };

    getState();
  }, [repoPath, send]);

  // Scroll to bottom when new logs arrive
  useEffect(() => {
    if (logsEndRef.current && isExpanded) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.logs, isExpanded]);

  const handleStart = async () => {
    if (!repoPath || !config) return;

    setIsLoading(true);
    setIsExpanded(true);
    try {
      await send("devServerStart", { path: repoPath, config });
      setState((prev) => ({ ...prev, running: true }));
    } catch (error) {
      console.error("Failed to start dev server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStop = async () => {
    if (!repoPath) return;

    setIsLoading(true);
    try {
      await send("devServerStop", { path: repoPath });
      setState((prev) => ({ ...prev, running: false }));
    } catch (error) {
      console.error("Failed to stop dev server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = async () => {
    if (!repoPath || !config) return;

    setIsLoading(true);
    try {
      await send("devServerRestart", { path: repoPath, config });
    } catch (error) {
      console.error("Failed to restart dev server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenBrowser = async () => {
    if (!state.port) return;
    await send("openBrowser", { url: `http://localhost:${state.port}` });
  };

  // Listen for log messages
  useEffect(() => {
    // This would normally be handled by the WebSocket message handler
    // For now, we'll poll for state
    if (!repoPath || !state.running) return;

    const interval = setInterval(async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: repoPath,
        });
        setState(response.state);
      } catch {
        // Ignore errors
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [repoPath, state.running, send]);

  if (!config) {
    return null; // No dev server detected
  }

  return (
    <div className="border-t border-border">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => e.key === "Enter" && setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-2 hover:bg-surface-light transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-text-muted" />
          ) : (
            <ChevronRight className="w-4 h-4 text-text-muted" />
          )}
          <Terminal className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-secondary">Dev Server</span>
          {state.running && (
            <span className="flex items-center gap-1 text-xs text-status-added">
              <span className="w-2 h-2 rounded-full bg-status-added animate-pulse" />
              Running
            </span>
          )}
        </div>

        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {state.running ? (
            <>
              {state.port && (
                <button
                  onClick={handleOpenBrowser}
                  className="p-1.5 rounded hover:bg-border text-text-muted hover:text-accent transition-colors"
                  title="Open in browser"
                >
                  <Globe className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={handleRestart}
                disabled={isLoading}
                className="p-1.5 rounded hover:bg-border text-text-muted hover:text-text-primary transition-colors disabled:opacity-50"
                title="Restart"
              >
                <RefreshCw className={clsx("w-4 h-4", isLoading && "animate-spin")} />
              </button>
              <button
                onClick={handleStop}
                disabled={isLoading}
                className="p-1.5 rounded hover:bg-border text-text-muted hover:text-status-deleted transition-colors disabled:opacity-50"
                title="Stop"
              >
                <Square className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              onClick={handleStart}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-border text-text-muted hover:text-status-added transition-colors disabled:opacity-50"
              title="Start"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border">
          <div className="px-4 py-2 bg-surface-light text-xs text-text-muted">
            {config.command} {config.args.join(" ")}
            {state.port && (
              <span className="ml-2 text-accent">→ localhost:{state.port}</span>
            )}
          </div>
          <div className="h-40 overflow-y-auto bg-background font-mono text-xs p-2">
            {state.logs.length === 0 ? (
              <p className="text-text-muted">No logs yet. Start the server to see output.</p>
            ) : (
              state.logs.map((log, i) => (
                <div key={i} className="text-text-secondary whitespace-pre-wrap break-all">
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </div>
  );
}
