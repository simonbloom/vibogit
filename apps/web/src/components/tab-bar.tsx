"use client";

import { useTabs } from "@/lib/tabs-context";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

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
        <Button
          key={tab.id}
          variant={tab.id === activeTabId ? "default" : "outline"}
          size="sm"
          onClick={() => handleTabClick(tab.id, tab.repoPath)}
          onDoubleClick={(e) => handleCloseTab(e, tab.id)}
          className="rounded-full whitespace-nowrap"
        >
          {tab.name}
        </Button>
      ))}
      <Button
        variant="outline"
        size="icon"
        onClick={handleAddTab}
        className="rounded-full"
        title="Open project"
      >
        <Plus className="w-4 h-4" />
      </Button>
    </div>
  );
}
