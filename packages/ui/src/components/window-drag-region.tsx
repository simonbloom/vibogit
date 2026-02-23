"use client";

import type React from "react";
import { cn } from "@/lib/utils";

interface WindowDragRegionProps {
  className?: string;
}

export function WindowDragRegion({ className }: WindowDragRegionProps) {
  const handleMouseDown = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch {
      // Fall back to data-tauri-drag-region behavior when API is unavailable.
    }
  };

  return (
    <div
      data-tauri-drag-region
      onMouseDown={handleMouseDown}
      className={cn("shrink-0 select-none cursor-grab active:cursor-grabbing", className)}
      aria-hidden="true"
    />
  );
}
