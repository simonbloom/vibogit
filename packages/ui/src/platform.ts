export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}
