"use client";

import { useEffect, useMemo, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Loader2 } from "lucide-react";
import type { GitCommit as GitCommitType } from "@vibogit/shared";

interface CommitHistoryProps {
  repoPath: string | null;
  limit?: number;
}

interface GraphRow {
  commit: GitCommitType;
  nodeCol: number;
  columnsBefore: Array<string | null>;
  columnsAfter: Array<string | null>;
  mergeInCols: number[];
  branchOutCols: number[];
}

const COLORS = [
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#14b8a6",
];

function buildGraph(commits: GitCommitType[]): GraphRow[] {
  const rows: GraphRow[] = [];
  const columns: Array<string | null> = [];

  const findColumn = (hash: string) => columns.indexOf(hash);

  const assignColumn = (hash: string) => {
    const existing = findColumn(hash);
    if (existing !== -1) return existing;
    const empty = columns.indexOf(null);
    if (empty !== -1) {
      columns[empty] = hash;
      return empty;
    }
    columns.push(hash);
    return columns.length - 1;
  };

  for (const commit of commits) {
    const columnsBefore = [...columns];
    let nodeCol = findColumn(commit.hash);
    if (nodeCol === -1) {
      nodeCol = assignColumn(commit.hash);
    }

    const mergeInCols = new Set<number>();
    const branchOutCols = new Set<number>();
    const parents = commit.parents || [];

    if (parents.length === 0) {
      columns[nodeCol] = null;
    } else {
      const firstParent = parents[0];
      const existingFirstCol = findColumn(firstParent);

      if (existingFirstCol !== -1 && existingFirstCol !== nodeCol) {
        mergeInCols.add(existingFirstCol);
        columns[existingFirstCol] = null;
      }

      columns[nodeCol] = firstParent;

      for (const parent of parents.slice(1)) {
        const existingCol = findColumn(parent);
        if (existingCol !== -1) {
          mergeInCols.add(existingCol);
        } else {
          const newCol = assignColumn(parent);
          branchOutCols.add(newCol);
        }
      }
    }

    const columnsAfter = [...columns];
    rows.push({
      commit,
      nodeCol,
      columnsBefore,
      columnsAfter,
      mergeInCols: Array.from(mergeInCols),
      branchOutCols: Array.from(branchOutCols),
    });
  }

  return rows;
}

function lastColumnIndex(cols: Array<string | null>): number {
  for (let i = cols.length - 1; i >= 0; i -= 1) {
    if (cols[i]) return i;
  }
  return 0;
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

  const graphRows = useMemo(() => buildGraph(commits), [commits]);
  const maxColumn = useMemo(() => {
    if (graphRows.length === 0) return 0;
    return Math.max(
      ...graphRows.map((row) => Math.max(lastColumnIndex(row.columnsBefore), lastColumnIndex(row.columnsAfter)))
    );
  }, [graphRows]);

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
      {graphRows.map((row) => (
        <CommitRow
          key={row.commit.hash}
          row={row}
          graphWidth={graphWidth}
        />
      ))}
    </div>
  );
}

interface CommitRowProps {
  row: GraphRow;
  graphWidth: number;
}

function CommitRow({ row, graphWidth }: CommitRowProps) {
  const { commit, nodeCol, columnsBefore, columnsAfter, mergeInCols, branchOutCols } = row;
  const formattedDate = formatCommitDate(commit.date);
  const isHead = commit.refs?.some((r) => r.includes("HEAD"));
  const nodeColor = COLORS[nodeCol % COLORS.length];
  const ROW_HEIGHT = 44;
  const COL_WIDTH = 18;
  const OFFSET = 14;
  const midY = ROW_HEIGHT / 2;

  return (
    <div className="flex items-stretch hover:bg-muted/30 transition-colors" style={{ minHeight: ROW_HEIGHT }}>
      <div className="flex-shrink-0 relative" style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <svg width={graphWidth} height={ROW_HEIGHT} className="absolute inset-0">
          {/* Upper segments (from previous row) */}
          {columnsBefore.map((hash, index) => {
            if (!hash) return null;
            const x = OFFSET + index * COL_WIDTH;
            const lineColor = COLORS[index % COLORS.length];
            return (
              <line
                key={`upper-${index}`}
                x1={x}
                y1={0}
                x2={x}
                y2={midY}
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Lower segments (to next row) */}
          {columnsAfter.map((hash, index) => {
            if (!hash) return null;
            const x = OFFSET + index * COL_WIDTH;
            const lineColor = COLORS[index % COLORS.length];
            return (
              <line
                key={`lower-${index}`}
                x1={x}
                y1={midY}
                x2={x}
                y2={ROW_HEIGHT}
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Merge-in curves (existing branch merging into node) */}
          {mergeInCols.map((targetCol) => {
            if (targetCol === nodeCol) return null;
            const x1 = OFFSET + targetCol * COL_WIDTH;
            const x2 = OFFSET + nodeCol * COL_WIDTH;
            const lineColor = COLORS[targetCol % COLORS.length];
            const controlY = midY - 10;
            const curve = `M ${x1} ${midY} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${midY}`;
            return (
              <path
                key={`merge-in-${targetCol}`}
                d={curve}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Branch-out curves (new branch starting below) */}
          {branchOutCols.map((targetCol) => {
            if (targetCol === nodeCol) return null;
            const x1 = OFFSET + nodeCol * COL_WIDTH;
            const x2 = OFFSET + targetCol * COL_WIDTH;
            const lineColor = COLORS[targetCol % COLORS.length];
            const controlY = midY + 10;
            const curve = `M ${x1} ${midY} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${ROW_HEIGHT}`;
            return (
              <path
                key={`branch-out-${targetCol}`}
                d={curve}
                fill="none"
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Node */}
          <circle
            cx={OFFSET + nodeCol * COL_WIDTH}
            cy={midY}
            r={isHead ? 5 : 4}
            fill={nodeColor}
            stroke={isHead ? "#fff" : "none"}
            strokeWidth={isHead ? 2 : 0}
          />
        </svg>
      </div>

      <div className="flex-1 py-1.5 pr-4 min-w-0 border-b border-border/50">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{commit.message}</p>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono" style={{ color: nodeColor }}>{commit.hashShort}</span>
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
