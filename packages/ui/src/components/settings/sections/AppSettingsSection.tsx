"use client";

import { Button } from "@/components/ui/button";
import type { Config } from "@vibogit/shared";
import type { AutoUpdateActions, AutoUpdateState } from "@/lib/use-auto-update";
import { Loader2, Monitor, RefreshCw } from "lucide-react";

interface AppSettingsSectionProps {
  config: Config;
  isDaemonConnected: boolean;
  appVersion: string | null;
  updateState?: AutoUpdateState & AutoUpdateActions;
}

export function AppSettingsSection({
  config,
  isDaemonConnected,
  appVersion,
  updateState,
}: AppSettingsSectionProps) {
  const updateLabel = updateState
    ? {
        idle: "Up to date",
        checking: "Checking...",
        "update-available": updateState.version ? `v${updateState.version} available` : "Update available",
        downloading: `Downloading... ${updateState.progress}%`,
        ready: "Restart to apply",
        error: updateState.error || "Update failed",
      }[updateState.status]
    : null;

  return (
    <section className="space-y-5">
      {isDaemonConnected && config.computerName && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Computer</label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
            <Monitor className="h-4 w-4 text-muted-foreground" />
            <span className="text-foreground">{config.computerName}</span>
            <span className="ml-auto text-xs text-muted-foreground">(auto-detected)</span>
          </div>
        </div>
      )}

      {appVersion && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Updates</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-3 py-2">
              <span className="text-sm text-foreground">
                Current version: <span className="font-mono font-medium">{appVersion}</span>
              </span>
              {updateLabel && <span className="ml-auto text-xs text-muted-foreground">{updateLabel}</span>}
            </div>

            {updateState && (
              <div className="flex flex-wrap gap-2">
                {updateState.status === "update-available" && (
                  <Button size="sm" onClick={() => void updateState.startUpdate()}>
                    Update Now
                  </Button>
                )}
                {updateState.status === "ready" && (
                  <Button size="sm" onClick={() => void updateState.restartApp()}>
                    Restart Now
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void updateState.checkForUpdate()}
                  disabled={updateState.status === "checking" || updateState.status === "downloading"}
                >
                  {updateState.status === "checking" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Check for Updates
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
