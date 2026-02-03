import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import type { ProjectInfo } from "@vibogit/shared";

const CONFIG_DIR = join(homedir(), ".vibogit");
const RECENT_FILE = join(CONFIG_DIR, "recent_projects.json");

let currentProject: ProjectInfo | null = null;
let recentProjects: ProjectInfo[] = [];

// Load on startup
loadRecentProjects();

function loadRecentProjects(): void {
  try {
    if (existsSync(RECENT_FILE)) {
      const content = readFileSync(RECENT_FILE, "utf-8");
      recentProjects = JSON.parse(content);
    }
  } catch {
    recentProjects = [];
  }
}

function saveRecentProjects(): void {
  try {
    if (!existsSync(CONFIG_DIR)) {
      mkdirSync(CONFIG_DIR, { recursive: true });
    }
    writeFileSync(RECENT_FILE, JSON.stringify(recentProjects, null, 2));
  } catch (error) {
    console.error("Failed to save recent projects:", error);
  }
}

export async function setCurrentProject(path: string): Promise<ProjectInfo> {
  const name = path.split("/").pop() || path;

  currentProject = {
    path,
    name,
    lastOpened: Date.now(),
  };

  // Update recent projects
  recentProjects = recentProjects.filter((p) => p.path !== path);
  recentProjects.unshift(currentProject);
  if (recentProjects.length > 10) {
    recentProjects = recentProjects.slice(0, 10);
  }
  saveRecentProjects();

  return currentProject;
}

export function getCurrentProject(): ProjectInfo | null {
  return currentProject;
}

export function getRecentProjects(): ProjectInfo[] {
  // Filter out non-existent paths
  return recentProjects.filter((p) => existsSync(p.path));
}
