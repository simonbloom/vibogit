"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";
import type { GitCommit } from "@vibogit/shared";

interface CommitGraphProps {
  repoPath: string | null;
  limit?: number;
}

export function CommitGraph({ repoPath, limit = 30 }: CommitGraphProps) {
  const { send } = useDaemon();
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!repoPath) {
      setCommits([]);
      return;
    }

    const loadCommits = async () => {
      setIsLoading(true);
      try {
        const response = await send<{ commits: GitCommit[] }>("log", {
          repoPath,
          limit,
        });
        setCommits(response.commits);
      } catch (error) {
        console.error("Failed to load commits:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCommits();
  }, [repoPath, limit, send]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        No commits yet
      </div>
    );
  }

  return (
    <div className="p-4 overflow-x-auto">
      <svg
        className="min-w-full"
        width={Math.max(600, commits.length * 40)}
        height={commits.length * 50 + 40}
      >
        {/* Graph lines */}
        {commits.map((commit, index) => {
          const x = 30;
          const y = index * 50 + 25;
          const nextY = (index + 1) * 50 + 25;

          return (
            <g key={`line-${commit.hash}`}>
              {index < commits.length - 1 && (
                <line
                  x1={x}
                  y1={y}
                  x2={x}
                  y2={nextY}
                  stroke="#404040"
                  strokeWidth="2"
                />
              )}
            </g>
          );
        })}

        {/* Commit nodes and labels */}
        {commits.map((commit, index) => {
          const x = 30;
          const y = index * 50 + 25;
          const isHead = commit.refs?.some((r) => r.includes("HEAD"));
          const hasTag = commit.refs?.some((r) => r.startsWith("tag:"));

          return (
            <g key={commit.hash}>
              {/* Commit node */}
              <circle
                cx={x}
                cy={y}
                r={isHead ? 8 : 6}
                fill={isHead ? "#e69a4d" : "#66cc66"}
                stroke={isHead ? "#e69a4d" : "#404040"}
                strokeWidth="2"
              />

              {/* Commit message */}
              <text
                x={x + 25}
                y={y - 5}
                className="fill-text-primary text-sm"
                style={{ fontSize: "12px" }}
              >
                {commit.message.length > 50
                  ? commit.message.substring(0, 50) + "..."
                  : commit.message}
              </text>

              {/* Hash and author */}
              <text
                x={x + 25}
                y={y + 12}
                className="fill-text-muted"
                style={{ fontSize: "10px" }}
              >
                <tspan fill="#e69a4d">{commit.hashShort}</tspan>
                <tspan fill="#666666"> by {commit.author}</tspan>
              </text>

              {/* Branch/tag refs */}
              {commit.refs && commit.refs.length > 0 && (
                <g>
                  {commit.refs.slice(0, 3).map((ref, refIndex) => {
                    const refX = x + 400 + refIndex * 80;
                    const isHeadRef = ref.includes("HEAD");
                    const isRemote = ref.includes("origin");

                    return (
                      <g key={ref}>
                        <rect
                          x={refX}
                          y={y - 10}
                          width={70}
                          height={20}
                          rx={4}
                          fill={
                            isHeadRef
                              ? "rgba(230, 154, 77, 0.2)"
                              : isRemote
                              ? "rgba(102, 204, 102, 0.2)"
                              : "rgba(128, 128, 128, 0.2)"
                          }
                        />
                        <text
                          x={refX + 35}
                          y={y + 4}
                          textAnchor="middle"
                          style={{ fontSize: "10px" }}
                          fill={
                            isHeadRef ? "#e69a4d" : isRemote ? "#66cc66" : "#808080"
                          }
                        >
                          {ref.length > 10 ? ref.substring(0, 10) + "..." : ref}
                        </text>
                      </g>
                    );
                  })}
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
