"use client";

import { useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { useTabs } from "@/lib/tabs-context";
import { FolderOpen, Loader2 } from "lucide-react";
import { clsx } from "clsx";
import type { RecentProject } from "@vibogit/shared";

interface WelcomeScreenProps {
  recentProjects?: RecentProject[];
}

export function WelcomeScreen({ recentProjects = [] }: WelcomeScreenProps) {
  const { state, send, setRepoPath } = useDaemon();
  const { addTab } = useTabs();
  const [isLoading, setIsLoading] = useState(false);
  const [checkingPath, setCheckingPath] = useState<string | null>(null);
  const [showInitDialog, setShowInitDialog] = useState(false);
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

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
    setCheckingPath(path);
    try {
      const isRepoResponse = await send<{ isRepo: boolean }>("isGitRepo", { path });
      if (isRepoResponse.isRepo) {
        addTab(path);
        await setRepoPath(path);
      } else {
        setPendingPath(path);
        setShowInitDialog(true);
      }
    } catch (error) {
      console.error("Failed to check path:", error);
    } finally {
      setCheckingPath(null);
    }
  };

  const handleInitGit = async () => {
    if (!pendingPath) return;

    setIsLoading(true);
    try {
      await send("initGit", { path: pendingPath });
      addTab(pendingPath);
      await setRepoPath(pendingPath);
    } catch (error) {
      console.error("Failed to init git:", error);
    } finally {
      setIsLoading(false);
      setShowInitDialog(false);
      setPendingPath(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const items = e.dataTransfer.items;
    if (items.length > 0) {
      const item = items[0];
      if (item.kind === "file") {
        const entry = item.webkitGetAsEntry?.();
        if (entry?.isDirectory) {
          // Note: Web API doesn't give us the full path for security reasons
          // The daemon will need to handle this differently
          console.log("Folder dropped:", entry.name);
        }
      }
    }
  };

  const handleRecentProjectClick = async (project: RecentProject) => {
    await checkAndOpenPath(project.path);
  };

  const getProjectName = (path: string) => {
    return path.split("/").pop() || path;
  };

  if (checkingPath) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] p-8">
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
        <p className="text-text-secondary">Checking folder...</p>
        <p className="text-text-muted text-sm mt-2 font-mono">{checkingPath}</p>
      </div>
    );
  }

  if (showInitDialog && pendingPath) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-73px)] p-8">
        <div className="bg-surface rounded-xl p-8 max-w-md w-full border border-border">
          <div className="text-center mb-6">
            <FolderOpen className="w-12 h-12 text-accent mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-text-primary mb-2">
              {getProjectName(pendingPath)}
            </h2>
            <p className="text-text-secondary">
              This folder isn&apos;t a git project yet.
            </p>
          </div>

          <div className="bg-surface-light rounded-lg p-4 mb-6">
            <h3 className="font-medium text-text-primary mb-2">Initialize Git</h3>
            <p className="text-text-secondary text-sm">
              This will track your changes so you can save and ship your work.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowInitDialog(false);
                setPendingPath(null);
              }}
              className="flex-1 px-4 py-2 bg-surface-light text-text-secondary rounded-lg hover:bg-border transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleInitGit}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-accent text-background font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin mx-auto" />
              ) : (
                "Set it up"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center min-h-[calc(100vh-73px)] p-8 transition-colors",
        isDragging && "bg-accent/5"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-text-primary mb-2">
          Welcome to ViboGit
        </h1>
        <p className="text-text-secondary">Git for the Vibe Coder</p>
      </div>

      <button
        onClick={handleOpenProject}
        disabled={isLoading || state.connection !== "connected"}
        className={clsx(
          "flex items-center gap-3 px-8 py-4 bg-accent text-background font-medium rounded-xl",
          "hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
          "shadow-lg shadow-accent/20 hover:shadow-xl hover:shadow-accent/30"
        )}
      >
        {isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <FolderOpen className="w-5 h-5" />
        )}
        <span>Open a Project</span>
      </button>

      <p className="text-text-muted text-sm mt-4">
        Or drag a folder here
      </p>

      {recentProjects.length > 0 && (
        <div className="mt-12 w-full max-w-md">
          <h3 className="text-sm font-medium text-text-secondary mb-3 uppercase tracking-wider">
            Recent Projects
          </h3>
          <div className="bg-surface rounded-xl border border-border overflow-hidden">
            {recentProjects.map((project, index) => (
              <button
                key={project.path}
                onClick={() => handleRecentProjectClick(project)}
                className={clsx(
                  "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-light transition-colors",
                  index !== recentProjects.length - 1 && "border-b border-border"
                )}
              >
                <FolderOpen className="w-4 h-4 text-accent flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary font-medium truncate">
                    {project.name}
                  </p>
                  <p className="text-text-muted text-xs truncate">
                    {project.path}
                  </p>
                </div>
                <span className="text-text-muted text-xs flex-shrink-0">
                  {formatRelativeTime(project.lastOpenedAt)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
