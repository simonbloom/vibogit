"use client";

import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { WelcomeScreen } from "@/components/welcome-screen";
import { MainInterface } from "@/components/main-interface";
import { TabBar } from "@/components/tab-bar";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { state } = useDaemon();
  const { tabs } = useTabs();

  return (
    <main className="min-h-screen">
      {state.connection === "connected" && tabs.length > 0 && <TabBar />}

      {state.connection === "disconnected" && (
        <div className="flex flex-col items-center justify-center p-12 text-center min-h-[calc(100vh-57px)]">
          <h2 className="text-xl font-semibold mb-2">Start the daemon</h2>
          <p className="text-muted-foreground mb-4">Run this command in your terminal:</p>
          <code className="px-4 py-2 bg-muted rounded-md font-mono text-sm">npx vibogit-daemon</code>
        </div>
      )}

      {state.connection === "connecting" && (
        <div className="flex flex-col items-center justify-center p-12 min-h-[calc(100vh-57px)]">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      )}

      {state.connection === "connected" && !state.repoPath && <WelcomeScreen />}
      {state.connection === "connected" && state.repoPath && <MainInterface />}

      {state.connection === "error" && (
        <div className="flex flex-col items-center justify-center p-12 min-h-[calc(100vh-57px)]">
          <p className="text-destructive font-medium">Connection Error</p>
          <p className="text-muted-foreground text-sm mt-1">{state.error}</p>
        </div>
      )}
    </main>
  );
}
