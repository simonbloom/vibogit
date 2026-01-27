"use client";

import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { WelcomeScreen } from "@/components/welcome-screen";
import { MainInterface } from "@/components/main-interface";
import { TabBar } from "@/components/tab-bar";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { state } = useDaemon();
  const { tabs } = useTabs();

  return (
    <main className="min-h-screen">
      <div className="fixed top-4 right-4 z-40">
        <ConnectionIndicator />
      </div>

      {state.connection === "connected" && tabs.length > 0 && <TabBar />}

      {state.connection === "disconnected" && <OnboardingScreen />}

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
