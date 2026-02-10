"use client";

const PIN_KEY_PREFIX = "vibogit-pins-";

function getKey(repoPath: string): string {
  return `${PIN_KEY_PREFIX}${repoPath}`;
}

export function getPinnedPaths(repoPath: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(getKey(repoPath));
    if (stored) return JSON.parse(stored);
  } catch {
    // Ignore parse/storage errors
  }
  return [];
}

export function setPinnedPaths(repoPath: string, paths: string[]): void {
  try {
    localStorage.setItem(getKey(repoPath), JSON.stringify(paths));
  } catch {
    // Ignore storage errors
  }
}

export function isPinned(repoPath: string, filePath: string): boolean {
  return getPinnedPaths(repoPath).includes(filePath);
}

export function togglePin(repoPath: string, filePath: string): string[] {
  const current = getPinnedPaths(repoPath);
  const index = current.indexOf(filePath);
  if (index >= 0) {
    current.splice(index, 1);
  } else {
    current.push(filePath);
  }
  setPinnedPaths(repoPath, current);
  return current;
}
