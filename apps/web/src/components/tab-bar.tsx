"use client";

import { useTabs } from "@/lib/tabs-context";
import { useDaemon } from "@/lib/daemon-context";
import { X, Plus, Folder } from "lucide-react";
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
    <div className="flex items-center border-b bg-muted/30 overflow-x-auto">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="button"
          tabIndex={0}
          onClick={() => handleTabClick(tab.id, tab.repoPath)}
          onKeyDown={(e) => e.key === "Enter" && handleTabClick(tab.id, tab.repoPath)}
          className={clsx(
            "group flex items-center gap-2 px-3 py-1.5 text-sm border-r cursor-pointer",
            tab.id === activeTabId ? "bg-background" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
          )}
        >
          <Folder className="w-3.5 h-3.5" />
          <span className="truncate max-w-32">{tab.name}</span>
          <button
            onClick={(e) => handleCloseTab(e, tab.id)}
            className={clsx("p-0.5 rounded hover:bg-muted", tab.id === activeTabId ? "opacity-100" : "opacity-0 group-hover:opacity-100")}
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
      <button onClick={handleAddTab} className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50" title="Open project">
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}
