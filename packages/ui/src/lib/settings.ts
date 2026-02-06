"use client";

export type TerminalOption = "Terminal" | "iTerm" | "Ghostty" | "Warp" | "kitty";

export interface TerminalConfig {
  id: TerminalOption;
  displayName: string;
  appName: string;
}

export const TERMINAL_OPTIONS: TerminalConfig[] = [
  { id: "Terminal", displayName: "Terminal.app", appName: "Terminal" },
  { id: "iTerm", displayName: "iTerm2", appName: "iTerm" },
  { id: "Ghostty", displayName: "Ghostty", appName: "Ghostty" },
  { id: "Warp", displayName: "Warp", appName: "Warp" },
  { id: "kitty", displayName: "Kitty", appName: "kitty" },
];

export type EditorOption = "cursor" | "antigravity" | "code" | "zed" | "custom";

export interface EditorConfig {
  id: EditorOption;
  displayName: string;
  command: string | null;
  appName?: string; // macOS app name for `open -a`
}

export const EDITOR_OPTIONS: EditorConfig[] = [
  { id: "cursor", displayName: "Cursor", command: "cursor", appName: "Cursor" },
  { id: "antigravity", displayName: "Antigravity", command: "antigravity", appName: "Antigravity" },
  { id: "code", displayName: "VS Code", command: "code", appName: "Visual Studio Code" },
  { id: "zed", displayName: "Zed", command: "zed", appName: "Zed" },
  { id: "custom", displayName: "Custom...", command: null },
];

export interface Settings {
  aiProvider: "anthropic" | "openai" | "gemini";
  aiApiKey: string;
  editor: EditorOption;
  customEditorCommand?: string;
  terminal: TerminalOption;
  theme: "dark" | "light";
  imageBasePath: string;
  showHiddenFiles: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  aiProvider: "anthropic",
  aiApiKey: "",
  editor: "cursor",
  terminal: "Terminal",
  theme: "dark",
  imageBasePath: "",
  showHiddenFiles: false,
};

const SETTINGS_KEY = "vibogit-settings";

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      
      // Migrate legacy string editor values to new EditorOption type
      if (parsed.editor && !EDITOR_OPTIONS.some((e) => e.id === parsed.editor)) {
        const knownEditor = EDITOR_OPTIONS.find((e) => e.command === parsed.editor);
        if (knownEditor) {
          parsed.editor = knownEditor.id;
        } else {
          parsed.customEditorCommand = parsed.editor;
          parsed.editor = "custom";
        }
      }
      
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: Partial<Settings>): Settings {
  const current = getSettings();
  const updated = { ...current, ...settings };

  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }

  return updated;
}

export function clearSettings(): void {
  try {
    localStorage.removeItem(SETTINGS_KEY);
  } catch {
    // Ignore storage errors
  }
}
