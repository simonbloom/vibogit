"use client";

import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { ConnectionState } from "@vibogit/shared";

const statusConfig: Record<ConnectionState, { dotClass: string; label: string }> = {
  connected: { dotClass: "bg-green-500", label: "Connected" },
  connecting: { dotClass: "bg-yellow-500", label: "Connecting..." },
  disconnected: { dotClass: "bg-red-500", label: "Disconnected" },
  error: { dotClass: "bg-red-500", label: "Error" },
};

export function ConnectionIndicator() {
  const { state, reconnect } = useDaemon();
  const { dotClass, label } = statusConfig[state.connection];
  const showReconnect = state.connection === "disconnected" || state.connection === "error";
  const isConnecting = state.connection === "connecting";

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${dotClass}`} />
      <span className="text-sm text-muted-foreground">{label}</span>
      {isConnecting && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
      {showReconnect && (
        <Button variant="ghost" size="sm" onClick={reconnect} className="h-6 px-2 text-xs">
          Reconnect
        </Button>
      )}
    </div>
  );
}
