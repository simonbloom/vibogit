"use client";

import { useTabs } from "@/lib/tabs-context";
import { useDaemon } from "@/lib/daemon-context";
import { Plus } from "lucide-react";
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
          addTab(response.path);
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
    if (tabs.length <= 1) {
      await setRepoPath(null);
    }
  };

  if (tabs.length === 0) return null;

  return (
    <div className="flex items-center gap-2 px-4 py-3 border-b overflow-x-auto">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => handleTabClick(tab.id, tab.repoPath)}
          onDoubleClick={(e) => handleCloseTab(e, tab.id)}
          className={clsx(
            "px-4 py-1.5 text-sm font-medium rounded-full whitespace-nowrap transition-colors",
            tab.id === activeTabId
              ? "bg-primary text-primary-foreground"
              : "border text-foreground hover:bg-muted"
          )}
        >
          {tab.name}
        </button>
      ))}
      <button
        onClick={handleAddTab}
        className="flex items-center justify-center w-8 h-8 border rounded-full text-muted-foreground hover:text-foreground hover:bg-muted"
        title="Open project"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
