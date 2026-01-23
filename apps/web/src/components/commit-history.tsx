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
  mergeTargets: number[];
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

function buildGraph(commits: GitCommitType[]): { rows: GraphRow[]; colorMap: Map<string, string> } {
  const rows: GraphRow[] = [];
  const columns: Array<string | null> = [];
  const colorMap = new Map<string, string>();
  let colorIndex = 0;

  const assignColor = (hash: string) => {
    if (!colorMap.has(hash)) {
      colorMap.set(hash, COLORS[colorIndex % COLORS.length]);
      colorIndex += 1;
    }
  };

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
    assignColor(commit.hash);
    const nodeCol = assignColumn(commit.hash);
    const columnsBefore = [...columns];
    const mergeTargets: number[] = [];
    const parents = commit.parents || [];

    if (parents.length === 0) {
      columns[nodeCol] = null;
    } else {
      const firstParent = parents[0];
      assignColor(firstParent);
      const existingFirstCol = findColumn(firstParent);

      if (existingFirstCol !== -1 && existingFirstCol !== nodeCol) {
        mergeTargets.push(existingFirstCol);
        columns[nodeCol] = null;
      } else {
        columns[nodeCol] = firstParent;
      }

      for (const parent of parents.slice(1)) {
        assignColor(parent);
        const existingCol = findColumn(parent);
        if (existingCol !== -1) {
          mergeTargets.push(existingCol);
        } else {
          const newCol = assignColumn(parent);
          mergeTargets.push(newCol);
        }
      }
    }

    const columnsAfter = [...columns];
    rows.push({ commit, nodeCol, columnsBefore, columnsAfter, mergeTargets });
  }

  return { rows, colorMap };
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

  const graphData = useMemo(() => buildGraph(commits), [commits]);
  const maxColumn = useMemo(() => {
    if (graphData.rows.length === 0) return 0;
    return Math.max(
      ...graphData.rows.map((row) => Math.max(lastColumnIndex(row.columnsBefore), lastColumnIndex(row.columnsAfter)))
    );
  }, [graphData.rows]);

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
      {graphData.rows.map((row, index) => (
        <CommitRow
          key={row.commit.hash}
          row={row}
          graphWidth={graphWidth}
          isFirst={index === 0}
          colorMap={graphData.colorMap}
        />
      ))}
    </div>
  );
}

interface CommitRowProps {
  row: GraphRow;
  graphWidth: number;
  isFirst: boolean;
  colorMap: Map<string, string>;
}

function CommitRow({ row, graphWidth, isFirst, colorMap }: CommitRowProps) {
  const { commit, nodeCol, columnsBefore, columnsAfter, mergeTargets } = row;
  const formattedDate = formatCommitDate(commit.date);
  const isHead = commit.refs?.some((r) => r.includes("HEAD"));
  const nodeColor = colorMap.get(commit.hash) || COLORS[0];
  const ROW_HEIGHT = 44;
  const COL_WIDTH = 18;
  const OFFSET = 14;
  const midY = ROW_HEIGHT / 2;

  return (
    <div className="flex items-stretch hover:bg-muted/30 transition-colors" style={{ minHeight: ROW_HEIGHT }}>
      <div className="flex-shrink-0 relative" style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <svg width={graphWidth} height={ROW_HEIGHT} className="absolute inset-0">
          {/* Vertical lines for existing branches */}
          {columnsBefore.map((hash, index) => {
            if (!hash) return null;
            const x = OFFSET + index * COL_WIDTH;
            const lineColor = colorMap.get(hash) || COLORS[0];
            return (
              <line
                key={`col-${index}`}
                x1={x}
                y1={isFirst && index === nodeCol ? midY : 0}
                x2={x}
                y2={ROW_HEIGHT}
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Lines for newly created columns (from merges) */}
          {columnsAfter.map((hash, index) => {
            if (!hash) return null;
            if (columnsBefore[index]) return null;
            const x = OFFSET + index * COL_WIDTH;
            const lineColor = colorMap.get(hash) || COLORS[0];
            return (
              <line
                key={`new-${index}`}
                x1={x}
                y1={midY}
                x2={x}
                y2={ROW_HEIGHT}
                stroke={lineColor}
                strokeWidth={2}
              />
            );
          })}

          {/* Merge curves */}
          {mergeTargets.map((targetCol, i) => {
            if (targetCol === nodeCol) return null;
            const x1 = OFFSET + nodeCol * COL_WIDTH;
            const x2 = OFFSET + targetCol * COL_WIDTH;
            const targetHash = columnsAfter[targetCol] || columnsBefore[targetCol];
            const lineColor = targetHash ? colorMap.get(targetHash) || COLORS[0] : COLORS[0];
            const controlY = midY + 12;
            const curve = `M ${x1} ${midY} C ${x1} ${controlY}, ${x2} ${controlY}, ${x2} ${ROW_HEIGHT}`;
            return (
              <path
                key={`merge-${i}`}
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
