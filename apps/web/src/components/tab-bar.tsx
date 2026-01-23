"use client";

import { useTabs } from "@/lib/tabs-context";
import { useDaemon } from "@/lib/daemon-context";
import { X, Plus, FolderOpen } from "lucide-react";
import { clsx } from "clsx";

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, removeTab, addTab } = useTabs();
  const { send, setRepoPath } = useDaemon();

  const handleAddTab = async () => {
    try {
      const response = await send<{ path: string | null }>("pickFolder");
      if (response.path) {
        const isRepoResponse = await send<{ isRepo: boolean }>("isGitRepo", { path: response.path });
        if (isRepoResponse.isRepo) {
          const tab = addTab(response.path);
          setRepoPath(response.path);
        }
      }
    } catch (error) {
      console.error("Failed to add tab:", error);
    }
  };

  const handleTabClick = async (tabId: string, repoPath: string) => {
    setActiveTab(tabId);
    await setRepoPath(repoPath);
  };

  const handleCloseTab = async (e: React.MouseEvent, tabId: string) => {
    e.stopPropagation();
    removeTab(tabId);
    
    // If no tabs left, clear the repo path
    if (tabs.length <= 1) {
      await setRepoPath(null);
    }
  };

  if (tabs.length === 0) {
    return null;
  }

  return (
    <div className="flex items-center bg-surface border-b border-border overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id, tab.repoPath)}
          className={clsx(
            "group flex items-center gap-2 px-4 py-2 border-r border-border min-w-0 max-w-48 transition-colors",
            tab.id === activeTabId
              ? "bg-background text-text-primary"
              : "text-text-secondary hover:text-text-primary hover:bg-surface-light"
          )}
        >
          <FolderOpen className="w-4 h-4 flex-shrink-0 text-accent" />
          <span className="truncate text-sm">{tab.name}</span>
          <button
            onClick={(e) => handleCloseTab(e, tab.id)}
            className={clsx(
              "flex-shrink-0 p-0.5 rounded hover:bg-border transition-colors",
              tab.id === activeTabId
                ? "opacity-100"
                : "opacity-0 group-hover:opacity-100"
            )}
          >
            <X className="w-3 h-3" />
          </button>
        </button>
      ))}
      <button
        onClick={handleAddTab}
        className="flex items-center justify-center w-10 h-full p-2 text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors"
        title="Open another project"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
