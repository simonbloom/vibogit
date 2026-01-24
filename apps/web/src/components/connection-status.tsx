"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { clsx } from "clsx";
import type { DevServerState } from "@vibogit/shared";

export function ConnectionStatus() {
  const { state, send } = useDaemon();
  const [devServer, setDevServer] = useState<DevServerState | null>(null);

  useEffect(() => {
    if (state.connection !== "connected" || !state.repoPath) {
      setDevServer(null);
      return;
    }

    const checkDevServer = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: state.repoPath,
        });
        setDevServer(response.state);
      } catch {
        setDevServer(null);
      }
    };

    checkDevServer();
    const interval = setInterval(checkDevServer, 5000);
    return () => clearInterval(interval);
  }, [state.connection, state.repoPath, send]);

  const handlePortClick = () => {
    if (devServer?.port) {
      window.open(`http://localhost:${devServer.port}`, "_blank");
    }
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <span
          className={clsx(
            "w-2 h-2 rounded-full",
            state.connection === "connected" && "bg-green-500",
            state.connection === "connecting" && "bg-yellow-500 animate-pulse",
            state.connection === "disconnected" && "bg-gray-400",
            state.connection === "error" && "bg-red-500"
          )}
        />
        <span className="text-muted-foreground">
          {state.connection === "connected" && (devServer?.port ? "Connected to" : "Connected")}
          {state.connection === "connecting" && "Connecting..."}
          {state.connection === "disconnected" && "Disconnected"}
          {state.connection === "error" && "Error"}
        </span>
      </div>
      {devServer?.running && devServer.port && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePortClick}
          className="h-auto px-2 py-0.5 font-mono text-xs"
          title="Open in browser"
        >
          :{devServer.port}
        </Button>
      )}
    </div>
  );
}
