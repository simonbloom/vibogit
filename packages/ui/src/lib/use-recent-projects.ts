"use client";

import { useState, useEffect } from "react";
import type { RecentProject } from "@vibogit/shared";

const STORAGE_KEY = "vibogit-recent-projects";
const MAX_RECENT = 10;

// Local storage based implementation
// Can be replaced with Convex when configured
export function useRecentProjects() {
  const [projects, setProjects] = useState<RecentProject[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load from localStorage
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setProjects(JSON.parse(stored));
      }
    } catch {
      // Ignore errors
    }
    setIsLoading(false);
  }, []);

  const addRecentProject = async (path: string, name: string) => {
    const now = new Date().toISOString();
    
    setProjects((prev) => {
      // Remove existing entry for this path
      const filtered = prev.filter((p) => p.path !== path);
      
      // Add to front
      const updated = [
        { path, name, lastOpenedAt: now },
        ...filtered,
      ].slice(0, MAX_RECENT);
      
      // Save to localStorage
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch {
        // Ignore errors
      }
      
      return updated;
    });
  };

  return {
    projects,
    addRecentProject,
    isLoading,
  };
}
