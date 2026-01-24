"use client";

import { useState, useEffect } from "react";
import { getSettings, saveSettings, type Settings, TERMINAL_OPTIONS, EDITOR_OPTIONS } from "@/lib/settings";
import { AI_PROVIDERS } from "@/lib/ai-service";
import { PathSelector } from "@/components/path-selector";
import { ThemeToggle } from "@/components/settings/ThemeToggle";
import { Button } from "@/components/ui/button";
import { X, Eye, EyeOff, ExternalLink } from "lucide-react";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [showApiKey, setShowApiKey] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings(getSettings());
    }
  }, [isOpen]);

  const handleSave = (updates: Partial<Settings>) => {
    const updated = saveSettings(updates);
    setSettings(updated);
  };

  if (!isOpen) return null;

  const selectedProvider = AI_PROVIDERS.find((p) => p.id === settings.aiProvider);

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
          {/* AI Provider */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              AI Provider
            </label>
            <select
              value={settings.aiProvider}
              onChange={(e) => handleSave({ aiProvider: e.target.value as Settings["aiProvider"] })}
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
                value={settings.aiApiKey}
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
              Keys are stored locally in your browser
            </p>
          </div>

          {/* Editor */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Editor
            </label>
            <select
              value={settings.editor}
              onChange={(e) => handleSave({ editor: e.target.value as Settings["editor"] })}
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
          {settings.editor === "custom" && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">
                Custom Editor Command
              </label>
              <input
                type="text"
                value={settings.customEditorCommand || ""}
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
              value={settings.terminal}
              onChange={(e) => handleSave({ terminal: e.target.value as Settings["terminal"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {TERMINAL_OPTIONS.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {terminal.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Theme */}
          <ThemeToggle />

          {/* Image Base Path */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-3">
              Screenshot Folder Path
            </label>
            <PathSelector
              value={settings.imageBasePath}
              onChange={(path) => handleSave({ imageBasePath: path })}
            />
          </div>
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
