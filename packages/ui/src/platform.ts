export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as Record<string, unknown>).__TAURI__;
}

export function isWeb(): boolean {
  return !isTauri();
}
