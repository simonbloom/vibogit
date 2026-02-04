"use client";

import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { WelcomeScreen } from "@/components/welcome-screen";
import { MainInterface } from "@/components/main-interface";
import { TabBar } from "@/components/tab-bar";
import { ConnectionIndicator } from "@/components/connection-indicator";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { AppLayout } from "@/components/app-layout";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { state } = useDaemon();
  const { tabs } = useTabs();

  // Show onboarding or loading states without sidebar
  if (state.connection === "disconnected") {
    return (
      <main className="min-h-screen">
        <OnboardingScreen />
      </main>
    );
  }

  if (state.connection === "connecting") {
    return (
      <main className="min-h-screen">
        <div className="flex flex-col items-center justify-center p-12 min-h-screen">
          <Loader2 className="w-6 h-6 animate-spin mb-2" />
          <p className="text-muted-foreground">Connecting...</p>
        </div>
      </main>
    );
  }

  if (state.connection === "error") {
    return (
      <main className="min-h-screen">
        <div className="flex flex-col items-center justify-center p-12 min-h-screen">
          <p className="text-destructive font-medium">Connection Error</p>
          <p className="text-muted-foreground text-sm mt-1">{state.error}</p>
        </div>
      </main>
    );
  }

  // Connected - show app with sidebar
  return (
    <main className="h-screen overflow-hidden">
      <div className="fixed top-4 right-4 z-40">
        <ConnectionIndicator />
      </div>

      <AppLayout>
        {tabs.length > 0 && <TabBar />}
        {!state.repoPath && <WelcomeScreen />}
        {state.repoPath && <MainInterface />}
      </AppLayout>
    </main>
  );
}
