"use client";

import { PathSelector } from "@/components/path-selector";
import type { Config } from "@vibogit/shared";

interface CaptureSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function CaptureSettingsSection({ config, onSave }: CaptureSettingsSectionProps) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="space-y-5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Capture</h3>
          <p className="mt-1 text-sm text-muted-foreground">Configure where image references are resolved from when sending prompts.</p>
        </div>

        <div>
          <label className="mb-3 block text-sm font-medium text-foreground">Screenshot Folder Path</label>
          <PathSelector value={config.imageBasePath} onChange={(path) => onSave({ imageBasePath: path })} />
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground">CleanShot Mode</label>
              <p className="mt-1 text-xs text-muted-foreground">
                Match pasted images to files already saved by CleanShot instead of creating duplicates.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={config.cleanShotMode}
              onClick={() => onSave({ cleanShotMode: !config.cleanShotMode })}
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
        </div>
      </div>
    </section>
  );
}
