"use client";

import { memo } from "react";
import { Button } from "@/components/ui/button";
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
      <Button
        variant={mode === "compact" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onModeChange("compact")}
        className="h-7 px-2 gap-1.5"
        title="Compact view"
      >
        <Minimize2 className="w-3.5 h-3.5" />
        <span>Compact</span>
      </Button>
      <Button
        variant={mode === "expanded" ? "secondary" : "ghost"}
        size="sm"
        onClick={() => onModeChange("expanded")}
        className="h-7 px-2 gap-1.5"
        title="Expanded view"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Expanded</span>
      </Button>
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
    colWidth: 16,
  },
  expanded: {
    rowHeight: 44,
    nodeRadius: 5,
    headNodeRadius: 6,
    fontSize: 14,
    showAuthor: true,
    colWidth: 20,
  },
} as const;
