"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import { GitCommit, Loader2, Clock, User } from "lucide-react";
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
      <div className="flex flex-col items-center justify-center h-full text-text-muted p-8">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading timeline...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-status-deleted p-8">
        <p>{error}</p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted p-8">
        <GitCommit className="w-12 h-12 mb-4 opacity-50" />
        <p>No commits yet</p>
        <p className="text-sm mt-2">Make your first save to start the timeline</p>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-4">
        <h3 className="text-sm font-medium text-text-secondary mb-4 uppercase tracking-wider">
          Timeline
        </h3>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-3 top-0 bottom-0 w-px bg-border" />

          {/* Commits */}
          <div className="space-y-4">
            {commits.map((commit, index) => (
              <CommitItem key={commit.hash} commit={commit} isFirst={index === 0} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface CommitItemProps {
  commit: GitCommitType;
  isFirst: boolean;
}

function CommitItem({ commit, isFirst }: CommitItemProps) {
  const formattedDate = formatCommitDate(commit.date);

  return (
    <div className="relative flex gap-4 pl-6">
      {/* Timeline dot */}
      <div
        className={clsx(
          "absolute left-0 w-6 h-6 rounded-full flex items-center justify-center",
          isFirst ? "bg-accent" : "bg-surface-light border border-border"
        )}
      >
        <GitCommit className={clsx("w-3 h-3", isFirst ? "text-background" : "text-text-muted")} />
      </div>

      {/* Commit content */}
      <div className="flex-1 pb-4">
        <div className="bg-surface rounded-lg p-3 border border-border hover:border-accent/30 transition-colors">
          <p className="text-text-primary text-sm font-medium mb-2 line-clamp-2">
            {commit.message}
          </p>
          <div className="flex items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1">
              <User className="w-3 h-3" />
              {commit.author}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formattedDate}
            </span>
            <span className="font-mono text-accent">{commit.hashShort}</span>
          </div>
          {commit.refs && commit.refs.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {commit.refs.map((ref, i) => (
                <span
                  key={i}
                  className={clsx(
                    "text-xs px-2 py-0.5 rounded",
                    ref.includes("HEAD")
                      ? "bg-accent/20 text-accent"
                      : ref.includes("origin")
                      ? "bg-status-added/20 text-status-added"
                      : "bg-surface-light text-text-secondary"
                  )}
                >
                  {ref}
                </span>
              ))}
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
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  return date.toLocaleDateString();
}
