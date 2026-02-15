"use client";

import { useState, useEffect } from "react";
import { useConfig } from "@/lib/config-context";
import { useDaemon } from "@/lib/daemon-context";
import { SettingsTabs, type SettingsTabId } from "@/components/settings/SettingsTabs";
import { SaveStatusBar, type SaveStatus } from "@/components/settings/SaveStatusBar";
import { AISettingsSection } from "@/components/settings/sections/AISettingsSection";
import { ToolsSettingsSection } from "@/components/settings/sections/ToolsSettingsSection";
import { AppearanceSettingsSection } from "@/components/settings/sections/AppearanceSettingsSection";
import { CaptureSettingsSection } from "@/components/settings/sections/CaptureSettingsSection";
import { AppSettingsSection } from "@/components/settings/sections/AppSettingsSection";
import type { Config } from "@vibogit/shared";
import type { AutoUpdateState, AutoUpdateActions } from "@/lib/use-auto-update";

interface SettingsPanelProps {
  updateState?: AutoUpdateState & AutoUpdateActions;
}

const SETTINGS_TAB_STORAGE_KEY = "vibogit-settings-active-tab";

const SETTINGS_TAB_VALUES: SettingsTabId[] = ["ai", "tools", "appearance", "capture", "app"];

function getInitialTab(): SettingsTabId {
  if (typeof window === "undefined") return "ai";
  const stored = localStorage.getItem(SETTINGS_TAB_STORAGE_KEY);
  if (stored && SETTINGS_TAB_VALUES.includes(stored as SettingsTabId)) {
    return stored as SettingsTabId;
  }
  return "ai";
}

export function SettingsPanel({ updateState }: SettingsPanelProps) {
  const { config, setConfig, isLoading, isSaving, lastSaveError } = useConfig();
  const { state } = useDaemon();
  const [activeTab, setActiveTab] = useState<SettingsTabId>(getInitialTab);
  const [hasSaved, setHasSaved] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [appVersion, setAppVersion] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { getVersion } = await import("@tauri-apps/api/app");
        setAppVersion(await getVersion());
      } catch {
        // not in Tauri environment
      }
    })();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(SETTINGS_TAB_STORAGE_KEY, activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (!hasSaved) return;

    if (isSaving) {
      setSaveStatus("saving");
      return;
    }

    if (lastSaveError) {
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saved");
    const timeout = window.setTimeout(() => {
      setSaveStatus("idle");
    }, 1600);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [hasSaved, isSaving, lastSaveError]);

  const handleSave = (updates: Partial<Config>) => {
    setHasSaved(true);
    void setConfig(updates);
  };
  const isDaemonConnected = state.connection === "connected";

  const renderTabPanel = () => {
    switch (activeTab) {
      case "ai":
        return <AISettingsSection config={config} isDaemonConnected={isDaemonConnected} onSave={handleSave} />;
      case "tools":
        return <ToolsSettingsSection config={config} onSave={handleSave} />;
      case "appearance":
        return <AppearanceSettingsSection />;
      case "capture":
        return <CaptureSettingsSection config={config} onSave={handleSave} />;
      case "app":
        return (
          <AppSettingsSection
            config={config}
            isDaemonConnected={isDaemonConnected}
            appVersion={appVersion}
            updateState={updateState}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-6 py-4">
        <h2 className="text-lg font-semibold text-foreground">Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Preferences for ViboGit on this machine.</p>
      </div>

      <SettingsTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div
          role="tabpanel"
          id={`settings-panel-${activeTab}`}
          aria-labelledby={`settings-tab-${activeTab}`}
          className="w-full"
        >
          {isLoading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-10 w-full rounded bg-muted" />
              <div className="h-10 w-full rounded bg-muted" />
              <div className="h-20 w-full rounded bg-muted" />
            </div>
          ) : (
            renderTabPanel()
          )}
        </div>
      </div>

      <div className="border-t border-border px-6 py-3">
        <SaveStatusBar status={saveStatus} errorMessage={lastSaveError} />
      </div>
    </div>
  );
}
