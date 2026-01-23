"use client";

import { useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { useRecentProjects } from "@/lib/use-recent-projects";
import { FolderOpen, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { RecentProject } from "@vibogit/shared";

export function WelcomeScreen() {
  const { projects: recentProjects, addRecentProject } = useRecentProjects();
  const { state, send, setRepoPath } = useDaemon();
  const { addTab } = useTabs();
  const [isLoading, setIsLoading] = useState(false);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);

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
      const isRepoResponse = await send<{ isRepo: boolean }>("isGitRepo", { path });
      if (isRepoResponse.isRepo) {
        addTab(path);
        addRecentProject(path, path.split("/").pop() || path);
        await setRepoPath(path);
      } else {
        setPendingPath(path);
        setShowInitDialog(true);
      }
    } catch (error) {
      console.error("Failed to check path:", error);
    }
  };

  const handleInitGit = async () => {
    if (!pendingPath) return;
    setIsLoading(true);
    try {
      await send("initGit", { path: pendingPath });
      addTab(pendingPath);
      addRecentProject(pendingPath, pendingPath.split("/").pop() || pendingPath);
      await setRepoPath(pendingPath);
    } catch (error) {
      console.error("Failed to init git:", error);
    } finally {
      setIsLoading(false);
      setShowInitDialog(false);
      setPendingPath(null);
    }
  };

  const handleRecentProjectClick = async (project: RecentProject) => {
    await checkAndOpenPath(project.path);
  };

  if (showInitDialog && pendingPath) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] p-8">
        <div className="border rounded-lg p-6 max-w-sm w-full">
          <h2 className="font-semibold mb-1">{pendingPath.split("/").pop()}</h2>
          <p className="text-sm text-muted-foreground mb-4">This folder isn&apos;t a git repository.</p>
          <div className="flex gap-2">
            <button onClick={() => { setShowInitDialog(false); setPendingPath(null); }} className="flex-1 px-3 py-1.5 text-sm border rounded-md hover:bg-muted">
              Cancel
            </button>
            <button onClick={handleInitGit} disabled={isLoading} className="flex-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Initialize Git"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] p-8">
      <h1 className="text-2xl font-bold mb-1">ViboGit</h1>
      <p className="text-muted-foreground mb-6">Git for the Vibe Coder</p>

      <button
        onClick={handleOpenProject}
        disabled={isLoading || state.connection !== "connected"}
        className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50"
      >
        {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FolderOpen className="w-5 h-5" />}
        Open Project
      </button>

      {recentProjects.length > 0 && (
        <div className="mt-8 w-full max-w-sm">
          <h3 className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Recent</h3>
          <div className="border rounded-lg divide-y">
            {recentProjects.map((project) => (
              <button
                key={project.path}
                onClick={() => handleRecentProjectClick(project)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-muted/50 text-sm"
              >
                <FolderOpen className="w-4 h-4 text-muted-foreground" />
                <span className="truncate">{project.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
