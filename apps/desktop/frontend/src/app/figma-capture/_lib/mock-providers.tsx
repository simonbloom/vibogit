"use client";

import { useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import type {
  Config,
  DaemonState,
  GitBranch,
  GitHubRepo,
  GitStatus,
  Skill,
} from "@vibogit/shared";
import { DaemonContext } from "@vibogit/ui/lib/daemon-context";
import { ProjectsContext, type Project, type ProjectStatus } from "@vibogit/ui/lib/projects-context";
import { ConfigContext } from "@vibogit/ui/lib/config-context";
import { TabsContext } from "@vibogit/ui/lib/tabs-context";
import {
  MOCK_AUTH_STATUS,
  MOCK_BRANCHES,
  MOCK_COMMITS,
  MOCK_CONFIG,
  MOCK_DEV_SERVER_CONFIG,
  MOCK_DEV_SERVER_DIAGNOSIS,
  MOCK_DEV_SERVER_STATE,
  MOCK_DIFFS,
  MOCK_FILE_CONTENTS,
  MOCK_FILE_TREE,
  MOCK_GITHUB_REPOS,
  MOCK_PROJECTS,
  MOCK_PROJECT_STATUSES,
  MOCK_REMOTES,
  MOCK_REPO_PATH,
  MOCK_SKILLS,
  MOCK_STATUS,
  createReadyDaemonState,
} from "./mock-data";

type SendHandler = (payload?: unknown) => Promise<unknown> | unknown;

interface FigmaMockProvidersProps {
  children: ReactNode;
  daemonState?: DaemonState;
  config?: Config;
  projects?: Project[];
  selectedProjectPath?: string | null;
  projectStatuses?: Record<string, ProjectStatus>;
  skills?: Skill[];
  sendOverrides?: Record<string, SendHandler>;
}

function withCurrentBranch(branches: GitBranch[], currentName: string): GitBranch[] {
  return branches.map((branch) => ({
    ...branch,
    current: branch.name === currentName,
  }));
}

function normalizeProject(path: string): Project {
  return {
    path,
    name: path.split("/").filter(Boolean).pop() || path,
    addedAt: Date.now(),
  };
}

export function FigmaMockProviders({
  children,
  daemonState = createReadyDaemonState(),
  config = MOCK_CONFIG,
  projects = MOCK_PROJECTS,
  selectedProjectPath = daemonState.repoPath ?? MOCK_REPO_PATH,
  projectStatuses = MOCK_PROJECT_STATUSES,
  skills = MOCK_SKILLS,
  sendOverrides = {},
}: FigmaMockProvidersProps) {
  const [daemon, setDaemon] = useState<DaemonState>(daemonState);
  const daemonRef = useRef(daemon);
  daemonRef.current = daemon;

  const [configState, setConfigState] = useState<Config>(config);
  const [projectsState, setProjectsState] = useState(() => ({
    projects,
    selectedPath: selectedProjectPath,
    statuses: projectStatuses,
    favicons: {} as Record<string, null>,
    loading: false,
    error: null as string | null,
  }));

  const [tabs, setTabs] = useState(() =>
    (config.recentTabs || []).map((tab) => ({
      ...tab,
      favicon: null,
      faviconMimeType: null,
    }))
  );
  const [activeTabId, setActiveTabId] = useState<string | null>(config.activeTabId);

  const setRepoPath = useCallback(async (path: string | null) => {
    setDaemon((current) => ({
      ...current,
      repoPath: path,
      status: path ? current.status ?? MOCK_STATUS : null,
      branches: path ? current.branches.length ? current.branches : MOCK_BRANCHES : [],
      error: path ? current.error : null,
    }));
  }, []);

  const refreshStatus = useCallback(async () => {
    setDaemon((current) => ({ ...current }));
  }, []);

  const refreshBranches = useCallback(async () => {
    setDaemon((current) => ({ ...current, branches: current.branches.length ? current.branches : MOCK_BRANCHES }));
  }, []);

  const reconnect = useCallback(() => {
    setDaemon((current) => ({ ...current, connection: "connected", error: null }));
  }, []);

  const send = useCallback(
    async <T = unknown,>(type: string, payload?: unknown): Promise<T> => {
      const override = sendOverrides[type];
      if (override) {
        return (await override(payload)) as T;
      }

      switch (type) {
        case "status":
          return { status: daemonRef.current.status ?? MOCK_STATUS } as T;
        case "branches":
          return { branches: daemonRef.current.branches.length ? daemonRef.current.branches : MOCK_BRANCHES } as T;
        case "isGitRepo":
          return { isRepo: true } as T;
        case "watch":
        case "openBrowser":
        case "openFinder":
        case "openTerminal":
        case "sendToTerminal":
        case "openEditor":
        case "killPort":
        case "writeAgentsConfig":
        case "writeDevScriptPort":
        case "cleanupDevLocks":
          return {} as T;
        case "checkout": {
          const nextBranch = ((payload as { branch?: string; ref?: string } | undefined)?.branch
            || (payload as { branch?: string; ref?: string } | undefined)?.ref
            || MOCK_BRANCHES[0].name) as string;
          setDaemon((current) => ({
            ...current,
            branches: withCurrentBranch(current.branches.length ? current.branches : MOCK_BRANCHES, nextBranch),
            status: current.status ? { ...current.status, branch: nextBranch } : current.status,
          }));
          return {} as T;
        }
        case "createBranch": {
          const branchName = (payload as { name?: string } | undefined)?.name || "preview-branch";
          setDaemon((current) => ({
            ...current,
            branches: withCurrentBranch(
              [...(current.branches.length ? current.branches : MOCK_BRANCHES), { name: branchName, current: true }],
              branchName
            ),
            status: current.status ? { ...current.status, branch: branchName } : current.status,
          }));
          return {} as T;
        }
        case "stashSave":
        case "stashPop":
        case "pull":
        case "push":
        case "fetch":
          return {} as T;
        case "commit":
          setDaemon((current) => ({
            ...current,
            status: current.status
              ? {
                  ...current.status,
                  staged: [],
                  unstaged: [],
                  untracked: [],
                  ahead: current.status.ahead + 1,
                }
              : current.status,
          }));
          return { hash: MOCK_COMMITS[0].hash, message: (payload as { message?: string } | undefined)?.message || "" } as T;
        case "stage":
        case "unstage":
          return {} as T;
        case "listFiles":
          return { tree: MOCK_FILE_TREE } as T;
        case "readFile": {
          const filePath = (payload as { filePath?: string } | undefined)?.filePath || "";
          return { content: MOCK_FILE_CONTENTS[filePath] || `// No mock file content for ${filePath}\n` } as T;
        }
        case "diff": {
          const file = (payload as { file?: string } | undefined)?.file || "";
          return {
            diff: MOCK_DIFFS[file] || {
              path: file,
              isBinary: false,
              hunks: [],
            },
          } as T;
        }
        case "log":
          return { commits: MOCK_COMMITS } as T;
        case "getRemotes":
          return { remotes: MOCK_REMOTES } as T;
        case "githubResolveAuthSource":
          return MOCK_AUTH_STATUS as T;
        case "githubListRepos": {
          const args = (payload as { query?: string; page?: number; perPage?: number } | undefined) || {};
          const query = (args.query || "").toLowerCase();
          const filteredRepos = query
            ? MOCK_GITHUB_REPOS.filter((repo) => repo.fullName.toLowerCase().includes(query))
            : MOCK_GITHUB_REPOS;
          return {
            repos: filteredRepos,
            page: args.page || 1,
            perPage: args.perPage || 20,
            hasMore: filteredRepos.length >= 3,
            authSource: MOCK_AUTH_STATUS.source,
            authLogin: MOCK_AUTH_STATUS.login,
          } as T;
        }
        case "gitCloneIntoFolder":
          return {} as T;
        case "readAgentsConfig":
          return {
            config: {
              port: 4158,
              devCommand: "bun",
              devArgs: ["run", "dev"],
              found: true,
              filePath: "/Users/simonbloom/apps-vol11/vibogit/agents.md",
              isMonorepo: false,
            },
          } as T;
        case "devServerDetect":
          return { config: MOCK_DEV_SERVER_CONFIG } as T;
        case "devServerState":
          return { state: MOCK_DEV_SERVER_STATE } as T;
        case "devServerDiagnose":
          return { diagnosis: MOCK_DEV_SERVER_DIAGNOSIS } as T;
        case "getConfig":
          return { config: configState } as T;
        case "setConfig": {
          const patch = (payload as { config?: Partial<Config> } | undefined)?.config || {};
          const next = { ...configState, ...patch };
          setConfigState(next);
          return { config: next } as T;
        }
        case "getFavicon":
          return { favicon: null, mimeType: null } as T;
        case "pickFolder":
        case "openFolder":
          return { path: MOCK_REPO_PATH } as T;
        case "list-skills":
        case "skills-list":
          return { skills } as T;
        default:
          return {} as T;
      }
    },
    [configState, sendOverrides, skills]
  );

  const addProject = useCallback(async (path: string) => {
    const project = normalizeProject(path);
    setProjectsState((current) => ({
      ...current,
      projects: [...current.projects.filter((item) => item.path !== path), project],
      selectedPath: path,
    }));
    return project;
  }, []);

  const removeProject = useCallback(async (path: string) => {
    setProjectsState((current) => ({
      ...current,
      projects: current.projects.filter((item) => item.path !== path),
      selectedPath: current.selectedPath === path ? null : current.selectedPath,
    }));
  }, []);

  const selectProject = useCallback((path: string | null) => {
    setProjectsState((current) => ({ ...current, selectedPath: path }));
  }, []);

  const refreshStatuses = useCallback(async () => {
    setProjectsState((current) => ({ ...current }));
  }, []);

  const reorderProjects = useCallback(async (paths: string[]) => {
    setProjectsState((current) => {
      const byPath = new Map(current.projects.map((project) => [project.path, project]));
      return {
        ...current,
        projects: paths.map((path) => byPath.get(path)).filter((project): project is Project => Boolean(project)),
      };
    });
  }, []);

  const addTab = useCallback((repoPath: string) => {
    const existing = tabs.find((tab) => tab.repoPath === repoPath);
    if (existing) {
      setActiveTabId(existing.id);
      return existing;
    }

    const newTab = {
      id: `tab-${tabs.length + 1}`,
      repoPath,
      name: repoPath.split("/").filter(Boolean).pop() || repoPath,
      favicon: null,
      faviconMimeType: null,
    };
    setTabs((current) => [...current, newTab]);
    setActiveTabId(newTab.id);
    return newTab;
  }, [tabs]);

  const removeTab = useCallback((tabId: string) => {
    setTabs((current) => current.filter((tab) => tab.id !== tabId));
    setActiveTabId((current) => (current === tabId ? null : current));
  }, []);

  const getActiveTab = useCallback(() => tabs.find((tab) => tab.id === activeTabId), [activeTabId, tabs]);

  const daemonValue = useMemo(
    () => ({
      state: daemon,
      send,
      setRepoPath,
      refreshStatus,
      refreshBranches,
      reconnect,
      getConfigPath: async () => "",
      getHostname: async () => "Mock Machine",
    }),
    [daemon, reconnect, refreshBranches, refreshStatus, send, setRepoPath]
  );

  const projectsValue = useMemo(
    () => ({
      state: projectsState,
      addProject,
      removeProject,
      selectProject,
      refreshStatuses,
      reorderProjects,
    }),
    [addProject, projectsState, refreshStatuses, removeProject, reorderProjects, selectProject]
  );

  const configValue = useMemo(
    () => ({
      config: configState,
      async setConfig(partial: Partial<Config>) {
        setConfigState((current) => ({ ...current, ...partial }));
      },
      isLoading: false,
      isSaving: false,
      lastSaveError: null,
    }),
    [configState]
  );

  const tabsValue = useMemo(
    () => ({
      tabs,
      activeTabId,
      addTab,
      removeTab,
      setActiveTab: setActiveTabId,
      getActiveTab,
    }),
    [activeTabId, addTab, getActiveTab, removeTab, tabs]
  );

  return (
    <DaemonContext.Provider value={daemonValue}>
      <ProjectsContext.Provider value={projectsValue}>
        <ConfigContext.Provider value={configValue}>
          <TabsContext.Provider value={tabsValue}>{children}</TabsContext.Provider>
        </ConfigContext.Provider>
      </ProjectsContext.Provider>
    </DaemonContext.Provider>
  );
}
