"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
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
  isSaving: boolean;
  lastSaveError: string | null;
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
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaveError, setLastSaveError] = useState<string | null>(null);
  const saveRequestIdRef = useRef(0);

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
        setLastSaveError(null);
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
      setConfigState((current) => {
        const next = { ...current, ...partial };
        saveLocalConfig(next);
        return next;
      });

      const requestId = ++saveRequestIdRef.current;
      setIsSaving(true);
      setLastSaveError(null);

      if (state.connection === "connected") {
        try {
          const response = await send<{ config: Config }>("setConfig", {
            config: partial,
          });
          setConfigState(response.config);
          saveLocalConfig(response.config);
          if (saveRequestIdRef.current === requestId) {
            setLastSaveError(null);
          }
        } catch (err) {
          console.error("[Config] Failed to save to daemon:", err);
          if (saveRequestIdRef.current === requestId) {
            const message = err instanceof Error ? err.message : "Failed to save settings to daemon";
            setLastSaveError(message);
          }
        }
      }

      if (saveRequestIdRef.current === requestId) {
        setIsSaving(false);
      }
    },
    [state.connection, send]
  );

  return (
    <ConfigContext.Provider value={{ config, setConfig, isLoading, isSaving, lastSaveError }}>
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
