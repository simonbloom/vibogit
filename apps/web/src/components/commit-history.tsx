"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Loader2 } from "lucide-react";
import type { GitCommit as GitCommitType } from "@vibogit/shared";
import { 
  GraphNode, 
  GraphLine, 
  GraphTooltip, 
  GraphContextMenu, 
  BranchFilter,
  ViewModeToggle,
  VIEW_MODE_CONFIG,
  getBranchColorBase,
  type ViewMode,
  type Branch,
} from "./graph";

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

interface TooltipState {
  commit: GitCommitType | null;
  x: number;
  y: number;
  colorIndex: number;
}

interface ContextMenuState {
  commit: GitCommitType | null;
  x: number;
  y: number;
}

export function CommitHistory({ repoPath, limit = 50 }: CommitHistoryProps) {
  const { send } = useDaemon();
  const [commits, setCommits] = useState<GitCommitType[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [highlightedBranch, setHighlightedBranch] = useState<number | null>(null);
  const [selectedCommit, setSelectedCommit] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipState>({ commit: null, x: 0, y: 0, colorIndex: 0 });
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ commit: null, x: 0, y: 0 });
  const [contextMenuVisible, setContextMenuVisible] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("expanded");
  const [visibleBranches, setVisibleBranches] = useState<Set<string>>(new Set());
  const [branchesInitialized, setBranchesInitialized] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Extract unique branches from commits
  const branches = useMemo<Branch[]>(() => {
    const branchMap = new Map<string, Branch>();
    let colorIndex = 0;
    
    commits.forEach((commit) => {
      commit.refs?.forEach((ref) => {
        // Skip HEAD pointer
        if (ref === "HEAD" || ref.includes("->")) return;
        
        const isRemote = ref.startsWith("origin/") || ref.includes("remote");
        const name = ref.replace(/^origin\//, "");
        
        if (!branchMap.has(ref)) {
          branchMap.set(ref, {
            name: ref,
            isRemote,
            colorIndex: colorIndex++,
          });
        }
      });
    });
    
    return Array.from(branchMap.values());
  }, [commits]);

  // Initialize visible branches when branches change
  useEffect(() => {
    if (branches.length > 0 && !branchesInitialized) {
      setVisibleBranches(new Set(branches.map((b) => b.name)));
      setBranchesInitialized(true);
    }
  }, [branches, branchesInitialized]);

  const handleToggleBranch = useCallback((branchName: string) => {
    setVisibleBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchName)) {
        next.delete(branchName);
      } else {
        next.add(branchName);
      }
      return next;
    });
  }, []);

  const handleShowAllBranches = useCallback(() => {
    setVisibleBranches(new Set(branches.map((b) => b.name)));
  }, [branches]);

  const handleHideAllBranches = useCallback(() => {
    setVisibleBranches(new Set());
  }, []);

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

  const handleNodeHover = useCallback((commit: GitCommitType, x: number, y: number, colorIndex: number) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip({ commit, x, y, colorIndex });
      setTooltipVisible(true);
    }, 150);
  }, []);

  const handleNodeLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
    }
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltipVisible(false);
    }, 100);
  }, []);

  const handleBranchHover = useCallback((branchIndex: number) => {
    setHighlightedBranch(branchIndex);
  }, []);

  const handleBranchLeave = useCallback(() => {
    setHighlightedBranch(null);
  }, []);

  const handleCommitClick = useCallback((hash: string) => {
    setSelectedCommit(prev => prev === hash ? null : hash);
  }, []);

  const handleContextMenu = useCallback((commit: GitCommitType, x: number, y: number) => {
    setContextMenu({ commit, x, y });
    setContextMenuVisible(true);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuVisible(false);
  }, []);

  const handleContextMenuAction = useCallback(async (actionId: string, commit: GitCommitType) => {
    switch (actionId) {
      case "copy-sha":
        await navigator.clipboard.writeText(commit.hashShort);
        break;
      case "copy-sha-full":
        await navigator.clipboard.writeText(commit.hash);
        break;
      case "checkout":
        if (repoPath) {
          try {
            await send("checkout", { repoPath, ref: commit.hash });
          } catch (err) {
            console.error("Checkout failed:", err);
          }
        }
        break;
      default:
        console.log(`Action ${actionId} not implemented yet`);
    }
  }, [repoPath, send]);

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

  const config = VIEW_MODE_CONFIG[viewMode];
  const graphWidth = (maxColumn + 1) * config.colWidth + 24;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 px-3 py-2 border-b border-border bg-muted/20">
        <BranchFilter
          branches={branches}
          visibleBranches={visibleBranches}
          onToggleBranch={handleToggleBranch}
          onShowAll={handleShowAllBranches}
          onHideAll={handleHideAllBranches}
        />
        <ViewModeToggle mode={viewMode} onModeChange={setViewMode} />
      </div>

      {/* Graph */}
      <div className="overflow-auto relative flex-1" ref={containerRef}>
      {graphRows.map((row) => (
        <CommitRow
          key={row.commit.hash}
          row={row}
          graphWidth={graphWidth}
          highlightedBranch={highlightedBranch}
          selectedCommit={selectedCommit}
          onNodeHover={handleNodeHover}
          onNodeLeave={handleNodeLeave}
          onBranchHover={handleBranchHover}
          onBranchLeave={handleBranchLeave}
          onCommitClick={handleCommitClick}
          onContextMenu={handleContextMenu}
          viewConfig={config}
        />
      ))}
      <GraphTooltip
        commit={tooltip.commit}
        x={tooltip.x}
        y={tooltip.y}
        visible={tooltipVisible}
        colorIndex={tooltip.colorIndex}
        containerRef={containerRef}
      />
      <GraphContextMenu
        commit={contextMenu.commit}
        x={contextMenu.x}
        y={contextMenu.y}
        visible={contextMenuVisible}
        onAction={handleContextMenuAction}
        onClose={handleContextMenuClose}
      />
      </div>
    </div>
  );
}

interface ViewConfig {
  rowHeight: number;
  nodeRadius: number;
  headNodeRadius: number;
  fontSize: number;
  showAuthor: boolean;
  messageMaxLength: number;
  colWidth: number;
}

interface CommitRowProps {
  row: GraphRow;
  graphWidth: number;
  highlightedBranch: number | null;
  selectedCommit: string | null;
  onNodeHover: (commit: GitCommitType, x: number, y: number, colorIndex: number) => void;
  onNodeLeave: () => void;
  onBranchHover: (branchIndex: number) => void;
  onBranchLeave: () => void;
  onCommitClick: (hash: string) => void;
  onContextMenu: (commit: GitCommitType, x: number, y: number) => void;
  viewConfig: ViewConfig;
}

function CommitRow({
  row,
  graphWidth,
  highlightedBranch,
  selectedCommit,
  onNodeHover,
  onNodeLeave,
  onBranchHover,
  onBranchLeave,
  onCommitClick,
  onContextMenu,
  viewConfig,
}: CommitRowProps) {
  const { commit, nodeCol, columnsBefore, columnsAfter, mergeInCols, branchOutCols } = row;
  const formattedDate = formatCommitDate(commit.date);
  const isHead = commit.refs?.some((r) => r.includes("HEAD"));
  const isMerge = (commit.parents?.length ?? 0) > 1;
  const isSelected = selectedCommit === commit.hash;
  const nodeColor = getBranchColorBase(nodeCol);
  
  const { rowHeight: ROW_HEIGHT, colWidth: COL_WIDTH, showAuthor, messageMaxLength, fontSize } = viewConfig;
  const OFFSET = 14;
  const midY = ROW_HEIGHT / 2;
  const nodeX = OFFSET + nodeCol * COL_WIDTH;

  return (
    <div
      className={`flex items-stretch transition-colors ${
        isSelected ? "bg-muted/50" : "hover:bg-muted/30"
      }`}
      style={{ minHeight: ROW_HEIGHT }}
    >
      <div className="flex-shrink-0 relative" style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <svg width={graphWidth} height={ROW_HEIGHT} className="absolute inset-0 overflow-visible">
          {/* Upper segments (from previous row) */}
          {columnsBefore.map((hash, index) => {
            if (!hash) return null;
            const x = OFFSET + index * COL_WIDTH;
            const isHighlighted = highlightedBranch === index;
            const isDimmed = highlightedBranch !== null && !isHighlighted;
            return (
              <GraphLine
                key={`upper-${index}`}
                type="vertical"
                startX={x}
                startY={0}
                endX={x}
                endY={midY}
                colorIndex={index}
                isHighlighted={isHighlighted}
                isDimmed={isDimmed}
                onMouseEnter={() => onBranchHover(index)}
                onMouseLeave={onBranchLeave}
              />
            );
          })}

          {/* Lower segments (to next row) */}
          {columnsAfter.map((hash, index) => {
            if (!hash) return null;
            const x = OFFSET + index * COL_WIDTH;
            const isHighlighted = highlightedBranch === index;
            const isDimmed = highlightedBranch !== null && !isHighlighted;
            return (
              <GraphLine
                key={`lower-${index}`}
                type="vertical"
                startX={x}
                startY={midY}
                endX={x}
                endY={ROW_HEIGHT}
                colorIndex={index}
                isHighlighted={isHighlighted}
                isDimmed={isDimmed}
                onMouseEnter={() => onBranchHover(index)}
                onMouseLeave={onBranchLeave}
              />
            );
          })}

          {/* Merge-in curves (existing branch merging into node) */}
          {mergeInCols.map((sourceCol) => {
            if (sourceCol === nodeCol) return null;
            const x1 = OFFSET + sourceCol * COL_WIDTH;
            const x2 = OFFSET + nodeCol * COL_WIDTH;
            const isHighlighted = highlightedBranch === sourceCol;
            const isDimmed = highlightedBranch !== null && !isHighlighted;
            return (
              <GraphLine
                key={`merge-in-${sourceCol}`}
                type="merge-in"
                startX={x1}
                startY={0}
                endX={x2}
                endY={midY}
                colorIndex={sourceCol}
                isHighlighted={isHighlighted}
                isDimmed={isDimmed}
                onMouseEnter={() => onBranchHover(sourceCol)}
                onMouseLeave={onBranchLeave}
              />
            );
          })}

          {/* Branch-out curves (new branch starting below) */}
          {branchOutCols.map((targetCol) => {
            if (targetCol === nodeCol) return null;
            const x1 = OFFSET + nodeCol * COL_WIDTH;
            const x2 = OFFSET + targetCol * COL_WIDTH;
            const isHighlighted = highlightedBranch === targetCol;
            const isDimmed = highlightedBranch !== null && !isHighlighted;
            return (
              <GraphLine
                key={`branch-out-${targetCol}`}
                type="branch-out"
                startX={x1}
                startY={midY}
                endX={x2}
                endY={ROW_HEIGHT}
                colorIndex={targetCol}
                isHighlighted={isHighlighted}
                isDimmed={isDimmed}
                onMouseEnter={() => onBranchHover(targetCol)}
                onMouseLeave={onBranchLeave}
              />
            );
          })}

          {/* Commit Node */}
          <GraphNode
            x={nodeX}
            y={midY}
            colorIndex={nodeCol}
            isHead={isHead}
            isMerge={isMerge}
            isSelected={isSelected}
            isHighlighted={highlightedBranch === nodeCol}
            onMouseEnter={() => onNodeHover(commit, nodeX, midY, nodeCol)}
            onMouseLeave={onNodeLeave}
            onClick={() => onCommitClick(commit.hash)}
            onContextMenu={(e) => {
              e.preventDefault();
              const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
              const x = e.clientX - (rect?.left ?? 0);
              const y = e.clientY - (rect?.top ?? 0);
              onContextMenu(commit, x, y);
            }}
          />
        </svg>
      </div>

      <div className="flex-1 py-1 pr-4 min-w-0 border-b border-border/50 flex items-center">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="min-w-0 flex-1">
            <p 
              className="font-medium truncate" 
              style={{ fontSize: `${fontSize}px` }}
              title={commit.message}
            >
              {commit.message.length > messageMaxLength 
                ? commit.message.slice(0, messageMaxLength) + "..." 
                : commit.message}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-muted-foreground" style={{ fontSize: `${fontSize - 2}px` }}>
              <span className="font-mono" style={{ color: nodeColor }}>{commit.hashShort}</span>
              {showAuthor && <span>{commit.author}</span>}
              <span>{formattedDate}</span>
            </div>
          </div>
          {commit.refs && commit.refs.length > 0 && (
            <div className="flex gap-1 flex-shrink-0 flex-wrap justify-end">
              {commit.refs.map((ref, i) => {
                const label = ref.includes("->") ? ref.split("->")[1]?.trim() : ref;
                const isTag = ref.startsWith("tag:");
                const isMain = label === "main" || label === "master" || ref.includes("HEAD");
                return (
                  <span
                    key={i}
                    className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                      isTag
                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700"
                        : isMain
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 border border-blue-200 dark:border-blue-700"
                        : "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 border border-green-200 dark:border-green-700"
                    }`}
                  >
                    {isTag ? "🏷️ " : ""}{label}
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
