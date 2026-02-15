"use client";

import { CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

export type SaveStatus = "idle" | "saving" | "saved" | "error";

interface SaveStatusBarProps {
  status: SaveStatus;
  errorMessage?: string | null;
}

export function SaveStatusBar({ status, errorMessage }: SaveStatusBarProps) {
  if (status === "idle") {
    return <p className="text-xs text-muted-foreground">Changes save automatically.</p>;
  }

  if (status === "saving") {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>Saving...</span>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-2 text-xs text-destructive">
        <AlertCircle className="h-3.5 w-3.5" />
        <span>{errorMessage || "Save failed. Changes may only be stored locally."}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-xs text-emerald-600 dark:text-emerald-400">
      <CheckCircle2 className="h-3.5 w-3.5" />
      <span>Saved</span>
    </div>
  );
}
