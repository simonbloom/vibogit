"use client";

import { useEffect } from "react";
import { useDaemon } from "@vibogit/ui/lib/daemon-context";
import { useProjects } from "@vibogit/ui/lib/projects-context";
import { MiniView } from "@vibogit/ui/components/mini-view";
import { Loader2 } from "lucide-react";

export default function MiniPage() {
  const { state, setRepoPath } = useDaemon();
  const { state: projectsState } = useProjects();

  // Sync selected project to daemon on mount
  useEffect(() => {
    if (state.connection === "connected" && projectsState.selectedPath && !state.repoPath) {
      setRepoPath(projectsState.selectedPath);
    }
  }, [state.connection, state.repoPath, projectsState.selectedPath, setRepoPath]);

  if (state.connection === "connecting") {
    return (
      <div className="h-12 w-full flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state.connection === "error" || state.connection === "disconnected") {
    return (
      <div className="h-12 w-full flex items-center justify-center text-xs text-muted-foreground">
        Not connected
      </div>
    );
  }

  return <MiniView />;
}
