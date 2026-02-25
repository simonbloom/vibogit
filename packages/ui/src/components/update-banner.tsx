"use client";

import { ArrowUpCircle, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutoUpdateState, AutoUpdateActions } from "@/lib/use-auto-update";

type UpdateBannerProps = AutoUpdateState & AutoUpdateActions;

export function UpdateBanner({
  status,
  version,
  progress,
  error,
  startUpdate,
  restartApp,
  dismiss,
}: UpdateBannerProps) {
  if (status !== "update-available" && status !== "downloading" && status !== "ready") {
    return null;
  }

  return (
    <div className="mx-4 mt-2 flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-2.5 text-sm shadow-sm">
      {status === "update-available" && (
        <>
          <ArrowUpCircle className="h-4 w-4 shrink-0 text-primary" />
          <span className="flex-1 text-foreground">
            ViboGit <span className="font-medium">v{version}</span> is available
          </span>
          <Button size="sm" onClick={startUpdate}>
            Update Now
          </Button>
          <Button size="sm" variant="ghost" onClick={dismiss}>
            Later
          </Button>
        </>
      )}

      {status === "downloading" && (
        <>
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
          <span className="shrink-0 text-foreground">Downloading update...</span>
          <div className="flex-1">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
          <span className="shrink-0 text-xs text-muted-foreground">{progress}%</span>
        </>
      )}

      {status === "ready" && (
        <>
          <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
          <span className="flex-1 text-foreground">{error || "Update ready! Restart to apply."}</span>
          <Button size="sm" onClick={restartApp}>
            Restart Now
          </Button>
        </>
      )}
    </div>
  );
}
