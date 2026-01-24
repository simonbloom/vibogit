"use client";

import { useTheme } from "next-themes";
import { Sun, Moon, Monitor, Flame, Binary } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useEffect, useState } from "react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-foreground mb-2">
          Theme
        </label>
        <p className="text-sm text-muted-foreground">
          Choose how the app looks to you.
        </p>
      </div>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(value) => value && setTheme(value)}
        className="justify-start flex-wrap"
      >
        <ToggleGroupItem value="light" aria-label="Light mode" className="gap-2">
          <Sun className="h-4 w-4" />
          Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark" aria-label="Dark mode" className="gap-2">
          <Moon className="h-4 w-4" />
          Dark
        </ToggleGroupItem>
        <ToggleGroupItem value="ember" aria-label="Ember mode" className="gap-2">
          <Flame className="h-4 w-4" />
          Ember
        </ToggleGroupItem>
        <ToggleGroupItem value="matrix" aria-label="Matrix mode" className="gap-2">
          <Binary className="h-4 w-4" />
          Matrix
        </ToggleGroupItem>
        <ToggleGroupItem value="system" aria-label="System preference" className="gap-2">
          <Monitor className="h-4 w-4" />
          System
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
