"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, RefreshCw, X, AlertTriangle, ChevronDown, Globe, Settings } from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import type { DevServerState, DevServerConfig } from "@vibogit/shared";

type Status = "disconnected" | "connecting" | "restarting" | "connected" | "error";

interface AgentsConfig {
  port?: number;
  devCommand?: string;
  devArgs?: string[];
  found: boolean;
  filePath?: string;
  isMonorepo: boolean;
}

interface Props {
  repoPath: string | null;
  onPortChange?: (port: number | null) => void;
  onRequestPortPrompt?: (isMonorepo?: boolean) => void;
  onMonorepoChange?: (isMonorepo: boolean) => void;
}

export function DevServerConnection({ repoPath, onPortChange, onRequestPortPrompt, onMonorepoChange }: Props) {
  const { send, state: daemonState } = useDaemon();
  const [status, setStatus] = useState<Status>("disconnected");
  const [port, setPort] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [isMonorepo, setIsMonorepo] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portCheckRef = useRef<AbortController | null>(null);
  const statusRef = useRef<Status>(status);
  statusRef.current = status;

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



  const checkServerState = useCallback(async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    try {
      const response = await send<{ state: DevServerState }>("devServerState", {
        path: repoPath,
      });
      
      // Rust now checks both process AND port listening
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
    setDetectedPort(null);
    setIsMonorepo(false);
    setErrorMessage(null);
    onPortChange?.(null);

    if (!repoPath || daemonState.connection !== "connected") return;

    // Fetch agents config to get detected port and monorepo status
    const fetchConfig = async () => {
      try {
        const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", {
          repoPath,
        });
        setDetectedPort(configResponse.config.port ?? null);
        setIsMonorepo(configResponse.config.isMonorepo);
        onMonorepoChange?.(configResponse.config.isMonorepo);
      } catch {
        // Config fetch failed, leave as unknown
      }
    };
    fetchConfig();

    // Check if a server is already running for this project
    const checkExisting = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: repoPath,
        });
        
        // Rust now checks both process AND port listening
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
          // Backend already verified port is listening via TCP check
          clearPolling();
          setStatus("connected");
          setPort(response.state.port);
          onPortChange?.(response.state.port);
        }
      } catch {
        // Daemon error, continue polling
      }
    }, 1000);
  }, [clearPolling, onPortChange, send]);

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

      // 2. Kill any existing process on the port and clean up lock files
      await send("killPort", { port: targetPort });
      await send("cleanupDevLocks", { path: repoPath });

      // 3. Start dev server
      await send("devServerStart", {
        path: repoPath,
        config: {
          command: devCommand || "bun",
          args: devArgs || ["run", "dev"],
          port: targetPort,
        },
      });

      // 4. Start polling with 30s timeout
      startPolling(targetPort, repoPath);

      // Set timeout for connection (use ref to check current status)
      timeoutRef.current = setTimeout(() => {
        if (statusRef.current === "connecting") {
          setStatus("error");
          setErrorMessage("Server did not start within 30 seconds");
          toast.error("Dev server timeout", {
            description: "Server did not start within 30 seconds",
            duration: 5000,
          });
          clearPolling();
        }
      }, 30000);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to connect";
      setStatus("error");
      setErrorMessage(errorMsg);
      toast.error("Dev server failed", {
        description: errorMsg,
        duration: 5000,
      });
    }
  };

  const handleRestart = async () => {
    if (!repoPath || !port || daemonState.connection !== "connected") return;

    setStatus("restarting");
    setErrorMessage(null);

    try {
      // 1. Stop the current server
      await send("devServerStop", { path: repoPath });

      // 2. Kill the port and clean up lock files
      await send("killPort", { port });
      await send("cleanupDevLocks", { path: repoPath });

      // 3. Get config and restart
      const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", {
        repoPath,
      });

      await send("devServerStart", {
        path: repoPath,
        config: {
          command: configResponse.config.devCommand || "bun",
          args: configResponse.config.devArgs || ["run", "dev"],
          port,
        },
      });

      // 4. Start polling
      startPolling(port, repoPath);

    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to restart";
      setStatus("error");
      setErrorMessage(errorMsg);
      toast.error("Dev server restart failed", {
        description: errorMsg,
        duration: 5000,
      });
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
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 text-sm bg-muted text-muted-foreground rounded-md font-mono hover:bg-muted/80 transition-colors"
            >
              :{detectedPort ?? "????"}
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onRequestPortPrompt?.()}>
              <Settings className="w-4 h-4 mr-2" />
              Edit port...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="destructive" size="sm" onClick={handleConnect}>
          Connect
        </Button>
      </div>
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

  const handleOpenBrowser = async () => {
    if (port) {
      await send("openBrowser", { url: `http://localhost:${port}` });
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
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          :{port}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground transition-colors"
              title="More options"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleOpenBrowser}>
              <Globe className="w-4 h-4 mr-2" />
              Open in browser
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRequestPortPrompt?.()}>
              <Settings className="w-4 h-4 mr-2" />
              Edit port...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
      <div className="flex items-center gap-1.5" title={errorMessage || undefined}>
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-destructive">
          <AlertTriangle className="w-3.5 h-3.5" />
          Failed
        </div>
        {errorMessage && (
          <span className="text-xs text-destructive/80 truncate max-w-[220px]">
            {errorMessage}
          </span>
        )}
        <Button variant="ghost" size="sm" className="text-destructive" onClick={handleConnect}>
          Retry
        </Button>
      </div>
    );
  }

  return null;
}
