"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";
import { useAutoUpdate } from "@/lib/use-auto-update";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ProjectList } from "@/components/sidebar/project-list";
import { SettingsPanel } from "@/components/settings-panel";
import { UpdateBanner } from "@/components/update-banner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { state: daemonState, setRepoPath, send } = useDaemon();
  const { state: projectsState, addProject } = useProjects();
  const [showSettings, setShowSettings] = useState(false);
  const autoUpdate = useAutoUpdate();

  // Sync selected project with DaemonContext
  useEffect(() => {
    if (projectsState.selectedPath) {
      setRepoPath(projectsState.selectedPath);
    }
  }, [projectsState.selectedPath, setRepoPath]);

  // Reverse sync: when daemon has a repoPath not in sidebar, add it
  useEffect(() => {
    const repoPath = daemonState.repoPath;
    if (!repoPath) return;
    const alreadyInList = projectsState.projects.some(p => p.path === repoPath);
    if (!alreadyInList && !projectsState.loading) {
      addProject(repoPath);
    }
  }, [daemonState.repoPath, projectsState.projects, projectsState.loading, addProject]);

  const handleProjectSelect = (path: string) => {
    setRepoPath(path);
  };

  const handleAddRepository = async () => {
    let selectedPath: string | null = null;

    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      if (typeof open === "function") {
        const result = await open({ directory: true, multiple: false, title: "Select a Project Folder" });
        if (typeof result === "string") {
          selectedPath = result;
        }
      }
    } catch {
      // Fall back to backend picker
    }

    if (!selectedPath) {
      try {
        const response = await send<{ path: string | null }>("pickFolder");
        selectedPath = response.path;
      } catch (err) {
        console.error("Failed to open folder picker:", err);
      }
    }

    if (!selectedPath) return;

    try {
      await addProject(selectedPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add project";
      toast.error(message);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onAddRepository={() => void handleAddRepository()}
        onOpenSettings={() => setShowSettings(true)}
      >
        {(isCollapsed) => (
          <ProjectList 
            isCollapsed={isCollapsed} 
            onProjectSelect={handleProjectSelect}
          />
        )}
      </Sidebar>
      
      <div className="flex-1 overflow-hidden flex flex-col">
        <UpdateBanner {...autoUpdate} />
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>

      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        updateState={autoUpdate}
      />
    </div>
  );
}
