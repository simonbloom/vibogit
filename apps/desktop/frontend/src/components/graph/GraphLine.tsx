"use client";

import { memo } from "react";
import { curvePath, verticalPath, mergeInCurve, branchOutCurve } from "./utils/bezier";
import { getBranchColorBase, getBranchColorDim } from "./utils/colors";

export type LineType = "vertical" | "branch-out" | "merge-in";

export interface GraphLineProps {
  type: LineType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  colorIndex: number;
  isHighlighted?: boolean;
  isDimmed?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

const STROKE_WIDTH = 2;
const STROKE_WIDTH_HIGHLIGHTED = 3;

export const GraphLine = memo(function GraphLine({
  type,
  startX,
  startY,
  endX,
  endY,
  colorIndex,
  isHighlighted = false,
  isDimmed = false,
  onMouseEnter,
  onMouseLeave,
}: GraphLineProps) {
  const baseColor = getBranchColorBase(colorIndex);
  const dimColor = getBranchColorDim(colorIndex);
  
  const color = isDimmed ? dimColor : baseColor;
  const strokeWidth = isHighlighted ? STROKE_WIDTH_HIGHLIGHTED : STROKE_WIDTH;
  const opacity = isDimmed ? 0.4 : 1;

  let pathD: string;

  switch (type) {
    case "vertical":
      pathD = verticalPath(startX, startY, endY);
      break;
    case "merge-in":
      pathD = mergeInCurve(startX, startY, endX, endY);
      break;
    case "branch-out":
      pathD = branchOutCurve(startX, startY, endX, endY);
      break;
    default:
      pathD = verticalPath(startX, startY, endY);
  }

  return (
    <g
      className="graph-line transition-all duration-150"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {/* Glow effect for highlighted lines */}
      {isHighlighted && (
        <path
          d={pathD}
          fill="none"
          stroke={baseColor}
          strokeWidth={strokeWidth + 4}
          strokeLinecap="round"
          opacity={0.3}
          style={{ filter: "blur(3px)" }}
        />
      )}

      {/* Main line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        opacity={opacity}
        className="transition-all duration-150"
      />

      {/* Invisible wider path for easier hover detection */}
      <path
        d={pathD}
        fill="none"
        stroke="transparent"
        strokeWidth={12}
        strokeLinecap="round"
        className="cursor-pointer"
      />
    </g>
  );
});
