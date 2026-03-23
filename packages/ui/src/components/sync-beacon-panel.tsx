"use client";

import { useMemo } from "react";
import { AlertTriangle, Clock3, GitBranch, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

interface SyncBeaconPanelProps {
  machines: SyncBeaconMachine[];
  isEnabled: boolean;
  isLoading: boolean;
  error: string | null;
  lastRefreshedAt: number | null;
  onRefresh: () => Promise<void>;
  onOpenSettings: () => void;
}

function formatAbsoluteTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

function formatRelativeTime(timestamp: number): string {
  const deltaSeconds = Math.max(0, Math.round((Date.now() - timestamp * 1000) / 1000));
  if (deltaSeconds < 60) return "just now";
  if (deltaSeconds < 3600) {
    const minutes = Math.floor(deltaSeconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (deltaSeconds < 86400) {
    const hours = Math.floor(deltaSeconds / 3600);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(deltaSeconds / 86400);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function SyncBeaconPanel({
  machines,
  isEnabled,
  isLoading,
  error,
  lastRefreshedAt,
  onRefresh,
  onOpenSettings,
}: SyncBeaconPanelProps) {
  const sortedMachines = useMemo(
    () => [...machines].sort((left, right) => right.timestamp - left.timestamp),
    [machines]
  );

  if (!isEnabled) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-lg rounded-xl border border-border bg-card p-6 text-center">
          <h2 className="text-lg font-semibold text-foreground">Sync Beacon is off</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Enable Sync Beacon in Settings to create or join a shared Gist and monitor repo status on your other machines.
          </p>
          <Button className="mt-4" onClick={onOpenSettings}>
            Open Settings
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Sync Beacon</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Remote repo status from your shared Sync Beacon Gist.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {lastRefreshedAt ? (
              <span className="text-xs text-muted-foreground">Last refreshed {formatRelativeTime(lastRefreshedAt)}</span>
            ) : null}
            <Button variant="outline" size="sm" onClick={() => void onRefresh()} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5">
        {error ? (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {sortedMachines.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 px-6 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No remote machines yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Share your Gist ID with another machine, then refresh here to see its repo status.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {sortedMachines.map((machine) => (
              <section key={`${machine.machineName}-${machine.timestamp}`} className="rounded-xl border border-border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                  <div>
                    <h3 className="text-base font-semibold text-foreground">{machine.machineName}</h3>
                    <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground" title={formatAbsoluteTime(machine.timestamp)}>
                      <Clock3 className="h-3.5 w-3.5" />
                      Last updated {formatRelativeTime(machine.timestamp)}
                    </p>
                  </div>
                  <Badge variant="secondary">{machine.repos.length} repo{machine.repos.length === 1 ? "" : "s"}</Badge>
                </div>

                <div className="divide-y divide-border">
                  {machine.repos.map((repo) => (
                    <div key={`${machine.machineName}-${repo.path}`} className="space-y-3 px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground" title={repo.path}>
                            {repo.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground" title={repo.path}>
                            {repo.path}
                          </p>
                        </div>
                        {repo.ahead > 0 ? (
                          <Badge variant="destructive" className="shrink-0">
                            {repo.ahead} commit{repo.ahead === 1 ? "" : "s"} ahead
                          </Badge>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1">
                          <GitBranch className="h-3.5 w-3.5" />
                          {repo.branch || "detached HEAD"}
                        </span>
                        <span className="rounded-full border border-border px-2 py-1">Ahead {repo.ahead}</span>
                        <span className="rounded-full border border-border px-2 py-1">Behind {repo.behind}</span>
                      </div>

                      <div className="rounded-lg bg-muted/30 px-3 py-2 text-sm">
                        <p className="font-medium text-foreground">{repo.lastCommitMessage || "No commits yet"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {repo.lastCommitHash ? repo.lastCommitHash.slice(0, 7) : "No hash"}
                          {repo.lastCommitTimestamp ? ` · ${formatRelativeTime(repo.lastCommitTimestamp)}` : ""}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
