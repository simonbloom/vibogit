"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Loader2 } from "lucide-react";
import type { GitCommit as GitCommitType } from "@vibogit/shared";

interface CommitHistoryProps {
  repoPath: string | null;
  limit?: number;
}

export function CommitHistory({ repoPath, limit = 50 }: CommitHistoryProps) {
  const { send } = useDaemon();
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath) {
      setCommits([]);
      return;
    }

    const loadCommits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await send<{ commits: GitCommitType[] }>("log", {
          repoPath,
          limit,
        });
        setCommits(response.commits);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load commits");
        setCommits([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadCommits();
  }, [repoPath, limit, send]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <Loader2 className="w-6 h-6 animate-spin mb-2" />
        <p className="text-sm">Loading commits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p className="text-sm">No commits yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      {commits.map((commit, index) => (
        <CommitRow
          key={commit.hash}
          commit={commit}
          isFirst={index === 0}
          isLast={index === commits.length - 1}
        />
      ))}
    </div>
  );
}

interface CommitRowProps {
  commit: GitCommitType;
  isFirst: boolean;
  isLast: boolean;
}

function CommitRow({ commit, isFirst, isLast }: CommitRowProps) {
  const formattedDate = formatCommitDate(commit.date);
  const isHead = commit.refs?.some(r => r.includes("HEAD"));

  return (
    <div className="flex items-stretch hover:bg-muted/30 transition-colors">
      {/* Graph column */}
      <div className="w-12 flex-shrink-0 flex justify-center relative">
        {/* Line above node */}
        {!isFirst && (
          <div className="absolute top-0 w-0.5 h-[calc(50%-6px)] bg-blue-400" />
        )}
        {/* Node */}
        <div className="absolute top-1/2 -translate-y-1/2 z-10">
          {isHead ? (
            <div className="w-3 h-3 rounded-full bg-blue-500 ring-2 ring-blue-200" />
          ) : (
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400" />
          )}
        </div>
        {/* Line below node */}
        {!isLast && (
          <div className="absolute bottom-0 w-0.5 h-[calc(50%-6px)] bg-blue-400" />
        )}
      </div>

      {/* Commit info */}
      <div className="flex-1 py-2 pr-4 min-w-0 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{commit.message}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono text-blue-600">{commit.hashShort}</span>
              <span>{commit.author}</span>
              <span>{formattedDate}</span>
            </div>
          </div>
          {/* Branch/tag labels */}
          {commit.refs && commit.refs.length > 0 && (
            <div className="flex gap-1 flex-shrink-0">
              {commit.refs.map((ref, i) => {
                const label = ref.includes("->") ? ref.split("->")[1]?.trim() : ref;
                const isMain = label === "main" || label === "master" || ref.includes("HEAD");
                return (
                  <span
                    key={i}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      isMain
                        ? "bg-blue-100 text-blue-700 border border-blue-200"
                        : "bg-green-100 text-green-700 border border-green-200"
                    }`}
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCommitDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
