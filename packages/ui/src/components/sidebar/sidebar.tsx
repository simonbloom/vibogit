"use client";

import React, { ReactNode, useEffect, useState } from "react";
import { Logo } from "@/components/logo";
import { WindowDragRegion } from "@/components/window-drag-region";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";
import { Settings, Plus, PanelLeftClose, PanelLeft, Sun, Moon, Flame, Binary, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarProps {
  children?: ReactNode | ((isCollapsed: boolean) => ReactNode);
  onAddRepository?: () => void;
  onOpenSettings?: () => void;
  isSettingsActive?: boolean;
  isMacOverlayChrome?: boolean;
  className?: string;
}

const THEME_SEQUENCE = ["light", "dark", "ember", "matrix", "system"] as const;
type ThemeMode = (typeof THEME_SEQUENCE)[number];

const THEME_ICON_MAP: Record<
  ThemeMode,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
  }
> = {
  light: { icon: Sun, label: "Light" },
  dark: { icon: Moon, label: "Dark" },
  ember: { icon: Flame, label: "Ember" },
  matrix: { icon: Binary, label: "Matrix" },
  system: { icon: Monitor, label: "System" },
};

function normalizeTheme(theme: string | undefined): ThemeMode {
  if (theme && THEME_SEQUENCE.includes(theme as ThemeMode)) {
    return theme as ThemeMode;
  }
  return "system";
}

export function Sidebar({ 
  children, 
  onAddRepository, 
  onOpenSettings,
  isSettingsActive = false,
  isMacOverlayChrome = false,
  className 
}: SidebarProps) {
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("vibogit-sidebar-collapsed") === "true";
    }
    return false;
  });
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  const toggleCollapsed = () => {
    const newState = !isCollapsed;
    setIsCollapsed(newState);
    localStorage.setItem("vibogit-sidebar-collapsed", String(newState));
  };
  useEffect(() => {
    setMounted(true);
  }, []);

  const currentTheme = normalizeTheme(theme);
  const currentIndex = THEME_SEQUENCE.indexOf(currentTheme);
  const nextTheme = THEME_SEQUENCE[(currentIndex + 1) % THEME_SEQUENCE.length];
  const ThemeIcon = THEME_ICON_MAP[currentTheme].icon;
  const nextThemeLabel = THEME_ICON_MAP[nextTheme].label;

  const handleThemeCycle = () => {
    setTheme(nextTheme);
  };

  return (
    <div 
      data-sidebar="sidebar"
      className={cn(
        "flex flex-col h-full bg-sidebar border-r transition-all duration-200 ease-in-out",
        isCollapsed ? "w-16" : "w-[220px]",
        className
      )}
    >
      {isMacOverlayChrome && <WindowDragRegion className="h-9" />}

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
        <div className="px-2 py-2">
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
        </div>
        <div className="flex-1 overflow-y-auto">
          {typeof children === "function" ? children(isCollapsed) : children}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t p-2">
        <div className={cn(
          "flex items-center",
          isCollapsed ? "justify-center gap-2" : "justify-between"
        )}>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={onOpenSettings}
              className={cn("h-8 w-8", isSettingsActive && "bg-muted text-foreground")}
              title="Settings"
              aria-pressed={isSettingsActive}
            >
              <Settings className="h-4 w-4" />
            </Button>
            {mounted && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleThemeCycle}
                className="h-8 w-8"
                title={`Theme: ${THEME_ICON_MAP[currentTheme].label} (next: ${nextThemeLabel})`}
                aria-label={`Switch to ${nextThemeLabel} theme`}
              >
                <ThemeIcon className="h-4 w-4" />
              </Button>
            )}
            {!mounted && <Button variant="ghost" size="icon" className="h-8 w-8" disabled><Sun className="h-4 w-4" /></Button>}
          </div>
          {!isCollapsed && (
            <span className="pr-1 text-[10px] text-muted-foreground/50">v3.7.6</span>
          )}
        </div>
      </div>
    </div>
  );
}
