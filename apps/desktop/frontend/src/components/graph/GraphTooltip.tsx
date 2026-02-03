"use client";

import { memo, useEffect, useState } from "react";
import type { GitCommit } from "@vibogit/shared";
import { getBranchColorBase } from "./utils/colors";

export interface GraphTooltipProps {
  commit: GitCommit | null;
  x: number;
  y: number;
  visible: boolean;
  colorIndex?: number;
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const GraphTooltip = memo(function GraphTooltip({
  commit,
  x,
  y,
  visible,
  colorIndex = 0,
  containerRef,
}: GraphTooltipProps) {
  const [position, setPosition] = useState({ x, y });
  const [opacity, setOpacity] = useState(0);

  useEffect(() => {
    if (visible && commit) {
      // Adjust position to avoid overflow
      let adjustedX = x + 20;
      let adjustedY = y - 10;

      if (containerRef?.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const tooltipWidth = 280;
        const tooltipHeight = 120;

        // Prevent right overflow
        if (adjustedX + tooltipWidth > containerRect.width) {
          adjustedX = x - tooltipWidth - 10;
        }

        // Prevent bottom overflow
        if (adjustedY + tooltipHeight > containerRect.height) {
          adjustedY = y - tooltipHeight;
        }

        // Prevent top overflow
        if (adjustedY < 0) {
          adjustedY = 10;
        }
      }

      setPosition({ x: adjustedX, y: adjustedY });
      // Slight delay for smooth fade in
      requestAnimationFrame(() => setOpacity(1));
    } else {
      setOpacity(0);
    }
  }, [visible, commit, x, y, containerRef]);

  if (!commit || !visible) return null;

  const accentColor = getBranchColorBase(colorIndex);
  const isMerge = (commit.parents?.length ?? 0) > 1;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div
      className="absolute z-50 pointer-events-none transition-opacity duration-150"
      style={{
        left: position.x,
        top: position.y,
        opacity,
      }}
      role="tooltip"
      aria-label={`Commit details for ${commit.hashShort}`}
    >
      <div
        className="bg-popover border border-border rounded-lg shadow-xl p-3 min-w-[260px] max-w-[320px]"
        style={{ borderLeftColor: accentColor, borderLeftWidth: 3 }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-2">
          <span
            className="font-mono text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
          >
            {commit.hashShort}
          </span>
          {isMerge && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300">
              Merge
            </span>
          )}
        </div>

        {/* Author & Date */}
        <div className="text-xs text-muted-foreground mb-2">
          <div className="font-medium text-foreground">{commit.author}</div>
          <div>{formatDate(commit.date)}</div>
        </div>

        {/* Message */}
        <div className="text-sm text-foreground border-t border-border pt-2 mt-2">
          <p className="line-clamp-3">{commit.message}</p>
        </div>

        {/* Refs */}
        {commit.refs && commit.refs.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border">
            {commit.refs.slice(0, 4).map((ref, i) => {
              const isTag = ref.startsWith("tag:");
              const label = ref.includes("->") ? ref.split("->")[1]?.trim() : ref;
              return (
                <span
                  key={i}
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    isTag
                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
                      : "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
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
  );
});
