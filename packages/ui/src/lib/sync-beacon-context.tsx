"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { useConfig } from "@/lib/config-context";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";
import { TabsContext } from "@/lib/tabs-context";

export interface SyncBeaconRepo {
  path: string;
  name: string;
  branch: string;
  ahead: number;
  behind: number;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitTimestamp: number;
  remoteUrl?: string;
}

export interface SyncBeaconMachine {
  machineName: string;
  timestamp: number;
  repos: SyncBeaconRepo[];
}

interface SyncBeaconData {
  machines: SyncBeaconMachine[];
}

export interface BeaconMatchedStatus {
  machineName: string;
  branch: string;
  ahead: number;
  behind: number;
  timestamp: number;
}

interface SyncBeaconContextValue {
  remoteMachines: SyncBeaconMachine[];
  isRefreshing: boolean;
  lastRefreshedAt: number | null;
  error: string | null;
  refreshBeacon: () => Promise<void>;
  pushBeacon: () => Promise<void>;
  getMatchedStatus: (repoName: string) => BeaconMatchedStatus[];
}

export const SyncBeaconContext = createContext<SyncBeaconContextValue | null>(null);

type RepoStatusWithCommitMetadata = {
  currentBranch?: string;
  ahead?: number;
  behind?: number;
  lastCommitHash?: string;
  lastCommitMessage?: string;
  lastCommitTimestamp?: number;
};

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function SyncBeaconProvider({ children }: { children: ReactNode }) {
  const { config, setConfig } = useConfig();
  const { state, send, getConfigPath, getHostname } = useDaemon();
  const { state: projectsState } = useProjects();
  const tabsContext = useContext(TabsContext);
  const [remoteMachines, setRemoteMachines] = useState<SyncBeaconMachine[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastToastErrorRef = useRef<string | null>(null);
  const lastPushedStateRef = useRef<string | null>(null);

  const beaconRepos = useMemo<SyncBeaconRepo[]>(() => {
    const activeTab = tabsContext?.getActiveTab();
    if (!activeTab) return [];
    const project = projectsState.projects.find((p) => p.path === activeTab.repoPath);
    if (!project) return [];
    const status = (projectsState.statuses[project.path] as RepoStatusWithCommitMetadata | undefined) ?? {};
    return [{
      path: project.path,
      name: project.name,
      branch: status.currentBranch || "unknown",
      ahead: status.ahead || 0,
      behind: status.behind || 0,
      lastCommitHash: status.lastCommitHash || "",
      lastCommitMessage: status.lastCommitMessage || "",
      lastCommitTimestamp: status.lastCommitTimestamp || 0,
    }];
  }, [tabsContext, projectsState.projects, projectsState.statuses]);

  const localMachineName = useMemo(() => {
    const configured = config.syncBeaconMachineName.trim();
    return configured || config.computerName.trim();
  }, [config.computerName, config.syncBeaconMachineName]);

  const applyBeaconData = useCallback(
    (data: SyncBeaconData, hostnameFallback: string) => {
      const currentMachine = (localMachineName || hostnameFallback).trim();
      setRemoteMachines(
        (data.machines || []).filter((machine) => machine.machineName.trim() && machine.machineName !== currentMachine)
      );
      setLastRefreshedAt(Date.now());
      setError(null);
      lastToastErrorRef.current = null;
    },
    [localMachineName]
  );

  const refreshBeacon = useCallback(async () => {
    if (!config.syncBeaconEnabled || !config.syncBeaconPairingCode.trim()) {
      setRemoteMachines([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const hostnameFallback = await getHostname();
      const data = await send<SyncBeaconData>("sync_beacon_pull", { pairingCode: config.syncBeaconPairingCode.trim() });
      applyBeaconData(data, hostnameFallback);
    } catch (err) {
      const message = getErrorMessage(err, "Unable to refresh Sync Beacon");
      setError(message);
      if (lastToastErrorRef.current !== message) {
        toast.error(message);
        lastToastErrorRef.current = message;
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [applyBeaconData, config.syncBeaconEnabled, config.syncBeaconPairingCode, getHostname, send]);

  const pushBeacon = useCallback(async () => {
    if (!config.syncBeaconEnabled) return;

    const stateKey = JSON.stringify(beaconRepos.map((r) => `${r.path}:${r.branch}:${r.ahead}:${r.behind}:${r.lastCommitHash}`));
    if (lastPushedStateRef.current === stateKey) return;

    try {
      const configPath = await getConfigPath();
      const hostnameFallback = await getHostname();
      const result = await send<{ data: SyncBeaconData; pairingCode: string }>("sync_beacon_push", {
        configPath,
        repos: beaconRepos,
        machineName: localMachineName || hostnameFallback,
        pairingCode: config.syncBeaconPairingCode.trim() || undefined,
      });

      lastPushedStateRef.current = stateKey;

      if (!config.syncBeaconMachineName.trim()) {
        void setConfig({ syncBeaconMachineName: hostnameFallback });
      }

      if (result.pairingCode && result.pairingCode !== config.syncBeaconPairingCode.trim()) {
        void setConfig({ syncBeaconPairingCode: result.pairingCode });
      }

      applyBeaconData(result.data, hostnameFallback);
    } catch (err) {
      const message = getErrorMessage(err, "Unable to update Sync Beacon");
      setError(message);
      if (lastToastErrorRef.current !== message) {
        toast.error(message);
        lastToastErrorRef.current = message;
      }
    }
  }, [applyBeaconData, beaconRepos, config, getConfigPath, getHostname, localMachineName, send, setConfig]);

  const getMatchedStatus = useCallback((repoName: string): BeaconMatchedStatus[] => {
    if (!repoName) return [];
    const matches: BeaconMatchedStatus[] = [];
    for (const machine of remoteMachines) {
      const repo = machine.repos.find((r) => r.name === repoName);
      if (repo) {
        matches.push({
          machineName: machine.machineName,
          branch: repo.branch,
          ahead: repo.ahead,
          behind: repo.behind,
          timestamp: machine.timestamp,
        });
      }
    }
    return matches;
  }, [remoteMachines]);

  const pushBeaconRef = useRef(pushBeacon);
  pushBeaconRef.current = pushBeacon;
  const refreshBeaconRef = useRef(refreshBeacon);
  refreshBeaconRef.current = refreshBeacon;
  const lastPushAtRef = useRef(0);
  const MIN_PUSH_INTERVAL_MS = 60_000;

  const throttledPush = useCallback(async () => {
    const now = Date.now();
    if (now - lastPushAtRef.current < MIN_PUSH_INTERVAL_MS) return;
    lastPushAtRef.current = now;
    await pushBeaconRef.current();
  }, []);

  useEffect(() => {
    if (!config.syncBeaconMachineName.trim()) {
      void getHostname().then((hostname) => {
        if (!config.syncBeaconMachineName.trim()) {
          void setConfig({ syncBeaconMachineName: hostname });
        }
      });
    }
  }, [config.syncBeaconMachineName, getHostname, setConfig]);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!config.syncBeaconEnabled || state.connection !== "connected") {
      if (!config.syncBeaconEnabled) {
        setRemoteMachines([]);
        setError(null);
      }
      return;
    }

    void throttledPush();
    void refreshBeaconRef.current();
    intervalRef.current = setInterval(() => {
      void throttledPush();
    }, 300_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [config.syncBeaconEnabled, state.connection, throttledPush]);

  useEffect(() => {
    if (!config.syncBeaconEnabled) return;

    const handleFocus = () => {
      void refreshBeaconRef.current();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [config.syncBeaconEnabled]);

  return (
    <SyncBeaconContext.Provider
      value={{
        remoteMachines,
        isRefreshing,
        lastRefreshedAt,
        error,
        refreshBeacon,
        pushBeacon,
        getMatchedStatus,
      }}
    >
      {children}
    </SyncBeaconContext.Provider>
  );
}

export function useSyncBeacon() {
  const context = useContext(SyncBeaconContext);
  if (!context) {
    throw new Error("useSyncBeacon must be used within a SyncBeaconProvider");
  }
  return context;
}
