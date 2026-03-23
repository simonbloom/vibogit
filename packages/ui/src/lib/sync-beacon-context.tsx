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
import type { GitCommit } from "@vibogit/shared";
import { useConfig } from "@/lib/config-context";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";

export interface SyncBeaconRepo {
  path: string;
  name: string;
  branch: string;
  ahead: number;
  behind: number;
  lastCommitHash: string;
  lastCommitMessage: string;
  lastCommitTimestamp: number;
}

export interface SyncBeaconMachine {
  machineName: string;
  timestamp: number;
  repos: SyncBeaconRepo[];
}

interface SyncBeaconData {
  machines: SyncBeaconMachine[];
}

interface SyncBeaconContextValue {
  remoteMachines: SyncBeaconMachine[];
  isRefreshing: boolean;
  lastRefreshedAt: number | null;
  error: string | null;
  refreshBeacon: () => Promise<void>;
  pushBeacon: () => Promise<void>;
}

const SyncBeaconContext = createContext<SyncBeaconContextValue | null>(null);

type RepoCommitMetadata = Pick<SyncBeaconRepo, "lastCommitHash" | "lastCommitMessage" | "lastCommitTimestamp">;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return fallback;
}

export function SyncBeaconProvider({ children }: { children: ReactNode }) {
  const { config, setConfig } = useConfig();
  const { state, send, getConfigPath, getHostname } = useDaemon();
  const { state: projectsState } = useProjects();
  const [remoteMachines, setRemoteMachines] = useState<SyncBeaconMachine[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastToastErrorRef = useRef<string | null>(null);
  const repoCommitMetadataRef = useRef<Record<string, RepoCommitMetadata>>({});

  const loadRepoCommitMetadata = useCallback(
    async (projectPath: string): Promise<RepoCommitMetadata> => {
      try {
        const response = await send<{ commits: GitCommit[] }>("log", { repoPath: projectPath, limit: 1 });
        const commit = response.commits?.[0];
        if (!commit) {
          return {
            lastCommitHash: "",
            lastCommitMessage: "",
            lastCommitTimestamp: 0,
          };
        }

        const timestampMs = Date.parse(commit.date);
        return {
          lastCommitHash: commit.hash || "",
          lastCommitMessage: commit.message || "",
          lastCommitTimestamp: Number.isNaN(timestampMs) ? 0 : Math.floor(timestampMs / 1000),
        };
      } catch {
        return {
          lastCommitHash: "",
          lastCommitMessage: "",
          lastCommitTimestamp: 0,
        };
      }
    },
    [send]
  );

  useEffect(() => {
    let cancelled = false;

    const missingPaths = projectsState.projects
      .map((project) => project.path)
      .filter((projectPath) => !(projectPath in repoCommitMetadataRef.current));

    if (missingPaths.length === 0) {
      const validPaths = new Set(projectsState.projects.map((project) => project.path));
      repoCommitMetadataRef.current = Object.fromEntries(
        Object.entries(repoCommitMetadataRef.current).filter(([projectPath]) => validPaths.has(projectPath))
      );
      return;
    }

    void Promise.all(
      missingPaths.map(async (projectPath) => [projectPath, await loadRepoCommitMetadata(projectPath)] as const)
    ).then((entries) => {
      if (cancelled) return;

      const validPaths = new Set(projectsState.projects.map((project) => project.path));
      repoCommitMetadataRef.current = {
        ...Object.fromEntries(
          Object.entries(repoCommitMetadataRef.current).filter(([projectPath]) => validPaths.has(projectPath))
        ),
        ...Object.fromEntries(entries),
      };
    });

    return () => {
      cancelled = true;
    };
  }, [loadRepoCommitMetadata, projectsState.projects]);

  const beaconRepos = useMemo<SyncBeaconRepo[]>(() => {
    return projectsState.projects.map((project) => {
      const projectStatus = projectsState.statuses[project.path];
      const commitMetadata = repoCommitMetadataRef.current[project.path] ?? {
        lastCommitHash: "",
        lastCommitMessage: "",
        lastCommitTimestamp: 0,
      };
      return {
        path: project.path,
        name: project.name,
        branch: projectStatus?.currentBranch || "unknown",
        ahead: projectStatus?.ahead || 0,
        behind: projectStatus?.behind || 0,
        lastCommitHash: commitMetadata.lastCommitHash,
        lastCommitMessage: commitMetadata.lastCommitMessage,
        lastCommitTimestamp: commitMetadata.lastCommitTimestamp,
      };
    });
  }, [projectsState.projects, projectsState.statuses]);

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
    if (!config.syncBeaconEnabled || !config.syncBeaconGistId.trim()) {
      setRemoteMachines([]);
      return;
    }

    setIsRefreshing(true);
    try {
      const hostnameFallback = await getHostname();
      const data = await send<SyncBeaconData>("sync_beacon_pull", { gistId: config.syncBeaconGistId.trim() });
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
  }, [applyBeaconData, config.syncBeaconEnabled, config.syncBeaconGistId, getHostname, send]);

  const pushBeacon = useCallback(async () => {
    if (!config.syncBeaconEnabled) return;

    try {
      const configPath = await getConfigPath();
      const hostnameFallback = await getHostname();
      const data = await send<SyncBeaconData>("sync_beacon_push", {
        configPath,
        repos: beaconRepos,
        machineName: localMachineName || hostnameFallback,
      });

      if (!config.syncBeaconMachineName.trim()) {
        void setConfig({ syncBeaconMachineName: hostnameFallback });
      }

      const persistedGistId = config.syncBeaconGistId.trim();
      if (!persistedGistId) {
        try {
          const response = await send<{ config: typeof config }>("getConfig");
          const gistId = response.config.syncBeaconGistId?.trim();
          if (gistId && gistId !== persistedGistId) {
            await setConfig({ syncBeaconGistId: gistId });
          }
        } catch {
          // Ignore gist ID refresh failure.
        }
      }

      applyBeaconData(data, hostnameFallback);
    } catch (err) {
      const message = getErrorMessage(err, "Unable to update Sync Beacon");
      setError(message);
      if (lastToastErrorRef.current !== message) {
        toast.error(message);
        lastToastErrorRef.current = message;
      }
    }
  }, [applyBeaconData, beaconRepos, config, getConfigPath, getHostname, send, setConfig]);

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

    void pushBeacon();
    void refreshBeacon();
    intervalRef.current = setInterval(() => {
      void pushBeacon();
    }, config.syncBeaconInterval || 300_000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [config.syncBeaconEnabled, config.syncBeaconInterval, pushBeacon, refreshBeacon, state.connection]);

  useEffect(() => {
    if (!config.syncBeaconEnabled) return;

    const handleFocus = () => {
      void refreshBeacon();
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [config.syncBeaconEnabled, refreshBeacon]);

  return (
    <SyncBeaconContext.Provider
      value={{
        remoteMachines,
        isRefreshing,
        lastRefreshedAt,
        error,
        refreshBeacon,
        pushBeacon,
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
