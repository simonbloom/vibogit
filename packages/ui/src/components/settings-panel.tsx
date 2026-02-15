"use client";

import { useState, useEffect } from "react";
import { TERMINAL_OPTIONS, EDITOR_OPTIONS } from "@/lib/settings";
import { useConfig } from "@/lib/config-context";
import { useDaemon } from "@/lib/daemon-context";
import { AI_PROVIDERS } from "@/lib/ai-service";
import { PathSelector } from "@/components/path-selector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { Button } from "@/components/ui/button";
import { X, Eye, EyeOff, ExternalLink, Monitor, RefreshCw, Loader2 } from "lucide-react";
import type { Config } from "@vibogit/shared";
import type { AutoUpdateState, AutoUpdateActions } from "@/lib/use-auto-update";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  updateState?: AutoUpdateState & AutoUpdateActions;
}

export function SettingsPanel({ isOpen, onClose, updateState }: SettingsPanelProps) {
  const { config, setConfig, isLoading } = useConfig();
  const { state } = useDaemon();
  const [showApiKey, setShowApiKey] = useState(false);
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

  const handleSave = (updates: Partial<Config>) => {
    setConfig(updates);
  };

  if (!isOpen) return null;

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === config.aiProvider);
  const isDaemonConnected = state.connection === "connected";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-card border border-border rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-foreground">Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* Computer Name */}
          {isDaemonConnected && config.computerName && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Computer
              </label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg">
                <Monitor className="w-4 h-4 text-muted-foreground" />
                <span className="text-foreground">{config.computerName}</span>
                <span className="text-xs text-muted-foreground ml-auto">(auto-detected)</span>
              </div>
            </div>
          )}

          {/* AI Provider */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              AI Provider
            </label>
            <select
              value={config.aiProvider}
              onChange={(e) => handleSave({ aiProvider: e.target.value as Config["aiProvider"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {AI_PROVIDERS.map((provider) => (
                <option key={provider.id} value={provider.id}>
                  {provider.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* API Key */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-foreground">
                API Key
              </label>
              {selectedProvider && (
                <a
                  href={selectedProvider.keyHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1"
                >
                  Get key <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <div className="relative">
              <input
                type={showApiKey ? "text" : "password"}
                value={config.aiApiKey}
                onChange={(e) => handleSave({ aiApiKey: e.target.value })}
                placeholder={selectedProvider?.keyPlaceholder || "Enter API key"}
                className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {isDaemonConnected ? "Stored in ~/.vibogit/config.json" : "Stored locally in your browser"}
            </p>
          </div>

          {/* Editor */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Editor
            </label>
            <select
              value={config.editor}
              onChange={(e) => handleSave({ editor: e.target.value as Config["editor"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {EDITOR_OPTIONS.map((editor) => (
                <option key={editor.id} value={editor.id}>
                  {editor.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Editor Command (only shown when "custom" is selected) */}
          {config.editor === "custom" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Custom Editor Command
              </label>
              <input
                type="text"
                value={config.customEditorCommand || ""}
                onChange={(e) => handleSave({ customEditorCommand: e.target.value })}
                placeholder="/path/to/editor or command"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Enter the CLI command to launch your editor
              </p>
            </div>
          )}

          {/* Terminal */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Terminal App
            </label>
            <select
              value={config.terminal}
              onChange={(e) => handleSave({ terminal: e.target.value as Config["terminal"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TERMINAL_OPTIONS.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {terminal.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Auto Execute Prompt */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">
                Press Enter after paste
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={config.autoExecutePrompt}
                onClick={() => handleSave({ autoExecutePrompt: !config.autoExecutePrompt })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.autoExecutePrompt ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.autoExecutePrompt ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              When enabled, automatically presses Enter after pasting the prompt into the terminal.
            </p>
          </div>

          {/* Theme */}
          <ThemeToggle />

          {/* Image Base Path */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Screenshot Folder Path
            </label>
            <PathSelector
              value={config.imageBasePath}
              onChange={(path) => handleSave({ imageBasePath: path })}
            />
          </div>

          {/* CleanShot Mode */}
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-sm font-medium text-foreground">
                CleanShot Mode
              </label>
              <button
                type="button"
                role="switch"
                aria-checked={config.cleanShotMode}
                onClick={() => handleSave({ cleanShotMode: !config.cleanShotMode })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  config.cleanShotMode ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    config.cleanShotMode ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              When enabled, pasted images are matched to files already saved by CleanShot instead of creating duplicates.
            </p>
          </div>

          {/* Updates */}
          {appVersion && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Updates
              </label>
              <div className="space-y-2">
                <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg">
                  <span className="text-foreground text-sm">
                    Current version: <span className="font-mono font-medium">{appVersion}</span>
                  </span>
                  {updateState && (
                    <span className="ml-auto text-xs text-muted-foreground">
                      {updateState.status === "idle" && "Up to date"}
                      {updateState.status === "checking" && "Checking..."}
                      {updateState.status === "update-available" && `v${updateState.version} available`}
                      {updateState.status === "downloading" && `Downloading... ${updateState.progress}%`}
                      {updateState.status === "ready" && "Restart to apply"}
                      {updateState.status === "error" && updateState.error}
                    </span>
                  )}
                </div>
                {updateState && (
                  <div className="flex gap-2">
                    {updateState.status === "update-available" && (
                      <Button size="sm" onClick={updateState.startUpdate}>
                        Update Now
                      </Button>
                    )}
                    {updateState.status === "ready" && (
                      <Button size="sm" onClick={updateState.restartApp}>
                        Restart Now
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={updateState.checkForUpdate}
                      disabled={updateState.status === "checking" || updateState.status === "downloading"}
                    >
                      {updateState.status === "checking" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                      Check for Updates
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border">
          <Button onClick={onClose} className="w-full">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
