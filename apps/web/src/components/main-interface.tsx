"use client";

import { useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { ChangesPanel } from "@/components/changes-panel";
import { ChangesDrawer } from "@/components/changes-drawer";
import { BranchSelector } from "@/components/branch-selector";
import { CommitHistory } from "@/components/commit-history";
import { AICommitButton } from "@/components/ai-commit-button";
import { SettingsPanel } from "@/components/settings-panel";
import { DevServerPanel } from "@/components/dev-server-panel";
import { getSettings } from "@/lib/settings";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  FolderOpen,
  Terminal,
  Code,
  Globe,
  Folder,
  Loader2,
  History,
  FileText,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";
import type { GitFile } from "@vibogit/shared";

export function MainInterface() {
  const { state, send, refreshStatus, refreshBranches, setRepoPath } = useDaemon();
  const [selectedFile, setSelectedFile] = useState<GitFile | null>(null);
  const [isShipping, setIsShipping] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [commitMessage, setCommitMessage] = useState("");
  const [activeView, setActiveView] = useState<"changes" | "history">("changes");
  const [showSettings, setShowSettings] = useState(false);

  const { status, branches, repoPath } = state;
  const currentBranch = branches.find((b) => b.current);
  const projectName = repoPath?.split("/").pop() || "Project";

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  const handleSave = async () => {
    if (!repoPath || !commitMessage.trim()) return;

    setIsShipping(true);
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
      await refreshStatus();
    } catch (error) {
      console.error("Failed to save:", error);
    } finally {
      setIsShipping(false);
    }
  };

  const handleShip = async () => {
    if (!repoPath) return;

    setIsShipping(true);
    try {
      await send("push", { repoPath });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to ship:", error);
    } finally {
      setIsShipping(false);
    }
  };

  const handleSync = async () => {
    if (!repoPath) return;

    setIsSyncing(true);
    try {
      await send("pull", { repoPath });
      await refreshStatus();
      await refreshBranches();
    } catch (error) {
      console.error("Failed to sync:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleQuickLink = async (type: "finder" | "terminal" | "editor" | "browser") => {
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
          // Try to get remote URL and open GitHub
          // For now, just log
          console.log("Open in browser");
          break;
      }
    } catch (error) {
      console.error(`Failed to open ${type}:`, error);
    }
  };

  return (
    <div className="flex h-[calc(100vh-73px)]">
      {/* Sidebar */}
      <div className="w-80 border-r border-border flex flex-col">
        {/* Project Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-semibold text-text-primary truncate">{projectName}</h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowSettings(true)}
                className="text-text-muted hover:text-text-secondary transition-colors"
                title="Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRepoPath(null)}
                className="text-text-muted hover:text-text-secondary transition-colors"
                title="Close project"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <BranchSelector currentBranch={currentBranch} branches={branches} />
            {(status?.ahead || 0) > 0 && (
              <span className="flex items-center gap-1 text-status-added">
                <ArrowUp className="w-3 h-3" />
                {status?.ahead}
              </span>
            )}
            {(status?.behind || 0) > 0 && (
              <span className="flex items-center gap-1 text-status-deleted">
                <ArrowDown className="w-3 h-3" />
                {status?.behind}
              </span>
            )}
          </div>
        </div>

        {/* Quick Links */}
        <div className="p-4 border-b border-border">
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickLink("finder")}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-surface rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
              title="Open in Finder"
            >
              <Folder className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleQuickLink("terminal")}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-surface rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
              title="Open in Terminal"
            >
              <Terminal className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleQuickLink("editor")}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-surface rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
              title="Open in Editor"
            >
              <Code className="w-4 h-4" />
            </button>
            <button
              onClick={() => handleQuickLink("browser")}
              className="flex-1 flex items-center justify-center gap-2 p-2 bg-surface rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-light transition-colors"
              title="Open on GitHub"
            >
              <Globe className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setActiveView("changes")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
              activeView === "changes"
                ? "text-accent border-b-2 border-accent"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <FileText className="w-4 h-4" />
            Changes
          </button>
          <button
            onClick={() => setActiveView("history")}
            className={clsx(
              "flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium transition-colors",
              activeView === "history"
                ? "text-accent border-b-2 border-accent"
                : "text-text-secondary hover:text-text-primary"
            )}
          >
            <History className="w-4 h-4" />
            Timeline
          </button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-hidden">
          {activeView === "changes" ? (
            <ChangesPanel
              status={status}
              selectedFile={selectedFile}
              onSelectFile={setSelectedFile}
            />
          ) : (
            <CommitHistory repoPath={repoPath} />
          )}
        </div>

        {/* Dev Server Panel */}
        <DevServerPanel repoPath={repoPath} />

        {/* Action Bar */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Commit Message */}
          <div className="relative">
            <textarea
              value={commitMessage}
              onChange={(e) => setCommitMessage(e.target.value)}
              placeholder="What did you change?"
              className="w-full p-3 pr-16 bg-surface border border-border rounded-lg text-text-primary placeholder-text-muted resize-none focus:outline-none focus:border-accent transition-colors"
              rows={2}
            />
            <div className="absolute right-2 top-2">
              <AICommitButton
                onMessageGenerated={setCommitMessage}
                disabled={totalChanges === 0}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={isShipping || !commitMessage.trim() || totalChanges === 0}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors",
                "bg-accent text-background hover:bg-accent/90",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              {isShipping ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Save"
              )}
            </button>
            <button
              onClick={handleShip}
              disabled={isShipping || (status?.ahead || 0) === 0}
              className={clsx(
                "flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors",
                "bg-status-added/20 text-status-added hover:bg-status-added/30",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <ArrowUp className="w-4 h-4" />
              Ship
            </button>
            <button
              onClick={handleSync}
              disabled={isSyncing}
              className={clsx(
                "flex items-center justify-center gap-2 px-3 py-2 rounded-lg font-medium transition-colors",
                "bg-surface text-text-secondary hover:text-text-primary hover:bg-surface-light"
              )}
            >
              <RefreshCw className={clsx("w-4 h-4", isSyncing && "animate-spin")} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Diff View */}
      <div className="flex-1 overflow-hidden">
        <ChangesDrawer file={selectedFile} repoPath={repoPath} />
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
}
