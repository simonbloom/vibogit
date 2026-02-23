"use client";

import { useEffect } from "react";
import { useDaemon } from "@vibogit/ui/lib/daemon-context";
import { WelcomeScreen } from "@vibogit/ui/components/welcome-screen";
import { MainInterface } from "@vibogit/ui/components/main-interface";
import { OnboardingScreen } from "@vibogit/ui/components/onboarding-screen";
import { AppLayout } from "@vibogit/ui/components/app-layout";
import { Loader2 } from "lucide-react";

export default function Home() {
  const { state, setRepoPath } = useDaemon();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (state.connection === "connected" && !state.repoPath) {
      const params = new URLSearchParams(window.location.search);
      const repo = params.get("repo");
      if (repo) {
        setRepoPath(repo);
      }
    }
  }, [state.connection, state.repoPath, setRepoPath]);

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

  return (
    <main className="h-screen overflow-hidden">
      <AppLayout>
        {!state.repoPath && <WelcomeScreen />}
        {state.repoPath && <MainInterface />}
      </AppLayout>
    </main>
  );
}
