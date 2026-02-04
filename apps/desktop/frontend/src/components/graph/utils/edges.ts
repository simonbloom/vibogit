/**
 * Right-angle edge path utilities for Git graph visualization.
 * All edges are straight lines with small rounded corners (no bezier curves).
 */

const CORNER_RADIUS = 5;

/** Straight vertical line */
export function verticalPath(x: number, y1: number, y2: number): string {
  return `M ${x} ${y1} L ${x} ${y2}`;
}

/**
 * Merge-in: source column merges into target (node) column.
 * Goes vertical down from source, rounded corner, then horizontal to target.
 */
export function mergeInPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  if (sourceX === targetX) {
    return verticalPath(sourceX, sourceY, targetY);
  }
  const r = Math.min(CORNER_RADIUS, Math.abs(targetX - sourceX) / 2, Math.abs(targetY - sourceY) / 2);
  const dir = targetX > sourceX ? 1 : -1;
  // Vertical down, then rounded corner, then horizontal to target
  return [
    `M ${sourceX} ${sourceY}`,
    `L ${sourceX} ${targetY - r}`,
    `Q ${sourceX} ${targetY} ${sourceX + dir * r} ${targetY}`,
    `L ${targetX} ${targetY}`,
  ].join(" ");
}

/**
 * Branch-out: node column spawns a new branch in target column.
 * Goes horizontal from source, rounded corner, then vertical down.
 */
export function branchOutPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  if (sourceX === targetX) {
    return verticalPath(sourceX, sourceY, targetY);
  }
  const r = Math.min(CORNER_RADIUS, Math.abs(targetX - sourceX) / 2, Math.abs(targetY - sourceY) / 2);
  const dir = targetX > sourceX ? 1 : -1;
  // Horizontal from source, then rounded corner, then vertical down
  return [
    `M ${sourceX} ${sourceY}`,
    `L ${targetX - dir * r} ${sourceY}`,
    `Q ${targetX} ${sourceY} ${targetX} ${sourceY + r}`,
    `L ${targetX} ${targetY}`,
  ].join(" ");
}
