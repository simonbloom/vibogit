"use client";

import { useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { BranchSelector } from "@/components/branch-selector";
import { CommitHistory } from "@/components/commit-history";
import { AICommitButton } from "@/components/ai-commit-button";
import { SettingsPanel } from "@/components/settings-panel";
import { CreatePRDialog } from "@/components/create-pr-dialog";
import { FileTree } from "@/components/file-tree";
import { StagedChanges } from "@/components/staged-changes";
import { getSettings } from "@/lib/settings";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Folder,
  Terminal,
  Code,
  ExternalLink,
  Loader2,
  Settings,
  GitPullRequest,
  GitBranch,
  Github,
  FileEdit,
} from "lucide-react";
import { clsx } from "clsx";
import type { DevServerConfig, DevServerState } from "@vibogit/shared";

export function MainInterface() {
  const { state, send, refreshStatus, refreshBranches } = useDaemon();
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [activeView, setActiveView] = useState<"graph" | "tree" | "changes">("graph");
  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [showQuickCommit, setShowQuickCommit] = useState(false);

  const { status, branches, repoPath } = state;
  const currentBranch = branches.find((b) => b.current);
  const projectName = repoPath?.split("/").pop() || "Project";

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  const handlePull = async () => {
    if (!repoPath) return;
    setIsPulling(true);
    try {
      await send("pull", { repoPath });
      await refreshStatus();
      await refreshBranches();
    } catch (error) {
      console.error("Failed to pull:", error);
    } finally {
      setIsPulling(false);
    }
  };

  const handlePush = async () => {
    if (!repoPath) return;
    setIsPushing(true);
    try {
      await send("push", { repoPath });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to push:", error);
    } finally {
      setIsPushing(false);
    }
  };

  const handleQuickCommit = async () => {
    if (!repoPath || !commitMessage.trim()) return;
    if ((status?.staged.length || 0) === 0) {
      console.error("No files staged - use Changes tab to stage files first");
      return;
    }
    setIsCommitting(true);
    try {
      await send("commit", { repoPath, message: commitMessage });
      setCommitMessage("");
      setShowQuickCommit(false);
      await refreshStatus();
    } catch (error) {
      console.error("Failed to commit:", error);
    } finally {
      setIsCommitting(false);
    }
  };

  const handleQuickLink = async (type: "finder" | "terminal" | "editor" | "github" | "browser") => {
    if (!repoPath) return;
    try {
      switch (type) {
        case "finder":
          await send("openFinder", { path: repoPath });
          break;
        case "terminal":
          await send("openTerminal", { path: repoPath });
          break;
        case "editor": {
          const settings = getSettings();
          await send("openEditor", { path: repoPath, editor: settings.editor });
          break;
        }
        case "browser":
          try {
            const [stateResponse, configResponse] = await Promise.all([
              send<{ state: DevServerState }>("devServerState", { path: repoPath }),
              send<{ config: DevServerConfig | null }>("devServerDetect", { path: repoPath }),
            ]);
            const port = stateResponse.state.port || configResponse.config?.port || 5557;
            window.open(`http://localhost:${port}`, "_blank");
          } catch {
            window.open("http://localhost:5557", "_blank");
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
              window.open(url, "_blank");
            }
          } catch {
            console.error("Failed to get remote URL");
          }
          break;
      }
    } catch (error) {
      console.error(`Failed to open ${type}:`, error);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-57px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <span className="font-semibold">{projectName}</span>
          <BranchSelector currentBranch={currentBranch} branches={branches} />
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => handleQuickLink("finder")} className="p-2 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Finder">
            <Folder className="w-4 h-4" />
          </button>
          <button onClick={() => handleQuickLink("browser")} className="p-2 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Open in browser">
            <ExternalLink className="w-4 h-4" />
          </button>
          <button onClick={() => handleQuickLink("github")} className="p-2 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="GitHub">
            <Github className="w-4 h-4" />
          </button>
          <button onClick={() => handleQuickLink("terminal")} className="p-2 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Terminal">
            <Terminal className="w-4 h-4" />
          </button>
          <button onClick={() => handleQuickLink("editor")} className="p-2 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Editor">
            <Code className="w-4 h-4" />
          </button>
          <button onClick={() => setShowSettings(true)} className="p-2 text-muted-foreground hover:text-foreground rounded hover:bg-muted" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-2 border-b">
        <button
          onClick={handlePull}
          disabled={isPulling}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
        >
          {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
          Pull
        </button>
        <button
          onClick={handlePull}
          disabled={isPulling}
          className="p-1.5 border rounded-md hover:bg-muted disabled:opacity-50"
          title="Fetch"
        >
          <RefreshCw className={clsx("w-4 h-4", isPulling && "animate-spin")} />
        </button>
        <button
          onClick={handlePush}
          disabled={isPushing || (status?.ahead || 0) === 0}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted disabled:opacity-50"
        >
          {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          Push
        </button>
        <button
          onClick={() => setShowQuickCommit(!showQuickCommit)}
          disabled={(status?.staged.length || 0) === 0}
          className={clsx(
            "flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50",
            (status?.staged.length || 0) > 0 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          <GitBranch className="w-4 h-4" />
          Commit {(status?.staged.length || 0) > 0 && `(${status?.staged.length})`}
        </button>
        <button
          onClick={() => setShowCreatePR(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
        >
          <GitPullRequest className="w-4 h-4" />
          PR
        </button>
      </div>

      {/* Quick Commit */}
      {showQuickCommit && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-muted/30">
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            placeholder="Commit message..."
            className="flex-1 px-3 py-1.5 text-sm border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={(e) => e.key === "Enter" && handleQuickCommit()}
            autoFocus
          />
          <AICommitButton onMessageGenerated={setCommitMessage} disabled={totalChanges === 0} />
          <button
            onClick={handleQuickCommit}
            disabled={isCommitting || !commitMessage.trim()}
            className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
          >
            {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Commit"}
          </button>
          <button onClick={() => setShowQuickCommit(false)} className="px-2 py-1.5 text-sm text-muted-foreground hover:text-foreground">
            Cancel
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-1 border-b">
        <button
          onClick={() => setActiveView("graph")}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1 text-sm rounded-md",
            activeView === "graph" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <GitBranch className="w-3.5 h-3.5" />
          Graph
        </button>
        <button
          onClick={() => setActiveView("tree")}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1 text-sm rounded-md",
            activeView === "tree" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Folder className="w-3.5 h-3.5" />
          Tree
        </button>
        <button
          onClick={() => setActiveView("changes")}
          className={clsx(
            "flex items-center gap-1.5 px-3 py-1 text-sm rounded-md",
            activeView === "changes" ? "bg-muted font-medium" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <FileEdit className="w-3.5 h-3.5" />
          Changes
          {totalChanges > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {totalChanges}
            </span>
          )}
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {activeView === "graph" && <CommitHistory repoPath={repoPath} />}
        {activeView === "tree" && <FileTree repoPath={repoPath} />}
        {activeView === "changes" && <StagedChanges repoPath={repoPath} />}
      </div>

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
      <CreatePRDialog isOpen={showCreatePR} onClose={() => setShowCreatePR(false)} repoPath={repoPath} currentBranch={currentBranch} />
    </div>
  );
}
