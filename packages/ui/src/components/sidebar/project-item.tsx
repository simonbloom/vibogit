"use client";

import { cn } from "@/lib/utils";
import { GitStatusBadge } from "./git-status-badge";
import { 
  ContextMenu, 
  ContextMenuContent, 
  ContextMenuItem, 
  ContextMenuSeparator,
  ContextMenuTrigger 
} from "@/components/ui/context-menu";
import { Folder, Terminal, Copy, Trash2 } from "lucide-react";
import type { Project, ProjectStatus } from "@/lib/projects-context";

async function safeInvoke(cmd: string, args?: Record<string, unknown>): Promise<void> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    if (typeof invoke === "function") await invoke(cmd, args);
  } catch { /* not in Tauri */ }
}

interface ProjectItemProps {
  project: Project;
  status?: ProjectStatus;
  isSelected: boolean;
  isCollapsed?: boolean;
  onClick: () => void;
  onRemove?: () => void;
}

export function ProjectItem({ 
  project, 
  status,
  isSelected, 
  isCollapsed,
  onClick,
  onRemove,
}: ProjectItemProps) {
  const statusData = status || {
    currentBranch: "main",
    uncommittedCount: 0,
    ahead: 0,
    behind: 0,
    isClean: true,
  };

  const handleOpenInFinder = async () => {
    try {
      await safeInvoke("open_in_finder", { path: project.path });
    } catch (err) {
      console.error("Failed to open in Finder:", err);
    }
  };

  const handleOpenInTerminal = async () => {
    try {
      await safeInvoke("open_terminal_with_app", { path: project.path });
    } catch (err) {
      console.error("Failed to open in Terminal:", err);
    }
  };

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(project.path);
    } catch (err) {
      console.error("Failed to copy path:", err);
    }
  };

  const handleRemove = () => {
    if (window.confirm(`Remove "${project.name}" from projects?\n\nThis will not delete the repository, only remove it from the sidebar.`)) {
      onRemove?.();
    }
  };

  const ItemContent = ({ collapsed }: { collapsed?: boolean }) => {
    if (collapsed) {
      return (
        <div
          className={cn(
            "w-full flex flex-col items-center py-2 px-1 rounded-md transition-colors cursor-pointer",
            "hover:bg-accent",
            isSelected && "bg-accent"
          )}
          title={`${project.name}\n${statusData.currentBranch}`}
        >
          <span className={cn(
            "w-2 h-2 rounded-full",
            isSelected ? "bg-primary" : "border border-muted-foreground"
          )} />
          <GitStatusBadge 
            uncommittedCount={statusData.uncommittedCount}
            ahead={statusData.ahead}
            behind={statusData.behind}
            isClean={statusData.isClean}
            className="mt-1"
          />
        </div>
      );
    }

    return (
      <div
        className={cn(
          "w-full flex items-start gap-2 p-2 rounded-md transition-colors text-left cursor-pointer",
          "hover:bg-accent",
          isSelected && "bg-accent"
        )}
      >
        <span className={cn(
          "mt-1.5 w-2 h-2 rounded-full shrink-0",
          isSelected ? "bg-primary" : "border border-muted-foreground"
        )} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium text-sm truncate">{project.name}</span>
            <GitStatusBadge 
              uncommittedCount={statusData.uncommittedCount}
              ahead={statusData.ahead}
              behind={statusData.behind}
              isClean={statusData.isClean}
            />
          </div>
          <span className="text-xs text-muted-foreground truncate block">
            {statusData.currentBranch}
          </span>
        </div>
      </div>
    );
  };

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div onClick={onClick}>
          <ItemContent collapsed={isCollapsed} />
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={handleOpenInFinder}>
          <Folder className="mr-2 h-4 w-4" />
          Open in Finder
        </ContextMenuItem>
        <ContextMenuItem onClick={handleOpenInTerminal}>
          <Terminal className="mr-2 h-4 w-4" />
          Open in Terminal
        </ContextMenuItem>
        <ContextMenuItem onClick={handleCopyPath}>
          <Copy className="mr-2 h-4 w-4" />
          Copy Path
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={handleRemove} className="text-destructive">
          <Trash2 className="mr-2 h-4 w-4" />
          Remove from List
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
