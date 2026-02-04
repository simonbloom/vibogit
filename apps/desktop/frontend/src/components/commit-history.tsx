"use client";

import { memo, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Loader2 } from "lucide-react";
import type { GitCommit as GitCommitType } from "@vibogit/shared";
import {
  GraphNode,
  GraphLine,
  GraphTooltip,
  GraphContextMenu,
  BranchFilter,
  VIEW_MODE_CONFIG,
  getBranchColorBase,
  type Branch,
} from "./graph";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CommitHistoryProps {
  repoPath: string | null;
  limit?: number;
  refreshKey?: number;
}

interface GraphEdge {
  type: "vertical" | "merge-in" | "branch-out";
  fromLane: number;
  toLane: number;
  colorId: number;
}

interface GraphRow {
  commit: GitCommitType;
  lane: number;
  colorId: number;
  edges: GraphEdge[];
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

// ---------------------------------------------------------------------------
// Straight-branch lane assignment algorithm
// ---------------------------------------------------------------------------

function buildGraph(commits: GitCommitType[]): { rows: GraphRow[]; maxLane: number } {
  if (commits.length === 0) return { rows: [], maxLane: 0 };

  // lanes[i] = hash of commit currently "owning" that lane, or null if free
  const lanes: Array<string | null> = [];
  // Map commit hash -> lane index (for already-placed children)
  const hashToLane = new Map<string, number>();
  // Map commit hash -> colorId
  const hashToColor = new Map<string, number>();

  let colorCounter = 0;
  let maxLane = 0;

  const rows: GraphRow[] = [];

  // childrenOf[parentHash] = list of child hashes whose first-parent is parentHash
  const branchChildrenOf = new Map<string, string[]>();
  // mergeChildrenOf[parentHash] = list of { childHash, childRow } for non-first parents
  const mergeChildrenOf = new Map<string, string[]>();

  // Pre-scan to build parent->children maps
  for (const c of commits) {
    const parents = c.parents || [];
    if (parents.length > 0) {
      const first = parents[0];
      if (!branchChildrenOf.has(first)) branchChildrenOf.set(first, []);
      branchChildrenOf.get(first)!.push(c.hash);
    }
    for (let p = 1; p < parents.length; p++) {
      const ph = parents[p];
      if (!mergeChildrenOf.has(ph)) mergeChildrenOf.set(ph, []);
      mergeChildrenOf.get(ph)!.push(c.hash);
    }
  }

  const findFreeLane = (): number => {
    const idx = lanes.indexOf(null);
    if (idx !== -1) return idx;
    lanes.push(null);
    return lanes.length - 1;
  };

  // Compute forbidden lanes for a commit: lanes occupied between the commit's
  // row and any merge-child row that would cause edge crossings.
  const computeForbiddenLanes = (commitHash: string, rowIndex: number): Set<number> => {
    const forbidden = new Set<number>();
    const mChildren = mergeChildrenOf.get(commitHash);
    if (!mChildren || mChildren.length === 0) return forbidden;

    // Find the minimum row index among merge children
    let minChildRow = rowIndex;
    for (const ch of mChildren) {
      for (let r = 0; r < rows.length; r++) {
        if (rows[r].commit.hash === ch) {
          minChildRow = Math.min(minChildRow, r);
          break;
        }
      }
    }

    // All lanes that are occupied between minChildRow and current row are forbidden
    for (let r = minChildRow; r < rowIndex; r++) {
      const row = rows[r];
      // The lane of the commit node itself is occupied
      forbidden.add(row.lane);
      // All edges passing through this region occupy their lanes
      for (const edge of row.edges) {
        forbidden.add(edge.fromLane);
        forbidden.add(edge.toLane);
      }
    }
    return forbidden;
  };

  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const parents = commit.parents || [];
    const edges: GraphEdge[] = [];

    // 1. Determine this commit's lane
    let lane: number;
    let colorId: number;

    if (hashToLane.has(commit.hash)) {
      // A child already reserved a lane for us
      lane = hashToLane.get(commit.hash)!;
      colorId = hashToColor.get(commit.hash) ?? colorCounter++;
    } else {
      // First commit or new branch head - find a lane
      const forbidden = computeForbiddenLanes(commit.hash, i);
      lane = -1;
      // Try to find a free lane not in forbidden set
      for (let l = 0; l < lanes.length; l++) {
        if (lanes[l] === null && !forbidden.has(l)) {
          lane = l;
          break;
        }
      }
      if (lane === -1) {
        lanes.push(null);
        lane = lanes.length - 1;
      }
      colorId = colorCounter++;
    }

    lanes[lane] = commit.hash;
    hashToLane.set(commit.hash, lane);
    hashToColor.set(commit.hash, colorId);

    // 2. Process parents
    if (parents.length === 0) {
      // Root commit - free the lane after this row
      lanes[lane] = null;
    } else {
      const firstParent = parents[0];

      // First parent continues in the same lane (straight branch)
      if (!hashToLane.has(firstParent)) {
        hashToLane.set(firstParent, lane);
        hashToColor.set(firstParent, colorId);
        lanes[lane] = firstParent;
      } else {
        // First parent already has a lane (merge scenario)
        const parentLane = hashToLane.get(firstParent)!;
        if (parentLane !== lane) {
          edges.push({
            type: "merge-in",
            fromLane: lane,
            toLane: parentLane,
            colorId,
          });
        }
        // Free current lane since we're merging into parent's lane
        lanes[lane] = null;
      }

      // Additional parents (merge parents) get their own lanes
      for (let p = 1; p < parents.length; p++) {
        const parentHash = parents[p];
        if (!hashToLane.has(parentHash)) {
          // Assign a new lane for this parent
          const newLane = findFreeLane();
          hashToLane.set(parentHash, newLane);
          const parentColorId = colorCounter++;
          hashToColor.set(parentHash, parentColorId);
          lanes[newLane] = parentHash;
          edges.push({
            type: "branch-out",
            fromLane: lane,
            toLane: newLane,
            colorId: parentColorId,
          });
        } else {
          // Parent already placed - draw merge edge
          const parentLane = hashToLane.get(parentHash)!;
          const parentColor = hashToColor.get(parentHash) ?? colorId;
          if (parentLane !== lane) {
            edges.push({
              type: "merge-in",
              fromLane: lane,
              toLane: parentLane,
              colorId: parentColor,
            });
          }
        }
      }
    }

    // Add vertical continuation edges for all active lanes that pass through this row
    for (let l = 0; l < lanes.length; l++) {
      if (lanes[l] !== null && l !== lane) {
        const laneColor = hashToColor.get(lanes[l]!) ?? 0;
        edges.push({
          type: "vertical",
          fromLane: l,
          toLane: l,
          colorId: laneColor,
        });
      }
    }

    if (lane > maxLane) maxLane = lane;

    rows.push({ commit, lane, colorId, edges });
  }

  return { rows, maxLane };
}

// ---------------------------------------------------------------------------
// Virtualization constants
// ---------------------------------------------------------------------------

const SCROLL_BUFFER = 10;

// ---------------------------------------------------------------------------
// CommitHistory component
// ---------------------------------------------------------------------------

export function CommitHistory({ repoPath, limit = 200, refreshKey }: CommitHistoryProps) {
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
  const [visibleBranches, setVisibleBranches] = useState<Set<string>>(new Set());
  const [branchesInitialized, setBranchesInitialized] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const config = VIEW_MODE_CONFIG.expanded;
  const ROW_HEIGHT = config.rowHeight;

  // Extract unique branches from commits
  const branches = useMemo<Branch[]>(() => {
    const branchMap = new Map<string, Branch>();
    let colorIndex = 0;
    commits.forEach((commit) => {
      commit.refs?.forEach((ref) => {
        if (ref === "HEAD" || ref.includes("->")) return;
        const isRemote = ref.startsWith("origin/") || ref.includes("remote");
        if (!branchMap.has(ref)) {
          branchMap.set(ref, { name: ref, isRemote, colorIndex: colorIndex++ });
        }
      });
    });
    return Array.from(branchMap.values());
  }, [commits]);

  useEffect(() => {
    if (branches.length > 0 && !branchesInitialized) {
      setVisibleBranches(new Set(branches.map((b) => b.name)));
      setBranchesInitialized(true);
    }
  }, [branches, branchesInitialized]);

  const handleToggleBranch = useCallback((branchName: string) => {
    setVisibleBranches((prev) => {
      const next = new Set(prev);
      if (next.has(branchName)) next.delete(branchName);
      else next.add(branchName);
      return next;
    });
  }, []);

  const handleShowAllBranches = useCallback(() => {
    setVisibleBranches(new Set(branches.map((b) => b.name)));
  }, [branches]);

  const handleHideAllBranches = useCallback(() => {
    setVisibleBranches(new Set());
  }, []);

  // Load commits
  useEffect(() => {
    if (!repoPath) { setCommits([]); return; }
    const loadCommits = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await send<{ commits: GitCommitType[] }>("log", { repoPath, limit });
        setCommits(response.commits);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load commits");
        setCommits([]);
      } finally {
        setIsLoading(false);
      }
    };
    loadCommits();
  }, [repoPath, limit, send, refreshKey]);

  // Build graph layout
  const { rows: graphRows, maxLane } = useMemo(() => buildGraph(commits), [commits]);
  const graphWidth = (maxLane + 1) * config.colWidth + 32;
  const totalHeight = graphRows.length * ROW_HEIGHT;

  // Virtualization: compute visible range
  const firstVisible = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - SCROLL_BUFFER);
  const lastVisible = Math.min(
    graphRows.length - 1,
    Math.ceil((scrollTop + containerHeight) / ROW_HEIGHT) + SCROLL_BUFFER,
  );
  const visibleRows = graphRows.slice(firstVisible, lastVisible + 1);

  // Track container size
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    ro.observe(el);
    setContainerHeight(el.clientHeight);
    return () => ro.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  // Event handlers
  const handleNodeHover = useCallback((commit: GitCommitType, x: number, y: number, colorIndex: number) => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => {
      setTooltip({ commit, x, y, colorIndex });
      setTooltipVisible(true);
    }, 150);
  }, []);

  const handleNodeLeave = useCallback(() => {
    if (tooltipTimeoutRef.current) clearTimeout(tooltipTimeoutRef.current);
    tooltipTimeoutRef.current = setTimeout(() => setTooltipVisible(false), 100);
  }, []);

  const handleBranchHover = useCallback((branchColorId: number) => {
    setHighlightedBranch(branchColorId);
  }, []);

  const handleBranchLeave = useCallback(() => {
    setHighlightedBranch(null);
  }, []);

  const handleCommitClick = useCallback((hash: string) => {
    setSelectedCommit((prev) => (prev === hash ? null : hash));
  }, []);

  const handleContextMenu = useCallback((commit: GitCommitType, x: number, y: number) => {
    setContextMenu({ commit, x, y });
    setContextMenuVisible(true);
  }, []);

  const handleContextMenuClose = useCallback(() => {
    setContextMenuVisible(false);
  }, []);

  const handleContextMenuAction = useCallback(
    async (actionId: string, commit: GitCommitType) => {
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
      }
    },
    [repoPath, send],
  );

  // Loading / error / empty states
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
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-border bg-muted/20">
        <BranchFilter
          branches={branches}
          visibleBranches={visibleBranches}
          onToggleBranch={handleToggleBranch}
          onShowAll={handleShowAllBranches}
          onHideAll={handleHideAllBranches}
        />
      </div>

      {/* Virtualized graph */}
      <div
        className="overflow-auto relative flex-1"
        ref={containerRef}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: "relative" }}>
          {visibleRows.map((row, vi) => {
            const rowIndex = firstVisible + vi;
            return (
              <CommitRow
                key={row.commit.hash}
                row={row}
                rowIndex={rowIndex}
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
            );
          })}
        </div>

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

// ---------------------------------------------------------------------------
// CommitRow
// ---------------------------------------------------------------------------

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
  rowIndex: number;
  graphWidth: number;
  highlightedBranch: number | null;
  selectedCommit: string | null;
  onNodeHover: (commit: GitCommitType, x: number, y: number, colorIndex: number) => void;
  onNodeLeave: () => void;
  onBranchHover: (branchColorId: number) => void;
  onBranchLeave: () => void;
  onCommitClick: (hash: string) => void;
  onContextMenu: (commit: GitCommitType, x: number, y: number) => void;
  viewConfig: ViewConfig;
}

const CommitRow = memo(function CommitRow({
  row,
  rowIndex,
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
  const [copied, setCopied] = useState(false);
  const { commit, lane, colorId, edges } = row;
  const formattedDate = formatCommitDate(commit.date);
  const isHead = commit.refs?.some((r) => r.includes("HEAD"));
  const isMerge = (commit.parents?.length ?? 0) > 1;
  const isSelected = selectedCommit === commit.hash;
  const nodeColor = getBranchColorBase(colorId);

  const { rowHeight: ROW_HEIGHT, colWidth: COL_WIDTH, showAuthor, messageMaxLength, fontSize } = viewConfig;
  const OFFSET = 20;
  const midY = ROW_HEIGHT / 2;
  const nodeX = OFFSET + lane * COL_WIDTH;

  return (
    <div
      className={`flex items-stretch transition-colors ${isSelected ? "bg-muted/50" : "hover:bg-muted/30"}`}
      style={{
        height: ROW_HEIGHT,
        position: "absolute",
        top: rowIndex * ROW_HEIGHT,
        left: 0,
        right: 0,
      }}
    >
      {/* Graph column */}
      <div className="flex-shrink-0 relative" style={{ width: graphWidth, height: ROW_HEIGHT }}>
        <svg width={graphWidth} height={ROW_HEIGHT} className="absolute inset-0">
          {edges.map((edge, idx) => {
            const startX = OFFSET + edge.fromLane * COL_WIDTH;
            const endX = OFFSET + edge.toLane * COL_WIDTH;
            const isHl = highlightedBranch === edge.colorId;
            const isDimmed = highlightedBranch !== null && !isHl;

            let startY: number, endY: number;
            if (edge.type === "vertical") {
              startY = 0;
              endY = ROW_HEIGHT;
            } else if (edge.type === "merge-in") {
              startY = midY;
              endY = ROW_HEIGHT;
            } else {
              startY = midY;
              endY = ROW_HEIGHT;
            }

            return (
              <GraphLine
                key={`${edge.type}-${edge.fromLane}-${edge.toLane}-${idx}`}
                type={edge.type}
                startX={startX}
                startY={startY}
                endX={endX}
                endY={endY}
                colorIndex={edge.colorId}
                isHighlighted={isHl}
                isDimmed={isDimmed}
                onMouseEnter={() => onBranchHover(edge.colorId)}
                onMouseLeave={onBranchLeave}
              />
            );
          })}

          {/* Vertical line through the node's own lane (above node) */}
          {rowIndex > 0 && (
            <GraphLine
              type="vertical"
              startX={nodeX}
              startY={0}
              endX={nodeX}
              endY={midY}
              colorIndex={colorId}
              isHighlighted={highlightedBranch === colorId}
              isDimmed={highlightedBranch !== null && highlightedBranch !== colorId}
              onMouseEnter={() => onBranchHover(colorId)}
              onMouseLeave={onBranchLeave}
            />
          )}

          {/* Commit node */}
          <GraphNode
            x={nodeX}
            y={midY}
            colorIndex={colorId}
            isHead={isHead}
            isMerge={isMerge}
            isSelected={isSelected}
            isHighlighted={highlightedBranch === colorId}
            onMouseEnter={() => onNodeHover(commit, nodeX, midY, colorId)}
            onMouseLeave={onNodeLeave}
            onClick={() => onCommitClick(commit.hash)}
            onContextMenu={(e) => {
              e.preventDefault();
              const rect = (e.currentTarget as SVGElement).ownerSVGElement?.getBoundingClientRect();
              onContextMenu(commit, e.clientX - (rect?.left ?? 0), e.clientY - (rect?.top ?? 0));
            }}
          />
        </svg>
      </div>

      {/* Commit details */}
      <div className="flex-1 py-1 pr-4 min-w-0 border-b border-border/50 flex items-center">
        <div className="flex items-center justify-between gap-2 w-full">
          <div className="min-w-0 flex-1">
            <p className="font-medium truncate" style={{ fontSize }} title={commit.message}>
              {commit.message.length > messageMaxLength
                ? commit.message.slice(0, messageMaxLength) + "..."
                : commit.message}
            </p>
            <div className="flex items-center gap-2 mt-0.5 text-muted-foreground" style={{ fontSize: fontSize - 2 }}>
              <span
                className={`font-mono cursor-pointer transition-all ${copied ? "opacity-70" : "hover:underline"}`}
                style={{ color: nodeColor }}
                onClick={(e) => {
                  e.stopPropagation();
                  navigator.clipboard.writeText(commit.hashShort);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                title="Click to copy"
              >
                {copied ? "Copied!" : commit.hashShort}
              </span>
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
                    className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                      isTag
                        ? "bg-muted text-muted-foreground border border-border"
                        : isMain
                          ? "bg-primary/10 text-primary border border-primary/20"
                          : "bg-muted text-foreground border border-border"
                    }`}
                  >
                    {isTag ? "🏷️ " : ""}
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
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
