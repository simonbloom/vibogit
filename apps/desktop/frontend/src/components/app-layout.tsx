"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ProjectList } from "@/components/sidebar/project-list";
import { AddRepositoryDialog } from "@/components/sidebar/add-repository-dialog";
import { SettingsPanel } from "@/components/settings-panel";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { setRepoPath } = useDaemon();
  const { state: projectsState } = useProjects();
  const [showAddRepo, setShowAddRepo] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vibogit-sidebar-collapsed") === "true";
    }
    return false;
  });

  // Sync selected project with DaemonContext
  useEffect(() => {
    if (projectsState.selectedPath) {
      setRepoPath(projectsState.selectedPath);
    }
  }, [projectsState.selectedPath, setRepoPath]);

  const handleProjectSelect = (path: string) => {
    setRepoPath(path);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onAddRepository={() => setShowAddRepo(true)}
        onOpenSettings={() => setShowSettings(true)}
      >
        <ProjectList 
          isCollapsed={isCollapsed} 
          onProjectSelect={handleProjectSelect}
        />
      </Sidebar>
      
      <div className="flex-1 overflow-hidden">
        {children}
      </div>

      <AddRepositoryDialog 
        isOpen={showAddRepo} 
        onClose={() => setShowAddRepo(false)} 
      />
      <SettingsPanel 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
      />
    </div>
  );
}
