export const MINI_PROJECT_CHANGED = "mini:project-changed";
export const MINI_COMMIT_COMPLETE = "mini:commit-complete";
export const MAIN_PROJECT_CHANGED = "main:project-changed";
export const MAIN_STATUS_REFRESHED = "main:status-refreshed";

export interface ProjectChangedPayload {
  path: string;
}

export interface CommitCompletePayload {
  repoPath: string;
}

let tauriEmit: ((event: string, payload?: unknown) => Promise<void>) | null = null;
let emitInitialized = false;

async function ensureEmit(): Promise<boolean> {
  if (emitInitialized) return tauriEmit !== null;
  emitInitialized = true;
  try {
    if (typeof window === "undefined" || !("__TAURI__" in window)) return false;
    const { emit } = await import("@tauri-apps/api/event");
    tauriEmit = emit;
    return true;
  } catch {
    return false;
  }
}

export async function emitCrossWindow(eventName: string, payload?: unknown): Promise<void> {
  const ready = await ensureEmit();
  if (!ready || !tauriEmit) return;
  await tauriEmit(eventName, payload);
}
