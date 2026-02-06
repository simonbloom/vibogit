"use client";

import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
// Safe invoke that returns null when Tauri is not available (e.g. browser dev mode)
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    if (typeof invoke !== "function") return null;
    return await invoke<T>(cmd, args);
  } catch {
    return null;
  }
}

export interface Project {
  path: string;
  name: string;
  addedAt: number;
}

export interface ProjectStatus {
  path: string;
  currentBranch: string;
  uncommittedCount: number;
  ahead: number;
  behind: number;
  isClean: boolean;
}

interface ProjectsState {
  projects: Project[];
  selectedPath: string | null;
  statuses: Record<string, ProjectStatus>;
  loading: boolean;
  error: string | null;
}

type ProjectsAction =
  | { type: "SET_PROJECTS"; payload: Project[] }
  | { type: "ADD_PROJECT"; payload: Project }
  | { type: "REMOVE_PROJECT"; payload: string }
  | { type: "SELECT_PROJECT"; payload: string | null }
  | { type: "SET_STATUSES"; payload: Record<string, ProjectStatus> }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null };

const initialState: ProjectsState = {
  projects: [],
  selectedPath: null,
  statuses: {},
  loading: true,
  error: null,
};

function projectsReducer(state: ProjectsState, action: ProjectsAction): ProjectsState {
  switch (action.type) {
    case "SET_PROJECTS":
      return { ...state, projects: action.payload, loading: false };
    case "ADD_PROJECT":
      return { 
        ...state, 
        projects: [...state.projects.filter(p => p.path !== action.payload.path), action.payload] 
      };
    case "REMOVE_PROJECT":
      return { 
        ...state, 
        projects: state.projects.filter(p => p.path !== action.payload),
        selectedPath: state.selectedPath === action.payload ? null : state.selectedPath,
      };
    case "SELECT_PROJECT":
      return { ...state, selectedPath: action.payload };
    case "SET_STATUSES":
      return { ...state, statuses: action.payload };
    case "SET_LOADING":
      return { ...state, loading: action.payload };
    case "SET_ERROR":
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface ProjectsContextValue {
  state: ProjectsState;
  addProject: (path: string) => Promise<Project>;
  removeProject: (path: string) => Promise<void>;
  selectProject: (path: string | null) => void;
  refreshStatuses: () => Promise<void>;
  reorderProjects: (paths: string[]) => Promise<void>;
}

const ProjectsContext = createContext<ProjectsContextValue | null>(null);

const STATUS_REFRESH_INTERVAL = 5000;

export function ProjectsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(projectsReducer, initialState);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  const loadProjects = useCallback(async () => {
    try {
      const projects = await safeInvoke<Project[]>("get_saved_projects");
      if (!isMountedRef.current) return;
      if (projects) {
        // Tauri available: use persisted projects
        dispatch({ type: "SET_PROJECTS", payload: projects });
        if (projects.length > 0) {
          dispatch({ type: "SELECT_PROJECT", payload: projects[0].path });
        }
      } else {
        // No Tauri: just mark loading done, keep any in-memory projects
        dispatch({ type: "SET_LOADING", payload: false });
      }
    } catch (err) {
      console.error("[Projects] Failed to load projects:", err);
      if (isMountedRef.current) {
        dispatch({ type: "SET_ERROR", payload: "Failed to load projects" });
        dispatch({ type: "SET_LOADING", payload: false });
      }
    }
  }, []);

  const refreshStatuses = useCallback(async () => {
    if (state.projects.length === 0) return;
    
    try {
      const paths = state.projects.map(p => p.path);
      const statusList = await safeInvoke<ProjectStatus[]>("get_all_project_statuses", { paths });
      if (!statusList) return;
      
      if (isMountedRef.current) {
        const statusMap: Record<string, ProjectStatus> = {};
        for (const status of statusList) {
          statusMap[status.path] = status;
        }
        dispatch({ type: "SET_STATUSES", payload: statusMap });
      }
    } catch (err) {
      console.error("[Projects] Failed to refresh statuses:", err);
    }
  }, [state.projects]);

  const addProject = useCallback(async (path: string): Promise<Project> => {
    const saved = await safeInvoke<Project>("add_saved_project", { path });
    // Fallback: create project locally when Tauri is unavailable (browser dev mode)
    const project = saved ?? {
      path,
      name: path.split("/").filter(Boolean).pop() || path,
      addedAt: Date.now(),
    };
    dispatch({ type: "ADD_PROJECT", payload: project });
    dispatch({ type: "SELECT_PROJECT", payload: project.path });
    
    // Refresh statuses to include the new project
    setTimeout(refreshStatuses, 100);
    
    return project;
  }, [refreshStatuses]);

  const removeProject = useCallback(async (path: string): Promise<void> => {
    await safeInvoke("remove_saved_project", { path });
    dispatch({ type: "REMOVE_PROJECT", payload: path });
  }, []);

  const selectProject = useCallback((path: string | null) => {
    dispatch({ type: "SELECT_PROJECT", payload: path });
  }, []);

  const reorderProjects = useCallback(async (paths: string[]): Promise<void> => {
    await safeInvoke("reorder_saved_projects", { paths });
    // Reorder local state to match
    const reordered = paths
      .map(path => state.projects.find(p => p.path === path))
      .filter((p): p is Project => p !== undefined);
    dispatch({ type: "SET_PROJECTS", payload: reordered });
  }, [state.projects]);

  // Load projects on mount
  useEffect(() => {
    isMountedRef.current = true;
    loadProjects();
    
    return () => {
      isMountedRef.current = false;
    };
  }, [loadProjects]);

  // Auto-refresh statuses
  useEffect(() => {
    if (state.projects.length === 0) return;
    
    // Initial refresh
    refreshStatuses();
    
    // Set up interval
    refreshIntervalRef.current = setInterval(refreshStatuses, STATUS_REFRESH_INTERVAL);
    
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [state.projects.length, refreshStatuses]);

  // Migration: auto-add current repo on first launch
  useEffect(() => {
    const migrate = async () => {
      const migrated = localStorage.getItem("vibogit-sidebar-migrated");
      if (migrated === "true") return;
      
      // Wait for projects to load
      if (state.loading) return;
      
      // Only migrate if projects list is empty
      if (state.projects.length > 0) {
        localStorage.setItem("vibogit-sidebar-migrated", "true");
        return;
      }
      
      // Check if there's a current project from recent projects
      try {
        const recentProjects = await safeInvoke<Array<{ path: string; name: string }>>("list_recent_projects");
        if (!recentProjects) return;
        if (recentProjects.length > 0) {
          const firstRecent = recentProjects[0];
          await addProject(firstRecent.path);
          console.log(`[Migration] Added ${firstRecent.name} to projects`);
        }
      } catch (err) {
        console.error("[Migration] Failed:", err);
      }
      
      localStorage.setItem("vibogit-sidebar-migrated", "true");
    };
    
    migrate();
  }, [state.loading, state.projects.length, addProject]);

  return (
    <ProjectsContext.Provider 
      value={{ 
        state, 
        addProject, 
        removeProject, 
        selectProject, 
        refreshStatuses,
        reorderProjects,
      }}
    >
      {children}
    </ProjectsContext.Provider>
  );
}

export function useProjects() {
  const context = useContext(ProjectsContext);
  if (!context) {
    throw new Error("useProjects must be used within a ProjectsProvider");
  }
  return context;
}
