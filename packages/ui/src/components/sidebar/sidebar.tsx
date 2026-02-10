"use client";

import { ReactNode, useState } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Settings, HelpCircle, Plus, PanelLeftClose, PanelLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDaemon } from "@/lib/daemon-context";
import type { ConnectionState } from "@vibogit/shared";

interface SidebarProps {
  children?: ReactNode | ((isCollapsed: boolean) => ReactNode);
  onAddRepository?: () => void;
  onOpenSettings?: () => void;
  className?: string;
}

const statusConfig: Record<ConnectionState, { dotClass: string; label: string }> = {
  connected: { dotClass: "bg-green-500", label: "Connected" },
  connecting: { dotClass: "bg-yellow-500", label: "Connecting..." },
  disconnected: { dotClass: "bg-red-500", label: "Disconnected" },
  error: { dotClass: "bg-red-500", label: "Error" },
};

export function Sidebar({ 
  children, 
  onAddRepository, 
  onOpenSettings,
  className 
}: SidebarProps) {
  const { state, reconnect } = useDaemon();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vibogit-sidebar-collapsed") === "true";
    }
    return false;
  });

  const { dotClass, label } = statusConfig[state.connection];
  const showReconnect = state.connection === "disconnected" || state.connection === "error";
  const isConnecting = state.connection === "connecting";

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
          {typeof children === "function" ? children(isCollapsed) : children}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-2 space-y-2">
        <Button
          variant="ghost"
          size={isCollapsed ? "icon" : "sm"}
          onClick={onAddRepository}
          className={cn(
            "w-full justify-start gap-2",
            isCollapsed && "justify-center"
          )}
          title="Add project"
        >
          <Plus className="h-4 w-4" />
          {!isCollapsed && <span>Add project</span>}
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

        {/* Connection Status */}
        <div 
          className={cn(
            "flex items-center gap-2 px-2 py-1.5 rounded-md",
            isCollapsed && "justify-center px-0"
          )}
          title={label}
        >
          <div className={cn("w-2 h-2 rounded-full shrink-0", dotClass)} />
          {!isCollapsed && (
            <>
              <span className="text-xs text-muted-foreground">{label}</span>
              {isConnecting && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
              {showReconnect && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={reconnect} 
                  className="h-5 px-1.5 text-xs ml-auto"
                >
                  Retry
                </Button>
              )}
            </>
          )}
        </div>

        {!isCollapsed && (
          <div className="px-2 pb-1">
            <span className="text-[10px] text-muted-foreground/50">v0.1.5</span>
          </div>
        )}
      </div>
    </div>
  );
}
