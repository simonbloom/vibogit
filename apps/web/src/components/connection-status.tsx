"use client";

import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";

export function ConnectionStatus() {
  const { state } = useDaemon();

  const statusConfig = {
    disconnected: {
      color: "bg-status-deleted",
      text: "Disconnected",
    },
    connecting: {
      color: "bg-status-modified",
      text: "Connecting...",
    },
    connected: {
      color: "bg-status-added",
      text: "Connected",
    },
    error: {
      color: "bg-status-deleted",
      text: "Error",
    },
  };

  const config = statusConfig[state.connection];

  return (
    <div className="flex items-center gap-2">
      <div
        className={clsx(
          "w-2 h-2 rounded-full",
          config.color,
          state.connection === "connecting" && "animate-pulse"
        )}
      />
      <span className="text-sm text-text-secondary">{config.text}</span>
    </div>
  );
}
