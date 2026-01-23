"use client";

import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";

export function ConnectionStatus() {
  const { state } = useDaemon();

  const statusConfig = {
    disconnected: {
      color: "bg-destructive",
      text: "Disconnected",
    },
    connecting: {
      color: "bg-yellow-500",
      text: "Connecting...",
    },
    connected: {
      color: "bg-green-500",
      text: "Connected",
    },
    error: {
      color: "bg-destructive",
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
      <span className="text-sm text-muted-foreground">{config.text}</span>
    </div>
  );
}
