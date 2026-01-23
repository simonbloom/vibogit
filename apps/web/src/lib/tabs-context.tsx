"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Tab } from "@vibogit/shared";

const STORAGE_KEY = "vibogit-projects";
const MAX_TABS = 20;

interface StoredData {
  tabs: Tab[];
  activeTabId: string | null;
}

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

function loadFromStorage(): StoredData {
  if (typeof window === "undefined") {
    return { tabs: [], activeTabId: null };
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const data = JSON.parse(stored) as StoredData;
      return {
        tabs: data.tabs?.slice(0, MAX_TABS) || [],
        activeTabId: data.activeTabId || null,
      };
    }
  } catch (e) {
    console.error("Failed to load tabs from localStorage:", e);
  }
  return { tabs: [], activeTabId: null };
}

function saveToStorage(data: StoredData): void {
  if (typeof window === "undefined") return;
  try {
    const toSave: StoredData = {
      tabs: data.tabs.slice(0, MAX_TABS),
      activeTabId: data.activeTabId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Failed to save tabs to localStorage:", e);
  }
}

export function TabsProvider({ children }: { children: ReactNode }) {
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const stored = loadFromStorage();
    setTabs(stored.tabs);
    setActiveTabId(stored.activeTabId);
    setIsLoaded(true);
  }, []);

  // Save to localStorage whenever tabs or activeTabId changes
  useEffect(() => {
    if (isLoaded) {
      saveToStorage({ tabs, activeTabId });
    }
  }, [tabs, activeTabId, isLoaded]);

  const addTab = useCallback((repoPath: string): Tab => {
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

    setTabs((prev) => {
      const updated = [...prev, newTab];
      // Enforce max tabs (FIFO eviction)
      if (updated.length > MAX_TABS) {
        return updated.slice(-MAX_TABS);
      }
      return updated;
    });
    setActiveTabId(newTab.id);
    return newTab;
  }, [tabs]);

  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      
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
