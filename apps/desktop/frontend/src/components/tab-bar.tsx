"use client";

import { useTabs } from "@/lib/tabs-context";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { Plus, X } from "lucide-react";

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
      <Logo size={48} />
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant={tab.id === activeTabId ? "default" : "outline"}
          size="sm"
          onClick={() => handleTabClick(tab.id, tab.repoPath)}
          className="rounded-full whitespace-nowrap pl-2 pr-2 gap-2"
        >
          {tab.favicon && tab.faviconMimeType && (
            <img
              src={`data:${tab.faviconMimeType};base64,${tab.favicon}`}
              alt=""
              width={21}
              height={21}
              className="shrink-0"
            />
          )}
          {tab.name}
          <span
            onClick={(e) => handleCloseTab(e, tab.id)}
            className="hover:bg-foreground/20 rounded-full p-0.5"
            title="Close project"
          >
            <X className="w-3 h-3" />
          </span>
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
