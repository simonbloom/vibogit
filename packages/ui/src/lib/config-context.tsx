"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { useDaemon } from "./daemon-context";
import type { Config } from "@vibogit/shared";
import { DEFAULT_CONFIG } from "@vibogit/shared";

const SETTINGS_KEY = "vibogit-settings";

interface ConfigContextValue {
  config: Config;
  setConfig: (partial: Partial<Config>) => Promise<void>;
  isLoading: boolean;
}

const ConfigContext = createContext<ConfigContextValue | null>(null);

function getLocalConfig(): Config {
  if (typeof window === "undefined") return DEFAULT_CONFIG;
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
    }
  } catch {
    // Ignore
  }
  return DEFAULT_CONFIG;
}

function saveLocalConfig(config: Config): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(config));
  } catch {
    // Ignore
  }
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { state, send } = useDaemon();
  const [config, setConfigState] = useState<Config>(getLocalConfig);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch config from daemon when connected
  useEffect(() => {
    if (state.connection !== "connected") {
      setIsLoading(false);
      return;
    }

    const fetchConfig = async () => {
      try {
        const response = await send<{ config: Config }>("getConfig");
        setConfigState(response.config);
        saveLocalConfig(response.config); // Keep localStorage in sync
      } catch (err) {
        console.error("[Config] Failed to fetch from daemon:", err);
        // Fall back to localStorage
        setConfigState(getLocalConfig());
      } finally {
        setIsLoading(false);
      }
    };

    fetchConfig();
  }, [state.connection, send]);

  // Listen for configChanged broadcasts
  useEffect(() => {
    // This would require adding a listener to daemon context
    // For now, we rely on refetching when needed
  }, []);

  const setConfig = useCallback(
    async (partial: Partial<Config>) => {
      const newConfig = { ...config, ...partial };
      setConfigState(newConfig);
      saveLocalConfig(newConfig); // Always save to localStorage as backup

      if (state.connection === "connected") {
        try {
          const response = await send<{ config: Config }>("setConfig", {
            config: partial,
          });
          setConfigState(response.config);
          saveLocalConfig(response.config);
        } catch (err) {
          console.error("[Config] Failed to save to daemon:", err);
          // Already saved to localStorage, so UI state is correct
        }
      }
    },
    [config, state.connection, send]
  );

  return (
    <ConfigContext.Provider value={{ config, setConfig, isLoading }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}
