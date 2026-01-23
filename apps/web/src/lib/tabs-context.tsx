"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { Tab } from "@vibogit/shared";

interface TabsContextValue {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (repoPath: string) => Tab;
  removeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
  getActiveTab: () => Tab | undefined;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function generateTabId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function getProjectName(path: string): string {
  return path.split("/").pop() || path;
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const addTab = useCallback((repoPath: string): Tab => {
    // Check if tab already exists for this repo
    const existingTab = tabs.find((t) => t.repoPath === repoPath);
    if (existingTab) {
      setActiveTabId(existingTab.id);
      return existingTab;
    }

    const newTab: Tab = {
      id: generateTabId(),
      repoPath,
      name: getProjectName(repoPath),
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newTab.id);
    return newTab;
  }, [tabs]);

  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      
      // If we're removing the active tab, switch to another one
      if (activeTabId === tabId && newTabs.length > 0) {
        const index = prev.findIndex((t) => t.id === tabId);
        const newIndex = Math.max(0, index - 1);
        setActiveTabId(newTabs[newIndex]?.id || null);
      } else if (newTabs.length === 0) {
        setActiveTabId(null);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabId(tabId);
  }, []);

  const getActiveTab = useCallback(() => {
    return tabs.find((t) => t.id === activeTabId);
  }, [tabs, activeTabId]);

  return (
    <TabsContext.Provider
      value={{
        tabs,
        activeTabId,
        addTab,
        removeTab,
        setActiveTab,
        getActiveTab,
      }}
    >
      {children}
    </TabsContext.Provider>
  );
}

export function useTabs() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error("useTabs must be used within a TabsProvider");
  }
  return context;
}
