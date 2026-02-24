"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { useProjects } from "@/lib/projects-context";
import { getSettings, TERMINAL_OPTIONS, EDITOR_OPTIONS } from "@/lib/settings";
import { getModelForProvider } from "@/lib/ai-service";
import {
  emitCrossWindow,
  MINI_PROJECT_CHANGED,
  MINI_COMMIT_COMPLETE,
  MAIN_PROJECT_CHANGED,
  type ProjectChangedPayload,
} from "@/lib/mini-view-events";
import {
  Folder,
  ExternalLink,
  Github,
  Terminal,
  Code,
  X,
  GripVertical,
  Loader2,
  Check,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  RefreshCw,
  GitCommitVertical,
  GitPullRequest,
} from "lucide-react";
import { toast } from "sonner";
import type { DevServerState, DevServerConfig } from "@vibogit/shared";

type DevStatus = "disconnected" | "connecting" | "connected" | "error";

export function MiniView() {
  const { state, send, refreshStatus, setRepoPath } = useDaemon();
  const { state: projectsState, selectProject } = useProjects();
  const { status, repoPath } = state;

  const [isCommitting, setIsCommitting] = useState(false);
  const [commitIcon, setCommitIcon] = useState<"default" | "loading" | "check">("default");
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  // Dev server state
  const [devStatus, setDevStatus] = useState<DevStatus>("disconnected");
  const [devPort, setDevPort] = useState<number | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  // Listen for cross-window project changes
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const setup = async () => {
      try {
        if (typeof window === "undefined" || !("__TAURI__" in window)) return;
        const { listen } = await import("@tauri-apps/api/event");
        unlisten = await listen<ProjectChangedPayload>(MAIN_PROJECT_CHANGED, (event) => {
          if (event.payload?.path) {
            selectProject(event.payload.path);
          }
        });
      } catch { /* not in Tauri */ }
    };
    setup();
    return () => { unlisten?.(); };
  }, [selectProject]);

  // Sync selected project with daemon
  useEffect(() => {
    const selectedPath = projectsState.selectedPath;
    if (selectedPath && selectedPath !== repoPath) {
      setRepoPath(selectedPath);
    }
  }, [projectsState.selectedPath, repoPath, setRepoPath]);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
  }, []);

  // Dev server: reset and re-check when project changes
  useEffect(() => {
    stopPolling();
    setDevStatus("disconnected");
    setDevPort(null);

    if (!repoPath) return;

    const checkState = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", { path: repoPath });
        if (response.state.running) {
          setDevStatus("connected");
          setDevPort(response.state.port || null);
        }
      } catch { /* ignore */ }
    };

    checkState();
  }, [repoPath, send, stopPolling]);

  useEffect(() => { return () => stopPolling(); }, [stopPolling]);

  const handleDevConnect = async () => {
    if (!repoPath || devStatus === "connecting" || devStatus === "connected") return;
    setDevStatus("connecting");

    try {
      const configResponse = await send<{ config: DevServerConfig | null }>("devServerDetect", { path: repoPath });
      const port = configResponse.config?.port || 3000;
      setDevPort(port);

      await send("devServerStart", { path: repoPath, config: configResponse.config });

      // Poll for connection
      let elapsed = 0;
      pollingRef.current = setInterval(async () => {
        elapsed += 2000;
        try {
          const stateResponse = await send<{ state: DevServerState }>("devServerState", { path: repoPath });
          if (stateResponse.state.running) {
            setDevStatus("connected");
            setDevPort(stateResponse.state.port || port);
            stopPolling();
          }
        } catch { /* keep polling */ }

        if (elapsed >= 30000) {
          setDevStatus("error");
          stopPolling();
        }
      }, 2000);

      timeoutRef.current = setTimeout(() => {
        setDevStatus((current) => current === "connecting" ? "error" : current);
        stopPolling();
      }, 30000);
    } catch {
      setDevStatus("error");
    }
  };

  const handleDevClick = async () => {
    if (devStatus === "connected" && devPort) {
      try {
        await send("openBrowser", { url: `http://localhost:${devPort}` });
      } catch { /* ignore */ }
    } else if (devStatus === "disconnected" || devStatus === "error") {
      handleDevConnect();
    }
  };

  const handleDrag = async (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().startDragging();
    } catch { /* fallback */ }
  };

  const handleClose = async () => {
    try {
      const { getCurrentWindow } = await import("@tauri-apps/api/window");
      await getCurrentWindow().close();
    } catch { /* fallback */ }
  };

  const handleProjectChange = (path: string) => {
    selectProject(path);
    setRepoPath(path);
    emitCrossWindow(MINI_PROJECT_CHANGED, { path });
  };

  const handleQuickLink = async (type: "finder" | "terminal" | "editor" | "github" | "browser") => {
    if (!repoPath) return;
    try {
      switch (type) {
        case "finder":
          await send("openFinder", { path: repoPath });
          break;
        case "terminal": {
          const settings = getSettings();
          const terminalConfig = TERMINAL_OPTIONS.find((t) => t.id === settings.terminal);
          await send("openTerminal", { path: repoPath, terminal: terminalConfig?.appName || "Terminal" });
          break;
        }
        case "editor": {
          const settings = getSettings();
          const editorConfig = EDITOR_OPTIONS.find((e) => e.id === settings.editor);
          if (settings.editor === "custom" && settings.customEditorCommand) {
            await send("openEditor", { path: repoPath, editor: settings.customEditorCommand });
          } else if (editorConfig?.appName) {
            await send("openEditor", { path: repoPath, appName: editorConfig.appName });
          }
          break;
        }
        case "browser":
          if (devPort) {
            await send("openBrowser", { url: `http://localhost:${devPort}` });
          }
          break;
        case "github":
          try {
            const result = await send<{ remotes: Array<{ name: string; refs: { fetch: string } }> }>("getRemotes", { repoPath });
            const origin = result.remotes.find((r) => r.name === "origin");
            if (origin) {
              let url = origin.refs.fetch;
              if (url.startsWith("git@")) {
                url = url.replace("git@github.com:", "https://github.com/").replace(".git", "");
              } else if (url.endsWith(".git")) {
                url = url.replace(".git", "");
              }
              await send("openBrowser", { url });
            }
          } catch { /* no remote */ }
          break;
      }
    } catch { /* ignore */ }
  };

  const handlePull = async () => {
    if (!repoPath || isPulling) return;
    setIsPulling(true);
    try {
      await send("pull", { repoPath });
      await refreshStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pull failed");
    } finally {
      setIsPulling(false);
    }
  };

  const handleFetch = async () => {
    if (!repoPath || isFetching) return;
    setIsFetching(true);
    try {
      await send("fetch", { repoPath });
      await refreshStatus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Fetch failed");
    } finally {
      setIsFetching(false);
    }
  };

  const handlePush = async () => {
    if (!repoPath || isPushing) return;
    setIsPushing(true);
    try {
      await send("push", { repoPath });
      await refreshStatus();
      toast.success("Pushed successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Push failed");
    } finally {
      setIsPushing(false);
    }
  };

  const handlePR = async () => {
    if (!repoPath) return;
    try {
      const result = await send<{ remotes: Array<{ name: string; refs: { fetch: string } }> }>("getRemotes", { repoPath });
      const origin = result.remotes.find((r) => r.name === "origin");
      if (origin) {
        let url = origin.refs.fetch;
        if (url.startsWith("git@")) {
          url = url.replace("git@github.com:", "https://github.com/").replace(".git", "");
        } else if (url.endsWith(".git")) {
          url = url.replace(".git", "");
        }
        const branch = state.branches.find((b) => b.current)?.name || "main";
        await send("openBrowser", { url: `${url}/compare/${branch}?expand=1` });
      }
    } catch { /* no remote */ }
  };

  const handleQuickCommit = async () => {
    if (!repoPath || totalChanges === 0 || isCommitting) return;

    const settings = getSettings();
    if (!settings.aiApiKey) {
      toast.error("Configure AI API key in settings");
      return;
    }

    setIsCommitting(true);
    setCommitIcon("loading");
    try {
      await send("stageAll", { repoPath });

      const allFiles = [
        ...(status?.staged || []).map((f) => f.path),
        ...(status?.unstaged || []).map((f) => f.path),
        ...(status?.untracked || []).map((f) => f.path),
      ];

      let combinedDiff = "";
      for (const file of allFiles.slice(0, 10)) {
        try {
          const diffResponse = await send<{ diff: { hunks: unknown[]; isBinary: boolean } }>("diff", {
            repoPath,
            file,
            staged: true,
          });
          if (diffResponse.diff && !diffResponse.diff.isBinary && diffResponse.diff.hunks.length > 0) {
            combinedDiff += `\n--- ${file} ---\n`;
            for (const hunk of diffResponse.diff.hunks as Array<{ lines: Array<{ type: string; content: string }> }>) {
              for (const line of hunk.lines) {
                const prefix = line.type === "add" ? "+" : line.type === "delete" ? "-" : " ";
                combinedDiff += prefix + line.content + "\n";
              }
            }
          }
        } catch { /* skip */ }
      }

      if (!combinedDiff) {
        combinedDiff = `Changed files:\n${allFiles.map((f) => `- ${f}`).join("\n")}`;
      }

      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ message: string }>("ai_generate_commit", {
        diff: combinedDiff,
        provider: settings.aiProvider,
        model: getModelForProvider(settings.aiProvider, settings.aiModel),
        apiKey: settings.aiApiKey,
      });

      await send("commit", { repoPath, message: result.message });
      await refreshStatus();
      await emitCrossWindow(MINI_COMMIT_COMPLETE, { repoPath });

      setCommitIcon("check");
      setTimeout(() => setCommitIcon("default"), 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Commit failed");
      setCommitIcon("default");
    } finally {
      setIsCommitting(false);
    }
  };

  const projects = projectsState.projects;
  const selectedPath = projectsState.selectedPath;
  const selectedName = selectedPath?.split("/").pop() || "No project";
  const hasNoProjects = projects.length === 0;
  const noApiKey = !getSettings().aiApiKey;

  return (
    <div className="h-12 w-full rounded-xl bg-background/95 backdrop-blur border shadow-lg flex items-center gap-0.5 px-1.5 select-none">
      {/* Drag region */}
      <div
        onMouseDown={handleDrag}
        className="shrink-0 cursor-grab active:cursor-grabbing px-1 flex items-center text-muted-foreground/50"
      >
        <GripVertical className="w-3.5 h-3.5" />
      </div>

      {/* Project selector */}
      <select
        value={selectedPath || ""}
        onChange={(e) => handleProjectChange(e.target.value)}
        disabled={hasNoProjects}
        className="h-7 max-w-[10rem] truncate text-xs bg-transparent border border-border/50 rounded px-1.5 cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring appearance-none"
        title={selectedPath || "No projects"}
      >
        {hasNoProjects && <option value="">No projects</option>}
        {projects.map((p) => (
          <option key={p.path} value={p.path}>
            {p.path.split("/").pop()}
          </option>
        ))}
      </select>

      {/* Divider */}
      <div className="w-px h-5 bg-border/50 mx-1 shrink-0" />

      {/* Quick links */}
      <div className="flex items-center gap-0.5 shrink-0">
        {([
          { type: "finder" as const, icon: Folder, title: "Finder", color: "text-nav-icon-subscriptions" },
          { type: "browser" as const, icon: ExternalLink, title: "Browser", color: "text-nav-icon-inputs" },
          { type: "github" as const, icon: Github, title: "GitHub", color: "text-nav-icon-spaces" },
          { type: "terminal" as const, icon: Terminal, title: "Terminal", color: "text-nav-icon-coding" },
          { type: "editor" as const, icon: Code, title: "Editor", color: "text-nav-icon-knowledge" },
        ]).map(({ type, icon: Icon, title, color }) => (
          <button
            key={type}
            onClick={() => handleQuickLink(type)}
            disabled={!repoPath}
            title={title}
            className="p-1 rounded hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <Icon className={`w-3.5 h-3.5 ${color}`} />
          </button>
        ))}
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border/50 mx-1 shrink-0" />

      {/* Dev server status */}
      {repoPath && (
        <button
          onClick={handleDevClick}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-accent transition-colors text-xs shrink-0 max-w-[80px]"
          title={
            devStatus === "connected" ? `Open localhost:${devPort}` :
            devStatus === "connecting" ? "Connecting..." :
            devStatus === "error" ? "Connection failed" : "Connect dev server"
          }
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${
            devStatus === "connected" ? "bg-green-500" :
            devStatus === "connecting" ? "bg-yellow-500 animate-pulse" :
            devStatus === "error" ? "bg-red-500" : "bg-red-500"
          }`} />
          <span className="truncate">
            {devStatus === "connected" ? `:${devPort}` :
             devStatus === "connecting" ? `:${devPort || "..."}` :
             devStatus === "error" ? <AlertTriangle className="w-3 h-3 inline" /> : "Connect"}
          </span>
        </button>
      )}

      {/* Divider */}
      <div className="w-px h-5 bg-border/50 mx-1 shrink-0" />

      {/* Git actions: Pull | Fetch | Push | Commit | PR */}
      <div className="flex items-center gap-0 shrink-0">
        {/* Pull */}
        <button
          onClick={handlePull}
          disabled={!repoPath || isPulling}
          title={`Pull${status?.behind ? ` (${status.behind} behind)` : ""}`}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
        >
          {isPulling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowDown className={`w-3.5 h-3.5 ${status?.behind ? "text-blue-500" : ""}`} />}
          {status?.behind ? <span className="text-blue-500">{status.behind}</span> : null}
        </button>

        <div className="w-px h-4 bg-border/40 shrink-0" />

        {/* Fetch */}
        <button
          onClick={handleFetch}
          disabled={!repoPath || isFetching}
          title="Fetch"
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
        </button>

        <div className="w-px h-4 bg-border/40 shrink-0" />

        {/* Push */}
        <button
          onClick={handlePush}
          disabled={!repoPath || isPushing || !status?.ahead}
          title={`Push${status?.ahead ? ` (${status.ahead} ahead)` : ""}`}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
        >
          {isPushing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowUp className={`w-3.5 h-3.5 ${status?.ahead ? "text-green-500" : ""}`} />}
          {status?.ahead ? <span className="text-green-500">{status.ahead}</span> : null}
        </button>

        <div className="w-px h-4 bg-border/40 shrink-0" />

        {/* Commit */}
        <button
          onClick={handleQuickCommit}
          disabled={totalChanges === 0 || isCommitting || noApiKey}
          title={noApiKey ? "Configure AI API key in settings" : `Quick commit (${totalChanges} changes)`}
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
        >
          {commitIcon === "loading" ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : commitIcon === "check" ? (
            <Check className="w-3.5 h-3.5 text-green-500" />
          ) : (
            <GitCommitVertical className={`w-3.5 h-3.5 ${totalChanges > 0 ? "text-orange-500" : ""}`} />
          )}
          {totalChanges > 0 ? <span className="text-orange-500">{totalChanges}</span> : null}
        </button>

        <div className="w-px h-4 bg-border/40 shrink-0" />

        {/* PR */}
        <button
          onClick={handlePR}
          disabled={!repoPath}
          title="Create Pull Request"
          className="flex items-center gap-0.5 px-1.5 py-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:pointer-events-none transition-colors text-xs"
        >
          <GitPullRequest className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border/50 mx-1 shrink-0" />

      {/* Close */}
      <button
        onClick={handleClose}
        className="p-1 rounded hover:bg-destructive/20 transition-colors shrink-0"
        title="Close mini-view"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
