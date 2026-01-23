"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import { Loader2, User, Clock } from "lucide-react";
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
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading commits...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-destructive">
        <p>{error}</p>
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <p>No commits yet</p>
      </div>
    );
  }

  return (
    <div className="py-2">
      {commits.map((commit, index) => (
        <CommitRow key={commit.hash} commit={commit} isFirst={index === 0} />
      ))}
    </div>
  );
}

interface CommitRowProps {
  commit: GitCommitType;
  isFirst: boolean;
}

function CommitRow({ commit, isFirst }: CommitRowProps) {
  const formattedDate = formatCommitDate(commit.date);

  return (
    <div className="flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors">
      <div className="flex flex-col items-center pt-1">
        <div
          className={clsx(
            "w-3 h-3 rounded-full",
            isFirst ? "bg-primary" : "bg-muted-foreground/30"
          )}
        />
        <div className="w-px flex-1 bg-border mt-2" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium leading-snug">{commit.message}</p>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span className="font-mono text-primary">{commit.hashShort}</span>
          <span className="flex items-center gap-1">
            <User className="w-3 h-3" />
            {commit.author}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {formattedDate}
          </span>
        </div>
      </div>

      {commit.refs && commit.refs.length > 0 && (
        <div className="flex gap-1 flex-shrink-0">
          {commit.refs.map((ref, i) => (
            <span
              key={i}
              className={clsx(
                "text-xs px-2 py-1 rounded font-medium border",
                ref.includes("HEAD") || ref === "main" || ref === "master"
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "bg-green-500/10 text-green-500 border-green-500/30"
              )}
            >
              {ref.includes("->") ? ref.split("->")[1]?.trim() : ref}
            </span>
          ))}
        </div>
      )}
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
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hr ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
