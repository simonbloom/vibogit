"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useConfig } from "./config-context";
import { useDaemon } from "./daemon-context";

export function useThemeSync() {
  const { theme, setTheme } = useTheme();
  const { config, setConfig } = useConfig();
  const { state } = useDaemon();
  const isInitialSync = useRef(true);
  const lastSyncedTheme = useRef<string | null>(null);

  // Sync theme from config when daemon connects
  useEffect(() => {
    if (state.connection === "connected" && config.theme && isInitialSync.current) {
      if (config.theme !== theme) {
        setTheme(config.theme);
      }
      lastSyncedTheme.current = config.theme;
      isInitialSync.current = false;
    }
  }, [state.connection, config.theme, theme, setTheme]);

  // Save theme to config when it changes locally
  useEffect(() => {
    if (!theme || isInitialSync.current) return;
    if (theme === lastSyncedTheme.current) return;

    lastSyncedTheme.current = theme;
    setConfig({ theme: theme as "light" | "dark" | "ember" | "matrix" | "system" });
  }, [theme, setConfig]);
}
