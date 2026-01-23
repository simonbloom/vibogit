"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Loader2, RefreshCw, X, AlertTriangle } from "lucide-react";
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

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const checkServerState = useCallback(async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    try {
      const response = await send<{ state: DevServerState }>("devServerState", {
        path: repoPath,
      });
      
      if (response.state.running && response.state.port) {
        clearPolling();
        setStatus("connected");
        setPort(response.state.port);
        onPortChange?.(response.state.port);
      }
    } catch {
      // Silent fail on check
    }
  }, [repoPath, daemonState.connection, send, clearPolling, onPortChange]);

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
  }, [repoPath, daemonState.connection, send, clearPolling, onPortChange]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearPolling();
    };
  }, [clearPolling]);

  const startPolling = useCallback((targetPort: number, isRestart: boolean) => {
    clearPolling();
    
    // Set 30 second timeout
    timeoutRef.current = setTimeout(() => {
      clearPolling();
      setStatus("error");
      setErrorMessage("Server start timeout (30s)");
    }, 30000);

    // Poll every 1 second
    pollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`http://localhost:${targetPort}`, {
          method: "HEAD",
          mode: "no-cors",
        });
        // If we get here, server is responding
        clearPolling();
        setStatus("connected");
        setPort(targetPort);
        onPortChange?.(targetPort);
      } catch {
        // Server not yet responding, continue polling
      }
    }, 1000);
  }, [clearPolling, onPortChange]);

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
      startPolling(targetPort, false);

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
      startPolling(port, true);

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
      <button
        onClick={handleConnect}
        className="flex items-center gap-1.5 px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition-colors"
      >
        Connect
      </button>
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

  // Connected state
  if (status === "connected") {
    return (
      <div className="flex items-center gap-1">
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm bg-green-500 text-white rounded-md">
          <span className="w-2 h-2 rounded-full bg-white" />
          :{port}
        </div>
        <button
          onClick={handleRestart}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors"
          title="Restart server"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleDisconnect}
          className="p-1.5 text-muted-foreground hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Stop server"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // Error state
  if (status === "error") {
    return (
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-red-500">
          <AlertTriangle className="w-3.5 h-3.5" />
          Failed
        </div>
        <button
          onClick={handleConnect}
          className="px-2 py-1 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return null;
}
