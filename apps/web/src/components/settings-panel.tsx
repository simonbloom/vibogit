"use client";

import { useState, useEffect } from "react";
import { getSettings, saveSettings, type Settings, TERMINAL_OPTIONS, EDITOR_OPTIONS } from "@/lib/settings";
import { AI_PROVIDERS } from "@/lib/ai-service";
import { PathSelector } from "@/components/path-selector";
import { X, Eye, EyeOff, ExternalLink } from "lucide-react";
import { clsx } from "clsx";

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
      <div className="bg-white border border-neutral-200 rounded-xl w-full max-w-lg shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-lg font-semibold text-text-primary">Settings</h2>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-6 overflow-y-auto flex-1">
          {/* AI Provider */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              AI Provider
            </label>
            <select
              value={settings.aiProvider}
              onChange={(e) => handleSave({ aiProvider: e.target.value as Settings["aiProvider"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
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
              <label className="block text-sm font-medium text-text-secondary">
                API Key
              </label>
              {selectedProvider && (
                <a
                  href={selectedProvider.keyHelpUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent hover:underline flex items-center gap-1"
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
                className="w-full px-3 py-2 pr-10 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
              >
                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-text-muted">
              Keys are stored locally in your browser
            </p>
          </div>

          {/* Editor */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Editor
            </label>
            <select
              value={settings.editor}
              onChange={(e) => handleSave({ editor: e.target.value as Settings["editor"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
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
              <label className="block text-sm font-medium text-text-secondary mb-2">
                Custom Editor Command
              </label>
              <input
                type="text"
                value={settings.customEditorCommand || ""}
                onChange={(e) => handleSave({ customEditorCommand: e.target.value })}
                placeholder="/path/to/editor or command"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent font-mono text-sm"
              />
              <p className="mt-1 text-xs text-text-muted">
                Enter the CLI command to launch your editor
              </p>
            </div>
          )}

          {/* Terminal */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Terminal App
            </label>
            <select
              value={settings.terminal}
              onChange={(e) => handleSave({ terminal: e.target.value as Settings["terminal"] })}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary focus:outline-none focus:border-accent"
            >
              {TERMINAL_OPTIONS.map((terminal) => (
                <option key={terminal.id} value={terminal.id}>
                  {terminal.displayName}
                </option>
              ))}
            </select>
          </div>

          {/* Image Base Path */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-3">
              Screenshot Folder Path
            </label>
            <PathSelector
              value={settings.imageBasePath}
              onChange={(path) => handleSave({ imageBasePath: path })}
            />
          </div>
        </div>

        <div className="p-4 border-t border-border">
          <button
            onClick={onClose}
            className={clsx(
              "w-full py-2 rounded-lg font-medium transition-colors",
              "bg-accent text-background hover:bg-accent/90"
            )}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
