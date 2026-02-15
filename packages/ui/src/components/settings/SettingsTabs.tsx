"use client";

import { useMemo, useRef, type KeyboardEvent } from "react";
import { Brain, Wrench, Palette, Camera, AppWindow } from "lucide-react";
import { cn } from "@/lib/utils";

export type SettingsTabId = "ai" | "tools" | "appearance" | "capture" | "app";

interface SettingsTab {
  id: SettingsTabId;
  label: string;
  Icon: typeof Brain;
}

const SETTINGS_TABS: SettingsTab[] = [
  { id: "ai", label: "AI", Icon: Brain },
  { id: "tools", label: "Tools", Icon: Wrench },
  { id: "appearance", label: "Appearance", Icon: Palette },
  { id: "capture", label: "Capture", Icon: Camera },
  { id: "app", label: "App", Icon: AppWindow },
];

interface SettingsTabsProps {
  activeTab: SettingsTabId;
  onTabChange: (tab: SettingsTabId) => void;
  className?: string;
}

export function SettingsTabs({ activeTab, onTabChange, className }: SettingsTabsProps) {
  const tabRefs = useRef<Record<SettingsTabId, HTMLButtonElement | null>>({
    ai: null,
    tools: null,
    appearance: null,
    capture: null,
    app: null,
  });

  const tabOrder = useMemo(() => SETTINGS_TABS.map((tab) => tab.id), []);

  const focusTab = (tabId: SettingsTabId) => {
    tabRefs.current[tabId]?.focus();
    onTabChange(tabId);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: SettingsTabId) => {
    const currentIndex = tabOrder.indexOf(currentTab);
    if (currentIndex === -1) return;

    if (event.key === "ArrowRight") {
      event.preventDefault();
      const nextIndex = (currentIndex + 1) % tabOrder.length;
      focusTab(tabOrder[nextIndex]);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      const prevIndex = (currentIndex - 1 + tabOrder.length) % tabOrder.length;
      focusTab(tabOrder[prevIndex]);
      return;
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusTab(tabOrder[0]);
      return;
    }

    if (event.key === "End") {
      event.preventDefault();
      focusTab(tabOrder[tabOrder.length - 1]);
    }
  };

  return (
    <div
      role="tablist"
      aria-label="Settings sections"
      className={cn(
        "sticky top-0 z-10 border-b border-border bg-background/95 px-6 py-3 backdrop-blur",
        className
      )}
    >
      <div className="mx-auto flex w-full max-w-3xl gap-2 overflow-x-auto">
        {SETTINGS_TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          const Icon = tab.Icon;

          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              ref={(node) => {
                tabRefs.current[tab.id] = node;
              }}
              role="tab"
              aria-selected={isActive}
              aria-controls={`settings-panel-${tab.id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onTabChange(tab.id)}
              onKeyDown={(event) => onKeyDown(event, tab.id)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
