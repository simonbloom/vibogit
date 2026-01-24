"use client";

import { memo } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

export type ViewMode = "compact" | "expanded";

export interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export const ViewModeToggle = memo(function ViewModeToggle({
  mode,
  onModeChange,
}: ViewModeToggleProps) {
  return (
    <div className="flex items-center bg-muted/50 rounded-md border border-border p-0.5">
      <button
        onClick={() => onModeChange("compact")}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
          mode === "compact"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Compact view"
      >
        <Minimize2 className="w-3.5 h-3.5" />
        <span>Compact</span>
      </button>
      <button
        onClick={() => onModeChange("expanded")}
        className={`flex items-center gap-1.5 px-2 py-1 text-xs rounded transition-colors ${
          mode === "expanded"
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
        title="Expanded view"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Expanded</span>
      </button>
    </div>
  );
});

// View mode configuration
export const VIEW_MODE_CONFIG = {
  compact: {
    rowHeight: 32,
    nodeRadius: 3,
    headNodeRadius: 4,
    fontSize: 11,
    showAuthor: false,
    messageMaxLength: 45,
    colWidth: 16,
  },
  expanded: {
    rowHeight: 44,
    nodeRadius: 5,
    headNodeRadius: 6,
    fontSize: 12,
    showAuthor: true,
    messageMaxLength: 60,
    colWidth: 20,
  },
} as const;
