"use client";

import { ReactNode, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Settings, HelpCircle, Plus, PanelLeftClose, PanelLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  children?: ReactNode;
  onAddRepository?: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

export function Sidebar({ 
  children, 
  onAddRepository, 
  onOpenSettings,
  className 
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vibogit-sidebar-collapsed") === "true";
    }
    return false;
  });

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("vibogit-sidebar-collapsed", String(newState));
  };

  return (
    <div 
      className={cn(
        "flex flex-col h-full bg-background border-r transition-all duration-200 ease-in-out",
        isCollapsed ? "w-12" : "w-[220px]",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <Logo size={24} className="text-foreground" />
            <span className="font-semibold text-sm">VIBOGIT</span>
          </div>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className={cn("h-8 w-8", isCollapsed && "mx-auto")}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <PanelLeftClose className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Projects Section */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        {!isCollapsed && (
          <div className="px-3 py-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Projects
            </span>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-1">
          {children}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-2 space-y-1">
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          onClick={onAddRepository}
          className={cn(
            "w-full justify-start gap-2",
            isCollapsed && "justify-center"
          )}
          title="Add repository"
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span>Add repository</span>}
        </Button>
        
        <div className={cn(
          "flex gap-1",
          isCollapsed ? "flex-col" : "flex-row"
        )}>
          <Button
            variant="ghost"
            size="icon"
            onClick={onOpenSettings}
            className="h-8 w-8"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Help"
          >
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
