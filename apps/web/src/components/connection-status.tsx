"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
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
          {state.connection === "connected" && "Connected"}
          {state.connection === "connecting" && "Connecting..."}
          {state.connection === "disconnected" && "Disconnected"}
          {state.connection === "error" && "Error"}
        </span>
      </div>
      {devServer?.running && devServer.port && (
        <button
          onClick={handlePortClick}
          className="px-2 py-0.5 bg-green-100 text-green-700 rounded font-mono text-xs hover:bg-green-200 transition-colors"
          title="Open in browser"
        >
          :{devServer.port}
        </button>
      )}
    </div>
  );
}
