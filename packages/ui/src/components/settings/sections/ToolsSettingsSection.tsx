"use client";

import { TERMINAL_OPTIONS, EDITOR_OPTIONS } from "@/lib/settings";
import type { Config } from "@vibogit/shared";

interface ToolsSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function ToolsSettingsSection({ config, onSave }: ToolsSettingsSectionProps) {
  return (
    <section className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Editor</label>
        <select
          value={config.editor}
          onChange={(event) => onSave({ editor: event.target.value as Config["editor"] })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {EDITOR_OPTIONS.map((editor) => (
            <option key={editor.id} value={editor.id}>
              {editor.displayName}
            </option>
          ))}
        </select>
      </div>

      {config.editor === "custom" && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Custom Editor Command</label>
          <input
            type="text"
            value={config.customEditorCommand || ""}
            onChange={(event) => onSave({ customEditorCommand: event.target.value })}
            placeholder="/path/to/editor or command"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="mt-1 text-xs text-muted-foreground">Enter the CLI command used to launch your editor.</p>
        </div>
      )}

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Terminal App</label>
        <select
          value={config.terminal}
          onChange={(event) => onSave({ terminal: event.target.value as Config["terminal"] })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {TERMINAL_OPTIONS.map((terminal) => (
            <option key={terminal.id} value={terminal.id}>
              {terminal.displayName}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">GitHub Personal Access Token</label>
        <input
          type="password"
          value={config.githubPat || ""}
          onChange={(event) => onSave({ githubPat: event.target.value })}
          placeholder="github_pat_..."
          className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="mt-1 text-xs text-muted-foreground">
          Used to list your repositories for clone-to-root. Needs repo read access.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-4">
          <div>
            <label className="block text-sm font-medium text-foreground">Press Enter after paste</label>
            <p className="mt-1 text-xs text-muted-foreground">
              Automatically sends Enter after pasting into your terminal.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={config.autoExecutePrompt}
            onClick={() => onSave({ autoExecutePrompt: !config.autoExecutePrompt })}
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
      </div>
    </section>
  );
}
