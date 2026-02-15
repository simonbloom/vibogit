"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";
import { useAutoUpdate } from "@/lib/use-auto-update";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ProjectList } from "@/components/sidebar/project-list";
import { AddRepositoryDialog } from "@/components/sidebar/add-repository-dialog";
import { SettingsPanel } from "@/components/settings-panel";
import { UpdateBanner } from "@/components/update-banner";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { state: daemonState, setRepoPath } = useDaemon();
  const { state: projectsState, addProject } = useProjects();
  const [showAddRepo, setShowAddRepo] = useState(false);
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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onAddRepository={() => setShowAddRepo(true)}
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

      <AddRepositoryDialog 
        isOpen={showAddRepo} 
        onClose={() => setShowAddRepo(false)} 
      />
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)}
        updateState={autoUpdate}
      />
    </div>
  );
}
