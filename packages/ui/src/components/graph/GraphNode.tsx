"use client";

import { memo } from "react";
import { getBranchColorBase, HEAD_COLOR } from "./utils/colors";

export interface GraphNodeProps {
  x: number;
  y: number;
  colorIndex: number;
  isHead?: boolean;
  isMerge?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const NODE_RADIUS = 5;
const HEAD_RADIUS = 6;
const MERGE_INNER_RADIUS = 3;

export const GraphNode = memo(function GraphNode({
  x,
  y,
  colorIndex,
  isHead = false,
  isMerge = false,
  isSelected = false,
  isHighlighted = false,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onContextMenu,
}: GraphNodeProps) {
  const color = getBranchColorBase(colorIndex);
  const radius = isHead ? HEAD_RADIUS : NODE_RADIUS;
  const glowIntensity = isHighlighted || isSelected ? 0.8 : 0.4;

  return (
    <g
      className="graph-node cursor-pointer transition-transform duration-150"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{ transform: isHighlighted ? "scale(1.1)" : "scale(1)", transformOrigin: `${x}px ${y}px` }}
    >
      {/* Glow/shadow effect */}
      <circle
        cx={x}
        cy={y}
        r={radius + 3}
        fill={color}
        opacity={glowIntensity}
        style={{ filter: "blur(4px)" }}
      />

      {/* HEAD outer ring */}
      {isHead && (
        <circle
          cx={x}
          cy={y}
          r={radius + 2}
          fill="none"
          stroke={HEAD_COLOR.ring}
          strokeWidth={2}
          className="animate-pulse"
          style={{ animationDuration: "2s" }}
        />
      )}

      {/* Selection ring */}
      {isSelected && !isHead && (
        <circle
          cx={x}
          cy={y}
          r={radius + 2}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="3 2"
        />
      )}

      {/* Merge commit outer circle (stroke only) */}
      {isMerge && (
        <circle
          cx={x}
          cy={y}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={2}
        />
      )}

      {/* Main node circle */}
      <circle
        cx={x}
        cy={y}
        r={isMerge ? MERGE_INNER_RADIUS : radius}
        fill={color}
      />
    </g>
  );
});
