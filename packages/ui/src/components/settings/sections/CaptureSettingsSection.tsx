"use client";

import { PathSelector } from "@/components/path-selector";
import type { Config } from "@vibogit/shared";

interface CaptureSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function CaptureSettingsSection({ config, onSave }: CaptureSettingsSectionProps) {
  return (
    <section className="space-y-5">
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
    </section>
  );
}
