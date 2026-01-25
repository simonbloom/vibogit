"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import type { Tab, ConfigTab } from "@vibogit/shared";
import { useConfig } from "./config-context";
import { useDaemon } from "./daemon-context";

const MAX_TABS = 20;

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
  const { config, setConfig, isLoading: configLoading } = useConfig();
  const { state } = useDaemon();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const isInitialSync = useRef(true);
  const lastSyncedTabs = useRef<string>("");

  // Load from config when daemon connects
  useEffect(() => {
    if (configLoading) return;
    
    if (state.connection === "connected" && isInitialSync.current) {
      const configTabs = config.recentTabs || [];
      setTabs(configTabs as Tab[]);
      setActiveTabIdState(config.activeTabId);
      lastSyncedTabs.current = JSON.stringify({ tabs: configTabs, activeTabId: config.activeTabId });
      isInitialSync.current = false;
      setIsLoaded(true);
    } else if (state.connection !== "connected" && isInitialSync.current) {
      // Fallback: load from config's cached localStorage data
      const configTabs = config.recentTabs || [];
      setTabs(configTabs as Tab[]);
      setActiveTabIdState(config.activeTabId);
      isInitialSync.current = false;
      setIsLoaded(true);
    }
  }, [state.connection, config.recentTabs, config.activeTabId, configLoading]);

  // Save to config when tabs change (debounced)
  useEffect(() => {
    if (!isLoaded || isInitialSync.current) return;
    
    const currentState = JSON.stringify({ tabs, activeTabId });
    if (currentState === lastSyncedTabs.current) return;
    
    lastSyncedTabs.current = currentState;
    const configTabs: ConfigTab[] = tabs.map(t => ({ id: t.id, repoPath: t.repoPath, name: t.name }));
    setConfig({ recentTabs: configTabs, activeTabId });
  }, [tabs, activeTabId, isLoaded, setConfig]);

  const addTab = useCallback((repoPath: string): Tab => {
    const existingTab = tabs.find((t) => t.repoPath === repoPath);
    if (existingTab) {
      setActiveTabIdState(existingTab.id);
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
    setActiveTabIdState(newTab.id);
    return newTab;
  }, [tabs]);

  const removeTab = useCallback((tabId: string) => {
    setTabs((prev) => {
      const newTabs = prev.filter((t) => t.id !== tabId);
      
      if (activeTabId === tabId && newTabs.length > 0) {
        const index = prev.findIndex((t) => t.id === tabId);
        const newIndex = Math.max(0, index - 1);
        setActiveTabIdState(newTabs[newIndex]?.id || null);
      } else if (newTabs.length === 0) {
        setActiveTabIdState(null);
      }
      
      return newTabs;
    });
  }, [activeTabId]);

  const setActiveTab = useCallback((tabId: string) => {
    setActiveTabIdState(tabId);
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
