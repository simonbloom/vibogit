"use client";

import { useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { BranchSelector } from "@/components/branch-selector";
import { CommitHistory } from "@/components/commit-history";
import { AICommitButton } from "@/components/ai-commit-button";
import { SettingsPanel } from "@/components/settings-panel";
import { DevServerPanel } from "@/components/dev-server-panel";
import { CreatePRDialog } from "@/components/create-pr-dialog";
import { FileTree } from "@/components/file-tree";
import { getSettings } from "@/lib/settings";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Folder,
  Terminal,
  Code,
  Globe,
  Loader2,
  Settings,
  GitPullRequest,
  GitBranch,
  Plus,
  Check,
  Github,
} from "lucide-react";
import { clsx } from "clsx";

export function MainInterface() {
  const { state, send, refreshStatus, refreshBranches, setRepoPath } = useDaemon();
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [activeView, setActiveView] = useState<"graph" | "tree">("graph");
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
    setIsCommitting(true);
    try {
      // Stage all changes
      const allFiles = [
        ...(status?.unstaged.map((f) => f.path) || []),
        ...(status?.untracked.map((f) => f.path) || []),
      ];
      if (allFiles.length > 0) {
        await send("stage", { repoPath, files: allFiles });
      }
      // Commit
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

  const handleQuickLink = async (type: "finder" | "terminal" | "editor" | "github") => {
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
        case "github":
          // Get remote URL and open in browser
          try {
            const result = await send<{ remotes: Array<{ name: string; refs: { fetch: string } }> }>(
              "getRemotes",
              { repoPath }
            );
            const origin = result.remotes.find((r) => r.name === "origin");
            if (origin) {
              let url = origin.refs.fetch;
              // Convert git@ URL to https
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
    <div className="flex flex-col h-[calc(100vh-73px)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <Folder className="w-5 h-5 text-accent" />
          <span className="font-semibold text-text-primary">{projectName}</span>
          <BranchSelector currentBranch={currentBranch} branches={branches} />
          <button
            onClick={() => {}}
            className="flex items-center justify-center w-6 h-6 rounded bg-accent/20 text-accent hover:bg-accent/30 transition-colors"
            title="Create branch"
          >
            <Plus className="w-4 h-4" />
          </button>
          {totalChanges > 0 && (
            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-accent text-background text-xs font-medium">
              <Check className="w-3 h-3" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleQuickLink("finder")}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Open in Finder"
          >
            <Folder className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleQuickLink("github")}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Open on GitHub"
          >
            <Globe className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleQuickLink("terminal")}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Open in Terminal"
          >
            <Terminal className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleQuickLink("editor")}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Open in Editor"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            onClick={() => {}}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="GitHub"
          >
            <Github className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-text-muted hover:text-text-primary transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Action Bar */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center">
          <button
            onClick={handlePull}
            disabled={isPulling}
            className="flex items-center gap-2 px-4 py-2 bg-surface rounded-l-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors disabled:opacity-50"
          >
            {isPulling ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
            Pull
            {(status?.behind || 0) > 0 && (
              <span className="text-xs text-status-deleted">({status?.behind})</span>
            )}
          </button>
          <button
            onClick={handlePull}
            disabled={isPulling}
            className="flex items-center justify-center w-10 py-2 bg-surface border-y border-r border-border rounded-r-lg text-text-muted hover:text-text-primary hover:bg-surface-light transition-colors disabled:opacity-50"
            title="Fetch"
          >
            <RefreshCw className={clsx("w-4 h-4", isPulling && "animate-spin")} />
          </button>
        </div>

        <button
          onClick={handlePush}
          disabled={isPushing || (status?.ahead || 0) === 0}
          className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors disabled:opacity-50"
        >
          {isPushing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <ArrowUp className="w-4 h-4" />
          )}
          Push
          {(status?.ahead || 0) > 0 && (
            <span className="text-xs text-status-added">({status?.ahead})</span>
          )}
        </button>

        <div className="flex items-center">
          <button
            onClick={() => setShowQuickCommit(!showQuickCommit)}
            disabled={totalChanges === 0}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-l-lg border border-border transition-colors disabled:opacity-50",
              totalChanges > 0
                ? "bg-accent/20 text-accent border-accent/30"
                : "bg-surface text-text-secondary"
            )}
          >
            <GitBranch className="w-4 h-4" />
            Quick Commit
            {totalChanges > 0 && (
              <span className="text-xs">({totalChanges})</span>
            )}
          </button>
          <button
            onClick={() => {}}
            disabled={totalChanges === 0}
            className={clsx(
              "flex items-center justify-center w-10 py-2 border-y border-r rounded-r-lg transition-colors disabled:opacity-50",
              totalChanges > 0
                ? "bg-accent/20 text-accent border-accent/30"
                : "bg-surface text-text-muted border-border"
            )}
            title="Stage selected"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={() => setShowCreatePR(true)}
          className="flex items-center gap-2 px-4 py-2 bg-surface rounded-lg border border-border text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
        >
          <GitPullRequest className="w-4 h-4" />
          Create PR
        </button>
      </div>

      {/* Quick Commit Panel */}
      {showQuickCommit && (
        <div className="px-4 py-3 border-b border-border bg-surface">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="Commit message..."
              className="flex-1 px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
              onKeyDown={(e) => e.key === "Enter" && handleQuickCommit()}
            />
            <AICommitButton
              onMessageGenerated={setCommitMessage}
              disabled={totalChanges === 0}
            />
            <button
              onClick={handleQuickCommit}
              disabled={isCommitting || !commitMessage.trim()}
              className="px-4 py-2 bg-accent text-background rounded-lg font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
            >
              {isCommitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Commit"
              )}
            </button>
            <button
              onClick={() => setShowQuickCommit(false)}
              className="px-3 py-2 text-text-muted hover:text-text-primary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Dev Servers */}
      <DevServerPanel repoPath={repoPath} />

      {/* View Toggle & Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Graph/Tree Toggle */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
          <button
            onClick={() => setActiveView("graph")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeView === "graph"
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <GitBranch className="w-4 h-4" />
            Graph
          </button>
          <button
            onClick={() => setActiveView("tree")}
            className={clsx(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
              activeView === "tree"
                ? "bg-accent/20 text-accent"
                : "text-text-muted hover:text-text-primary"
            )}
          >
            <Folder className="w-4 h-4" />
            Tree
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          {activeView === "graph" ? (
            <CommitHistory repoPath={repoPath} />
          ) : (
            <FileTree repoPath={repoPath} />
          )}
        </div>
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />

      {/* Create PR Dialog */}
      <CreatePRDialog
        isOpen={showCreatePR}
        onClose={() => setShowCreatePR(false)}
        repoPath={repoPath}
        currentBranch={currentBranch}
      />
    </div>
  );
}
