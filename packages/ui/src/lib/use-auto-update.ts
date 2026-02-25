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
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const checkForUpdate = useCallback(async (silent = false) => {
    const currentStatus = stateRef.current.status;
    if (currentStatus === "downloading" || currentStatus === "ready") {
      return;
    }

    try {
      if (!silent) {
        setState((s) => ({ ...s, status: "checking", error: null }));
      }

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
          error: null,
        }));
      } else {
        if (!silent) {
          setState((s) => ({ ...s, status: "idle", error: null }));
        }
      }
    } catch (err) {
      if (silent) {
        setState((s) => s);
      } else {
        setState((s) => ({
          ...s,
          status: "error",
          error: err instanceof Error ? err.message : "Update check failed",
        }));
      }
    }
  }, []);

  const relaunchApp = useCallback(async (): Promise<boolean> => {
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
      return true;
    } catch {
      return false;
    }
  }, []);

  const startUpdate = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    let installFinished = false;

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
            setState((s) => ({ ...s, status: "downloading", progress: Math.min(pct, 100) }));
            break;
          case "Finished":
            installFinished = true;
            setState((s) => ({ ...s, status: "ready", progress: 100 }));
            break;
        }
      });

      setState((s) => ({ ...s, status: "ready", progress: 100 }));
      const relaunched = await relaunchApp();
      if (!relaunched) {
        setState((s) => ({
          ...s,
          status: "ready",
          progress: 100,
          error: "Update installed. Restart ViboGit to apply it.",
        }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Update download failed";
      if (installFinished) {
        setState((s) => ({
          ...s,
          status: "ready",
          progress: 100,
          error: `Update installed. Restart ViboGit to apply it. (${message})`,
        }));
        return;
      }
      setState((s) => ({
        ...s,
        status: "error",
        error: message,
      }));
    }
  }, [relaunchApp]);

  const restartApp = useCallback(async () => {
    const relaunched = await relaunchApp();
    if (!relaunched) {
      setState((s) => ({
        ...s,
        status: "ready",
        error: "Could not restart automatically. Please quit and reopen ViboGit.",
      }));
    }
  }, [relaunchApp]);

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
