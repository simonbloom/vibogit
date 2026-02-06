/**
 * Color palette management for Git graph branches
 * 8 distinct, vibrant colors with glow variants
 */

export interface BranchColor {
  base: string;
  glow: string;
  dim: string;
}

// 8 distinct colors optimized for both dark and light backgrounds
// Colors chosen for visual distinction and accessibility (4.5:1+ contrast)
export const BRANCH_COLORS: BranchColor[] = [
  { base: "#3b82f6", glow: "rgba(59, 130, 246, 0.5)", dim: "rgba(59, 130, 246, 0.3)" },   // Blue
  { base: "#22c55e", glow: "rgba(34, 197, 94, 0.5)", dim: "rgba(34, 197, 94, 0.3)" },    // Green
  { base: "#f59e0b", glow: "rgba(245, 158, 11, 0.5)", dim: "rgba(245, 158, 11, 0.3)" },  // Amber
  { base: "#ef4444", glow: "rgba(239, 68, 68, 0.5)", dim: "rgba(239, 68, 68, 0.3)" },    // Red
  { base: "#8b5cf6", glow: "rgba(139, 92, 246, 0.5)", dim: "rgba(139, 92, 246, 0.3)" },  // Purple
  { base: "#ec4899", glow: "rgba(236, 72, 153, 0.5)", dim: "rgba(236, 72, 153, 0.3)" },  // Pink
  { base: "#06b6d4", glow: "rgba(6, 182, 212, 0.5)", dim: "rgba(6, 182, 212, 0.3)" },    // Cyan
  { base: "#14b8a6", glow: "rgba(20, 184, 166, 0.5)", dim: "rgba(20, 184, 166, 0.3)" },  // Teal
];

// Tag colors (distinct from branches)
export const TAG_COLOR: BranchColor = {
  base: "#eab308",
  glow: "rgba(234, 179, 8, 0.5)",
  dim: "rgba(234, 179, 8, 0.3)",
};

// HEAD indicator color
export const HEAD_COLOR = {
  ring: "#ffffff",
  ringDark: "#1f2937",
};

/**
 * Get branch color by column index (cycles after 8)
 */
export function getBranchColor(index: number): BranchColor {
  return BRANCH_COLORS[index % BRANCH_COLORS.length];
}

/**
 * Get base color string by index
 */
export function getBranchColorBase(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length].base;
}

/**
 * Get glow color string by index
 */
export function getBranchColorGlow(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length].glow;
}

/**
 * Get dimmed color string by index (for non-highlighted branches)
 */
export function getBranchColorDim(index: number): string {
  return BRANCH_COLORS[index % BRANCH_COLORS.length].dim;
}

/**
 * Generate SVG filter ID for glow effect
 */
export function getGlowFilterId(index: number): string {
  return `glow-${index % BRANCH_COLORS.length}`;
}

/**
 * Generate SVG filter definition for branch glow
 */
export function generateGlowFilter(index: number): string {
  const color = getBranchColor(index);
  const id = getGlowFilterId(index);
  
  return `
    <filter id="${id}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="0" dy="0" stdDeviation="2" flood-color="${color.base}" flood-opacity="0.6"/>
    </filter>
  `;
}

/**
 * Generate all glow filters for SVG defs
 */
export function generateAllGlowFilters(): string {
  return BRANCH_COLORS.map((_, i) => generateGlowFilter(i)).join("\n");
}
