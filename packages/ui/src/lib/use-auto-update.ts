"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export type UpdateStatus =
  | "idle"
  | "checking"
  | "update-available"
  | "downloading"
  | "ready"
  | "error";

export interface AutoUpdateState {
  status: UpdateStatus;
  version: string | null;
  notes: string | null;
  progress: number;
  error: string | null;
}

export interface AutoUpdateActions {
  checkForUpdate: () => Promise<void>;
  startUpdate: () => Promise<void>;
  restartApp: () => Promise<void>;
  dismiss: () => void;
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function useAutoUpdate(): AutoUpdateState & AutoUpdateActions {
  const [state, setState] = useState<AutoUpdateState>({
    status: "idle",
    version: null,
    notes: null,
    progress: 0,
    error: null,
  });
  const [dismissed, setDismissed] = useState(false);
  const updateRef = useRef<any>(null);

  const checkForUpdate = useCallback(async (silent = false) => {
    try {
      setState((s) => ({ ...s, status: "checking", error: null }));
      const { check } = await import("@tauri-apps/plugin-updater");
      const update = await check();

      if (update) {
        updateRef.current = update;
        setDismissed(false);
        setState((s) => ({
          ...s,
          status: "update-available",
          version: update.version,
          notes: update.body ?? null,
        }));
      } else {
        setState((s) => ({ ...s, status: "idle" }));
      }
    } catch (err) {
      if (silent) {
        setState((s) => ({ ...s, status: "idle" }));
      } else {
        setState((s) => ({
          ...s,
          status: "error",
          error: err instanceof Error ? err.message : "Update check failed",
        }));
      }
    }
  }, []);

  const startUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    try {
      setState((s) => ({ ...s, status: "downloading", progress: 0 }));

      let totalBytes = 0;
      let downloadedBytes = 0;

      await update.downloadAndInstall((event: any) => {
        switch (event.event) {
          case "Started":
            totalBytes = event.data.contentLength ?? 0;
            break;
          case "Progress":
            downloadedBytes += event.data.chunkLength ?? 0;
            const pct = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
            setState((s) => ({ ...s, progress: Math.min(pct, 100) }));
            break;
          case "Finished":
            setState((s) => ({ ...s, status: "ready", progress: 100 }));
            break;
        }
      });

      setState((s) => ({ ...s, status: "ready", progress: 100 }));
    } catch (err) {
      setState((s) => ({
        ...s,
        status: "error",
        error: err instanceof Error ? err.message : "Update download failed",
      }));
    }
  }, []);

  const restartApp = useCallback(async () => {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch {
      // ignore
    }
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Auto-check on mount + interval
  useEffect(() => {
    let mounted = true;
    const doCheck = () => {
      if (mounted) checkForUpdate(true);
    };

    // Delay initial check slightly so app renders first
    const initialTimeout = setTimeout(doCheck, 3000);
    const interval = setInterval(doCheck, CHECK_INTERVAL_MS);

    return () => {
      mounted = false;
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [checkForUpdate]);

  const effectiveStatus = dismissed && state.status === "update-available" ? "idle" : state.status;

  return {
    ...state,
    status: effectiveStatus,
    checkForUpdate: () => checkForUpdate(false),
    startUpdate,
    restartApp,
    dismiss,
  };
}
