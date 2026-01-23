"use client";

import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";

export function ConnectionStatus() {
  const { state } = useDaemon();

  return (
    <div className="flex items-center gap-2 text-sm">
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
  );
}
