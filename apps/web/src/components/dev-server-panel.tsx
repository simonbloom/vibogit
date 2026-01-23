"use client";

import { useState, useEffect, useRef } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import {
  Play,
  Square,
  ChevronDown,
  ChevronRight,
  Zap,
  Plus,
  Loader2,
  ExternalLink,
} from "lucide-react";
import type { DevServerConfig, DevServerState } from "@vibogit/shared";

interface DevServerPanelProps {
  repoPath: string | null;
}

interface CustomServer {
  command: string;
  port: number;
}

export function DevServerPanel({ repoPath }: DevServerPanelProps) {
  const { send } = useDaemon();
  const [isExpanded, setIsExpanded] = useState(true);
  const [config, setConfig] = useState<DevServerConfig | null>(null);
  const [state, setState] = useState<DevServerState>({ running: false, logs: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [newServer, setNewServer] = useState<CustomServer>({ command: "bun run dev", port: 3000 });
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (logsEndRef.current && isExpanded) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.logs, isExpanded]);

  const handleStart = async (serverConfig?: CustomServer) => {
    if (!repoPath) return;
    const useConfig = serverConfig || config;
    if (!useConfig) return;

    setIsLoading(true);
    try {
      await send("devServerStart", {
        path: repoPath,
        config: serverConfig
          ? { command: serverConfig.command.split(" ")[0], args: serverConfig.command.split(" ").slice(1), port: serverConfig.port }
          : useConfig,
      });
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
      setState({ running: false, logs: [] });
    } catch (error) {
      console.error("Failed to stop dev server:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddServer = () => {
    handleStart(newServer);
  };

  const handleOpenBrowser = () => {
    const port = state.port || config?.port || 3000;
    window.open(`http://localhost:${port}`, "_blank");
  };

  return (
    <div className="border-b">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => e.key === "Enter" && setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer"
      >
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          )}
          <Zap className="w-4 h-4 text-primary" />
          <span className="font-medium">Dev Servers</span>
          {state.running && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              Running
            </span>
          )}
        </div>
        {state.running && (
          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={handleOpenBrowser}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
              title="Open in browser"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            <button
              onClick={handleStop}
              disabled={isLoading}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
              title="Stop"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4" />}
            </button>
          </div>
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4">
          {!config && !state.running ? (
            <div className="text-center py-4 text-muted-foreground text-sm">
              <p>No server config in agents.md</p>
              <p className="mt-1">Add a server manually below</p>
            </div>
          ) : config && !state.running ? (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
              <div className="text-sm">
                <span className="text-muted-foreground">Command: </span>
                <span className="font-mono">{config.command} {config.args.join(" ")}</span>
              </div>
              <button
                onClick={() => handleStart()}
                disabled={isLoading}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start
              </button>
            </div>
          ) : null}

          {state.running && state.logs.length > 0 && (
            <div className="mt-3 h-32 overflow-y-auto bg-muted rounded-lg p-2 font-mono text-xs">
              {state.logs.map((log, i) => (
                <div key={i} className="text-muted-foreground whitespace-pre-wrap">
                  {log}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          )}

          <div className="mt-4 pt-4 border-t">
            <h4 className="text-sm font-medium text-muted-foreground mb-3">Add Server</h4>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Command</label>
                <input
                  type="text"
                  value={newServer.command}
                  onChange={(e) => setNewServer({ ...newServer, command: e.target.value })}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="bun run dev"
                />
              </div>
              <div className="w-24">
                <label className="text-xs text-muted-foreground mb-1 block">Port</label>
                <input
                  type="number"
                  value={newServer.port}
                  onChange={(e) => setNewServer({ ...newServer, port: parseInt(e.target.value) || 3000 })}
                  className="w-full px-3 py-2 bg-background border rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleAddServer}
                disabled={isLoading || !newServer.command.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Add
              </button>
              <button
                onClick={() => setNewServer({ command: "bun run dev", port: 3000 })}
                className="px-3 py-1.5 text-muted-foreground hover:text-foreground text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
