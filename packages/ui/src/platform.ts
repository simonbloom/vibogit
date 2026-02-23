export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return !!(window as unknown as { __TAURI__?: unknown }).__TAURI__;
}

export function isMacTauri(): boolean {
  if (typeof window === "undefined") return false;
  return isTauri() && navigator.userAgent.includes("Mac");
}
