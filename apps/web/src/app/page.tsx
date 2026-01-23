"use client";

import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { ConnectionStatus } from "@/components/connection-status";
import { WelcomeScreen } from "@/components/welcome-screen";
import { MainInterface } from "@/components/main-interface";
import { TabBar } from "@/components/tab-bar";

export default function Home() {
  const { state } = useDaemon();
  const { tabs } = useTabs();

  return (
    <main className="min-h-screen">
      <header className="flex items-center justify-between p-4 border-b">
        <h1 className="text-xl font-semibold">ViboGit</h1>
        <ConnectionStatus />
      </header>

      {state.connection === "connected" && tabs.length > 0 && <TabBar />}

      {state.connection === "disconnected" && (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[calc(100vh-73px)]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold">Welcome to ViboGit</h2>
            <p className="text-muted-foreground max-w-md">
              Start the daemon to begin managing your Git repositories.
            </p>
            <code className="block bg-muted p-4 rounded-lg text-primary font-mono text-sm">
              pnpm daemon
            </code>
          </div>
        </div>
      )}

      {state.connection === "connecting" && (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[calc(100vh-73px)]">
          <div className="space-y-4">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-muted-foreground">Connecting to daemon...</p>
          </div>
        </div>
      )}

      {state.connection === "connected" && !state.repoPath && <WelcomeScreen />}

      {state.connection === "connected" && state.repoPath && <MainInterface />}

      {state.connection === "error" && (
        <div className="flex flex-col items-center justify-center p-8 text-center min-h-[calc(100vh-73px)]">
          <div className="space-y-4">
            <h2 className="text-2xl font-semibold text-destructive">
              Connection Error
            </h2>
            <p className="text-muted-foreground max-w-md">{state.error}</p>
          </div>
        </div>
      )}
    </main>
  );
}
