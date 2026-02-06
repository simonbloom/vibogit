"use client";

import { memo, useEffect, useRef } from "react";
import type { GitCommit } from "@vibogit/shared";
import { Button } from "@/components/ui/button";
import { Copy, GitBranch, Eye, RotateCcw, CherryIcon } from "lucide-react";

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  separator?: boolean;
}

export interface GraphContextMenuProps {
  commit: GitCommit | null;
  x: number;
  y: number;
  visible: boolean;
  onAction: (actionId: string, commit: GitCommit) => void;
  onClose: () => void;
}

const MENU_ACTIONS: ContextMenuAction[] = [
  { id: "copy-sha", label: "Copy SHA", icon: <Copy className="w-3.5 h-3.5" />, shortcut: "⌘C" },
  { id: "copy-sha-full", label: "Copy Full SHA", icon: <Copy className="w-3.5 h-3.5" /> },
  { id: "separator-1", label: "", icon: null, separator: true },
  { id: "view-diff", label: "View Diff", icon: <Eye className="w-3.5 h-3.5" /> },
  { id: "checkout", label: "Checkout", icon: <GitBranch className="w-3.5 h-3.5" />, shortcut: "⌘⇧O" },
  { id: "separator-2", label: "", icon: null, separator: true },
  { id: "cherry-pick", label: "Cherry Pick", icon: <CherryIcon className="w-3.5 h-3.5" /> },
  { id: "revert", label: "Revert", icon: <RotateCcw className="w-3.5 h-3.5" />, danger: true },
];

export const GraphContextMenu = memo(function GraphContextMenu({
  commit,
  x,
  y,
  visible,
  onAction,
  onClose,
}: GraphContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!visible) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [visible, onClose]);

  if (!visible || !commit) return null;

  const handleAction = (actionId: string) => {
    onAction(actionId, commit);
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="absolute z-50 bg-popover border border-border rounded-lg shadow-xl py-1 min-w-[180px] animate-in fade-in-0 zoom-in-95"
      style={{ left: x, top: y }}
      role="menu"
      aria-label="Commit actions"
    >
      {MENU_ACTIONS.map((action) => {
        if (action.separator) {
          return <div key={action.id} className="h-px bg-border my-1" role="separator" />;
        }

        return (
          <Button
            key={action.id}
            variant="ghost"
            onClick={() => handleAction(action.id)}
            disabled={action.disabled}
            className={`w-full justify-start px-3 py-1.5 h-auto rounded-none gap-2 ${
              action.danger ? "text-destructive hover:bg-destructive/10" : ""
            }`}
            role="menuitem"
          >
            <span className="flex-shrink-0 text-muted-foreground">{action.icon}</span>
            <span className="flex-1 text-left">{action.label}</span>
            {action.shortcut && (
              <span className="text-xs text-muted-foreground">{action.shortcut}</span>
            )}
          </Button>
        );
      })}
    </div>
  );
});
