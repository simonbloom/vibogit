"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";
import { useAutoUpdate } from "@/lib/use-auto-update";
import { Sidebar } from "@/components/sidebar/sidebar";
import { ProjectList } from "@/components/sidebar/project-list";
import { SettingsPanel } from "@/components/settings-panel";
import { SyncBeaconPanel } from "@/components/sync-beacon-panel";
import { UpdateBanner } from "@/components/update-banner";
import { isMacTauri } from "@/platform";
import type { AutoUpdateActions, AutoUpdateState } from "@/lib/use-auto-update";
import type { SettingsTabId } from "@/components/settings/SettingsTabs";
import { useConfig } from "@/lib/config-context";
import { useSyncBeacon } from "@/lib/sync-beacon-context";

interface AppLayoutProps {
  children: React.ReactNode;
  initialActivePane?: "project" | "settings" | "beacon";
  autoUpdateOverride?: AutoUpdateState & AutoUpdateActions;
  settingsInitialTab?: SettingsTabId;
}

export function AppLayout({
  children,
  initialActivePane = "project",
  autoUpdateOverride,
  settingsInitialTab,
}: AppLayoutProps) {
  const { state: daemonState, setRepoPath, send } = useDaemon();
  const { state: projectsState, addProject } = useProjects();
  const { config } = useConfig();
  const { remoteMachines, isRefreshing, lastRefreshedAt, error, refreshBeacon } = useSyncBeacon();
  const [activePane, setActivePane] = useState<"project" | "settings" | "beacon">(initialActivePane);
  const [isMacOverlayChrome, setIsMacOverlayChrome] = useState(false);
  const autoUpdateState = useAutoUpdate();
  const autoUpdate = autoUpdateOverride ?? autoUpdateState;

  useEffect(() => {
    setIsMacOverlayChrome(isMacTauri());
  }, []);

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
    setActivePane("project");
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
      setActivePane("project");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add project";
      toast.error(message);
    }
  };

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        onAddRepository={() => void handleAddRepository()}
        onOpenSettings={() => setActivePane("settings")}
        onOpenBeacon={() => setActivePane("beacon")}
        isSettingsActive={activePane === "settings"}
        isBeaconActive={activePane === "beacon"}
        isBeaconEnabled={config.syncBeaconEnabled}
        isMacOverlayChrome={isMacOverlayChrome}
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
          {activePane === "settings" ? (
            <SettingsPanel updateState={autoUpdate} initialTab={settingsInitialTab} />
          ) : activePane === "beacon" ? (
            <SyncBeaconPanel
              machines={remoteMachines}
              isEnabled={config.syncBeaconEnabled}
              isLoading={isRefreshing}
              error={error}
              lastRefreshedAt={lastRefreshedAt}
              onRefresh={refreshBeacon}
              onOpenSettings={() => setActivePane("settings")}
            />
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
}
