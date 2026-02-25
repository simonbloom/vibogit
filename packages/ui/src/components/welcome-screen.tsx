"use client";

import { useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { useRecentProjects } from "@/lib/use-recent-projects";
import { Button } from "@/components/ui/button";
import { FolderOpen, Loader2 } from "lucide-react";
import type { RecentProject } from "@vibogit/shared";

export function WelcomeScreen() {
  const { projects: recentProjects, addRecentProject } = useRecentProjects();
  const { state, send, setRepoPath } = useDaemon();
  const { addTab } = useTabs();
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenProject = useCallback(async () => {
    if (state.connection !== "connected") return;
    setIsLoading(true);
    try {
      const response = await send<{ path: string | null }>("pickFolder");
      if (response.path) {
        await checkAndOpenPath(response.path);
      }
    } catch (error) {
      console.error("Failed to pick folder:", error);
    } finally {
      setIsLoading(false);
    }
  }, [state.connection, send]);

  const checkAndOpenPath = async (path: string) => {
    try {
      addTab(path);
      addRecentProject(path, path.split("/").pop() || path);
      await setRepoPath(path);
    } catch (error) {
      console.error("Failed to open path:", error);
    }
  };

  const handleRecentProjectClick = async (project: RecentProject) => {
    await checkAndOpenPath(project.path);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] p-8">
      <h1 className="text-2xl font-bold mb-1">ViboGit</h1>
      <p className="text-muted-foreground mb-6">Git for the Vibe Coder</p>

      <Button
        size="lg"
        onClick={handleOpenProject}
        disabled={isLoading || state.connection !== "connected"}
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
        Open Project
      </Button>

      {recentProjects.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Recent</h3>
          <div className="border rounded-lg divide-y">
            {recentProjects.map((project) => (
              <Button
                key={project.path}
                variant="ghost"
                onClick={() => handleRecentProjectClick(project)}
                className="w-full justify-start gap-3 rounded-none first:rounded-t-lg last:rounded-b-lg"
              >
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{project.name}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
