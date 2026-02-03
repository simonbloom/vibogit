/**
 * Bezier curve utilities for Git graph visualization
 * Generates smooth S-curves for branch/merge lines
 */

export type Point = [number, number];

/**
 * Generate a smooth cubic bezier curve path between two points
 * Creates GitKraken-style smooth curves that exit/enter vertically
 */
export function curvePath(start: Point, end: Point): string {
  const [x1, y1] = start;
  const [x2, y2] = end;

  // GitKraken-style: control points keep X same as their anchor
  // This makes the curve exit and enter vertically (perpendicular to the line direction)
  // Control point 1: same X as start, Y at 70% toward end
  // Control point 2: same X as end, Y at 30% from start
  const cx1 = x1;
  const cy1 = y1 + (y2 - y1) * 0.7;
  const cx2 = x2;
  const cy2 = y1 + (y2 - y1) * 0.3;

  return `M ${x1} ${y1} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x2} ${y2}`;
}

/**
 * Generate a merge-in curve (branch merging into main line)
 * Curve goes from top of source column to middle of target column
 */
export function mergeInCurve(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  // For merge: curve should go down from source, then curve into target
  // Control point 1: below source, keeps vertical exit
  // Control point 2: above target, allows horizontal entry
  const cx1 = sourceX;
  const cy1 = targetY; // Control at same Y as target for smooth horizontal entry
  const cx2 = targetX;
  const cy2 = targetY;

  return `M ${sourceX} ${sourceY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${targetX} ${targetY}`;
}

/**
 * Generate a branch-out curve (new branch starting from main line)
 * Curve goes from middle of source to bottom of target column
 */
export function branchOutCurve(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number
): string {
  // For branch-out: curve should exit horizontally from source, then go down to target
  // Control point 1: right of source, keeps horizontal exit
  // Control point 2: above target, allows vertical entry
  const cx1 = sourceX;
  const cy1 = sourceY;
  const cx2 = targetX;
  const cy2 = sourceY; // Control at same Y as source for smooth horizontal exit

  return `M ${sourceX} ${sourceY} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${targetX} ${targetY}`;
}

/**
 * Generate a branch-out curve (commit spawning a new branch below)
 * Curves from node position down-right to new branch column
 */
export function branchOutPath(
  nodeX: number,
  nodeY: number,
  targetX: number,
  endY: number
): string {
  return curvePath([nodeX, nodeY], [targetX, endY]);
}

/**
 * Generate a merge-in curve (branch merging into main line)
 * Curves from branch column up-left to merge point
 */
export function mergeInPath(
  sourceX: number,
  startY: number,
  nodeX: number,
  nodeY: number
): string {
  return curvePath([sourceX, startY], [nodeX, nodeY]);
}

/**
 * Generate a vertical line path
 */
export function verticalPath(x: number, y1: number, y2: number): string {
  return `M ${x} ${y1} L ${x} ${y2}`;
}

/**
 * Calculate rounded corner path for smooth transitions
 * Used where vertical lines meet horizontal curves
 */
export function roundedCornerPath(
  startX: number,
  startY: number,
  cornerX: number,
  cornerY: number,
  endX: number,
  endY: number,
  radius: number = 6
): string {
  const dx1 = cornerX - startX;
  const dy1 = cornerY - startY;
  const dx2 = endX - cornerX;
  const dy2 = endY - cornerY;

  // Normalize directions
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

  if (len1 === 0 || len2 === 0) {
    return `M ${startX} ${startY} L ${endX} ${endY}`;
  }

  const nx1 = dx1 / len1;
  const ny1 = dy1 / len1;
  const nx2 = dx2 / len2;
  const ny2 = dy2 / len2;

  // Points before and after the corner
  const beforeX = cornerX - nx1 * radius;
  const beforeY = cornerY - ny1 * radius;
  const afterX = cornerX + nx2 * radius;
  const afterY = cornerY + ny2 * radius;

  return `M ${startX} ${startY} L ${beforeX} ${beforeY} Q ${cornerX} ${cornerY} ${afterX} ${afterY} L ${endX} ${endY}`;
}
