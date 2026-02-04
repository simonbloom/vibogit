"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
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

  const handlePortClick = async () => {
    if (devServer?.port) {
      await send("openBrowser", { url: `http://localhost:${devServer.port}` });
    }
  };

  return null;
}
