"use client";

import { useEffect, useState, useMemo } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Loader2 } from "lucide-react";
import type { GitCommit as GitCommitType } from "@vibogit/shared";

interface CommitHistoryProps {
  repoPath: string | null;
  limit?: number;
}

interface GraphNode {
  commit: GitCommitType;
  column: number;
  lines: GraphLine[];
}

interface GraphLine {
  fromCol: number;
  toCol: number;
  type: "straight" | "merge" | "branch";
}

const COLORS = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#06b6d4", // cyan
];

function buildGraph(commits: GitCommitType[]): GraphNode[] {
  const nodes: GraphNode[] = [];
  const activeColumns: Map<string, number> = new Map();
  let nextColumn = 0;

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const lines: GraphLine[] = [];

    // Find or assign column for this commit
    let column = activeColumns.get(commit.hash);
    if (column === undefined) {
      column = nextColumn++;
    }
    activeColumns.delete(commit.hash);

    // Handle parents
    const parents = commit.parents || [];
    
    if (parents.length === 0) {
      // Root commit - no lines below
    } else if (parents.length === 1) {
      // Single parent - straight line or pass to parent
      const parentHash = parents[0];
      const existingParentCol = activeColumns.get(parentHash);
      
      if (existingParentCol !== undefined) {
        // Parent already has a column, merge into it
        lines.push({ fromCol: column, toCol: existingParentCol, type: "merge" });
      } else {
        // Assign this column to parent
        activeColumns.set(parentHash, column);
        lines.push({ fromCol: column, toCol: column, type: "straight" });
      }
    } else {
      // Merge commit - multiple parents
      parents.forEach((parentHash, idx) => {
        const existingParentCol = activeColumns.get(parentHash);
        
        if (existingParentCol !== undefined) {
          lines.push({ fromCol: column, toCol: existingParentCol, type: "merge" });
        } else {
          if (idx === 0) {
            // First parent continues in same column
            activeColumns.set(parentHash, column);
            lines.push({ fromCol: column, toCol: column, type: "straight" });
          } else {
            // Other parents get new columns
            const newCol = nextColumn++;
            activeColumns.set(parentHash, newCol);
            lines.push({ fromCol: column, toCol: newCol, type: "branch" });
          }
        }
      });
    }

    // Continue active columns that aren't touched
    for (const [hash, col] of activeColumns) {
      if (!parents.includes(hash)) {
        lines.push({ fromCol: col, toCol: col, type: "straight" });
      }
    }

    nodes.push({ commit, column, lines });
  }

  return nodes;
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

  const graphNodes = useMemo(() => buildGraph(commits), [commits]);
  const maxColumn = useMemo(() => 
    Math.max(0, ...graphNodes.map(n => Math.max(n.column, ...n.lines.map(l => Math.max(l.fromCol, l.toCol))))),
    [graphNodes]
  );

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

  const graphWidth = (maxColumn + 1) * 20 + 20;

  return (
    <div className="overflow-auto">
      {graphNodes.map((node, index) => (
        <CommitRow
          key={node.commit.hash}
          node={node}
          isFirst={index === 0}
          isLast={index === graphNodes.length - 1}
          graphWidth={graphWidth}
        />
      ))}
    </div>
  );
}

interface CommitRowProps {
  node: GraphNode;
  isFirst: boolean;
  isLast: boolean;
  graphWidth: number;
}

function CommitRow({ node, isFirst, isLast, graphWidth }: CommitRowProps) {
  const { commit, column, lines } = node;
  const formattedDate = formatCommitDate(commit.date);
  const isHead = commit.refs?.some(r => r.includes("HEAD"));
  const color = COLORS[column % COLORS.length];
  const ROW_HEIGHT = 40;
  const COL_WIDTH = 20;
  const OFFSET = 16;

  return (
    <div className="flex items-stretch hover:bg-muted/30 transition-colors" style={{ minHeight: ROW_HEIGHT }}>
      {/* Graph column */}
      <div className="flex-shrink-0 relative" style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <svg width={graphWidth} height={ROW_HEIGHT} className="absolute inset-0">
          {/* Draw lines */}
          {lines.map((line, i) => {
            const x1 = OFFSET + line.fromCol * COL_WIDTH;
            const x2 = OFFSET + line.toCol * COL_WIDTH;
            const lineColor = COLORS[line.fromCol % COLORS.length];
            
            if (line.type === "straight") {
              return (
                <line
                  key={i}
                  x1={x1}
                  y1={0}
                  x2={x2}
                  y2={ROW_HEIGHT}
                  stroke={lineColor}
                  strokeWidth={2}
                />
              );
            } else {
              // Curved line for merge/branch
              const midY = ROW_HEIGHT / 2;
              return (
                <path
                  key={i}
                  d={`M ${x1} ${midY} Q ${x1} ${ROW_HEIGHT} ${x2} ${ROW_HEIGHT}`}
                  fill="none"
                  stroke={lineColor}
                  strokeWidth={2}
                />
              );
            }
          })}
          
          {/* Draw node */}
          <circle
            cx={OFFSET + column * COL_WIDTH}
            cy={ROW_HEIGHT / 2}
            r={isHead ? 5 : 4}
            fill={color}
            stroke={isHead ? "#fff" : "none"}
            strokeWidth={isHead ? 2 : 0}
          />
        </svg>
      </div>

      {/* Commit info */}
      <div className="flex-1 py-1.5 pr-4 min-w-0 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{commit.message}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono" style={{ color }}>{commit.hashShort}</span>
              <span>{commit.author}</span>
              <span>{formattedDate}</span>
            </div>
          </div>
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
