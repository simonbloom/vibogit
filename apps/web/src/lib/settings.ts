"use client";

export interface Settings {
  aiProvider: "anthropic" | "openai" | "gemini";
  aiApiKey: string;
  editor: string;
  theme: "dark" | "light";
}

const DEFAULT_SETTINGS: Settings = {
  aiProvider: "anthropic",
  aiApiKey: "",
  editor: "code",
  theme: "dark",
};

const SETTINGS_KEY = "vibogit-settings";

export function getSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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
