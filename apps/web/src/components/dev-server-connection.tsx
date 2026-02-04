"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, X, AlertTriangle, Pencil } from "lucide-react";
import { clsx } from "clsx";
import type { DevServerState, DevServerConfig } from "@vibogit/shared";

type Status = "disconnected" | "connecting" | "restarting" | "connected" | "error";

interface AgentsConfig {
  port?: number;
  devCommand?: string;
  devArgs?: string[];
  found: boolean;
  filePath?: string;
}

interface Props {
  repoPath: string | null;
  onPortChange?: (port: number | null) => void;
  onRequestPortPrompt?: () => void;
}

export function DevServerConnection({ repoPath, onPortChange, onRequestPortPrompt }: Props) {
  const { send, state: daemonState } = useDaemon();
  const [status, setStatus] = useState<Status>("disconnected");
  const [port, setPort] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portCheckRef = useRef<AbortController | null>(null);

  const clearPolling = useCallback(() => {
    if (portCheckRef.current) {
      portCheckRef.current.abort();
      portCheckRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const isPortOpen = useCallback(async (targetPort: number) => {
    if (portCheckRef.current) {
      portCheckRef.current.abort();
    }
    const controller = new AbortController();
    portCheckRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 2000);

    try {
      await fetch(`http://localhost:${targetPort}`, {
        mode: "no-cors",
        cache: "no-store",
        signal: controller.signal,
      });
      return true;
    } catch {
      return false;
    } finally {
      clearTimeout(timeout);
      if (portCheckRef.current === controller) {
        portCheckRef.current = null;
      }
    }
  }, []);

  const checkServerState = useCallback(async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    try {
      const response = await send<{ state: DevServerState }>("devServerState", {
        path: repoPath,
      });
      
      if (response.state.running && response.state.port) {
        const reachable = await isPortOpen(response.state.port);
        if (!reachable) return;
        clearPolling();
        setStatus("connected");
        setPort(response.state.port);
        onPortChange?.(response.state.port);
      }
    } catch {
      // Silent fail on check
    }
  }, [repoPath, daemonState.connection, send, clearPolling, onPortChange, isPortOpen]);

  // Check server state on tab switch (repoPath change)
  useEffect(() => {
    clearPolling();
    setStatus("disconnected");
    setPort(null);
    setErrorMessage(null);
    onPortChange?.(null);

    if (!repoPath || daemonState.connection !== "connected") return;

    // Check if a server is already running for this project
    const checkExisting = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: repoPath,
        });
        
        if (response.state.running && response.state.port) {
          const reachable = await isPortOpen(response.state.port);
          if (!reachable) return;
          setStatus("connected");
          setPort(response.state.port);
          onPortChange?.(response.state.port);
        }
      } catch {
        // No server running, stay disconnected
      }
    };

    checkExisting();

    return () => {
      clearPolling();
    };
  }, [repoPath, daemonState.connection, send, clearPolling, onPortChange, isPortOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const startPolling = useCallback((targetPort: number, targetRepoPath: string) => {
    clearPolling();
    
    // Set 30 second timeout
    timeoutRef.current = setTimeout(() => {
      clearPolling();
      setStatus("error");
      setErrorMessage("Server start timeout (30s)");
    }, 30000);

    // Poll daemon's devServerState every 1 second
    pollingRef.current = setInterval(async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: targetRepoPath,
        });
        
        if (response.state.running && response.state.port) {
          const reachable = await isPortOpen(response.state.port);
          if (!reachable) return;
          clearPolling();
          setStatus("connected");
          setPort(response.state.port);
          onPortChange?.(response.state.port);
        }
      } catch {
        // Daemon error, continue polling
      }
    }, 1000);
  }, [clearPolling, onPortChange, send, isPortOpen]);

  const handleConnect = async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    setStatus("connecting");
    setErrorMessage(null);

    try {
      // 1. Read agents config to get port
      const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", {
        repoPath,
      });

      let targetPort = configResponse.config.port;
      let devCommand = configResponse.config.devCommand;
      let devArgs = configResponse.config.devArgs;

      // If no port found, request port prompt
      if (!targetPort) {
        // Try to detect from package.json
        const detectResponse = await send<{ config: DevServerConfig | null }>("devServerDetect", {
          path: repoPath,
        });
        
        if (detectResponse.config?.port) {
          targetPort = detectResponse.config.port;
          devCommand = detectResponse.config.command;
          devArgs = detectResponse.config.args;
        } else {
          // Show port prompt modal
          setStatus("disconnected");
          onRequestPortPrompt?.();
          return;
        }
      }

      // 2. Kill any existing process on the port
      await send("killPort", { port: targetPort });

      // 3. Start dev server
      await send("devServerStart", {
        path: repoPath,
        config: {
          command: devCommand || "npm",
          args: devArgs || ["run", "dev"],
          port: targetPort,
        },
      });

      // 4. Start polling
      startPolling(targetPort, repoPath);

    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to connect");
    }
  };

  const handleRestart = async () => {
    if (!repoPath || !port || daemonState.connection !== "connected") return;

    setStatus("restarting");
    setErrorMessage(null);

    try {
      // 1. Stop the current server
      await send("devServerStop", { path: repoPath });

      // 2. Kill the port (ensure it's free)
      await send("killPort", { port });

      // 3. Get config and restart
      const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", {
        repoPath,
      });

      await send("devServerStart", {
        path: repoPath,
        config: {
          command: configResponse.config.devCommand || "npm",
          args: configResponse.config.devArgs || ["run", "dev"],
          port,
        },
      });

      // 4. Start polling
      startPolling(port, repoPath);

    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to restart");
    }
  };

  const handleDisconnect = async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    try {
      await send("devServerStop", { path: repoPath });
      if (port) {
        await send("killPort", { port });
      }
    } catch {
      // Silent fail
    }

    clearPolling();
    setStatus("disconnected");
    setPort(null);
    onPortChange?.(null);
  };

  // Don't render if daemon not connected
  if (daemonState.connection !== "connected" || !repoPath) {
    return null;
  }

  // Disconnected state
  if (status === "disconnected") {
    return (
      <Button variant="destructive" size="sm" onClick={handleConnect}>
        Connect
      </Button>
    );
  }

  // Connecting state
  if (status === "connecting") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500 text-white rounded-md">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Connecting...
      </div>
    );
  }

  // Restarting state
  if (status === "restarting") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500 text-white rounded-md">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Restarting...
      </div>
    );
  }

  const handleOpenBrowser = () => {
    if (port) {
      window.open(`http://localhost:${port}`, "_blank", "noopener,noreferrer");
    }
  };

  // Connected state
  if (status === "connected") {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleOpenBrowser}
          className="flex items-center gap-1.5 px-2 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors cursor-pointer"
          title="Open in browser"
        >
          <span className="w-2 h-2 rounded-full bg-white" />
          :{port}
        </button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onRequestPortPrompt}
          title="Change port"
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRestart}
          title="Restart server"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:text-destructive"
          onClick={handleDisconnect}
          title="Stop server"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-destructive">
          <AlertTriangle className="w-3.5 h-3.5" />
          Failed
        </div>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={handleConnect}>
          Retry
        </Button>
      </div>
    );
  }

  return null;
}
