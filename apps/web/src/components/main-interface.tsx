"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { BranchSelector } from "@/components/branch-selector";
import { DevServerConnection } from "@/components/dev-server-connection";
import { CommitHistory } from "@/components/commit-history";
import { SettingsPanel } from "@/components/settings-panel";
import { CreatePRDialog } from "@/components/create-pr-dialog";

import { FileTree } from "@/components/file-tree";
import { StagedChanges } from "@/components/staged-changes";
import { PortPromptModal } from "@/components/port-prompt-modal";
import { PromptBox } from "@/components/prompt-box";
import type { PromptData } from "@/components/prompt-box";
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
  const [activeView, setActiveView] = useState<"graph" | "tree" | "changes">("graph");
  const [showSettings, setShowSettings] = useState(false);
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [devServerPort, setDevServerPort] = useState<number | null>(null);
  const [showPortPrompt, setShowPortPrompt] = useState(false);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);

  const { status, branches, repoPath } = state;
  const currentBranch = branches.find((b) => b.current);
  const projectName = repoPath?.split("/").pop() || "Project";

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  // Fetch project files for PromptBox @ mentions
  useEffect(() => {
    interface FileNode {
      name: string;
      path: string;
      type: "file" | "directory";
      children?: FileNode[];
    }

    const flattenTree = (nodes: FileNode[]): string[] => {
      const files: string[] = [];
      const traverse = (node: FileNode) => {
        if (node.type === "file") {
          files.push(node.path);
        }
        if (node.children) {
          node.children.forEach(traverse);
        }
      };
      nodes.forEach(traverse);
      return files;
    };

    const fetchProjectFiles = async () => {
      if (!repoPath) return;
      try {
        const result = await send<{ tree: FileNode[] }>("listFiles", { path: repoPath });
        setProjectFiles(flattenTree(result.tree || []));
      } catch {
        setProjectFiles([]);
      }
    };
    fetchProjectFiles();
  }, [repoPath, send]);

  const handlePromptSubmit = (data: PromptData) => {
    console.log("Prompt submitted:", data);
    // TODO: Connect to AI service or other handler
  };

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
    if (!repoPath || totalChanges === 0) return;
    
    const settings = getSettings();
    if (!settings.aiApiKey) {
      console.error("Please configure your AI API key in settings");
      return;
    }
    
    setIsCommitting(true);
    try {
      // 1. Stage all changed files
      await send("stageAll", { repoPath });
      
      // 2. Get diffs for AI message generation
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
        } catch {
          // Skip files that can't be diffed
        }
      }
      
      if (!combinedDiff) {
        combinedDiff = `Changed files:\n${allFiles.map((f) => `- ${f}`).join("\n")}`;
      }
      
      // 3. Generate AI commit message
      const response = await fetch("/api/ai/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          diff: combinedDiff,
          provider: settings.aiProvider,
          apiKey: settings.aiApiKey,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate commit message");
      }
      
      const { message } = await response.json();
      
      // 4. Commit with generated message
      await send("commit", { repoPath, message });
      
      // 5. Refresh status
      await refreshStatus();
    } catch (error) {
      console.error("Quick commit failed:", error);
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
          if (devServerPort) {
            window.open(`http://localhost:${devServerPort}`, "_blank");
          } else {
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
          <DevServerConnection repoPath={repoPath} onPortChange={setDevServerPort} onRequestPortPrompt={() => setShowPortPrompt(true)} />
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
          Pull {(status?.behind || 0) > 0 && `(${status?.behind})`}
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
          Push {(status?.ahead || 0) > 0 && `(${status?.ahead})`}
        </button>
        <button
          onClick={handleQuickCommit}
          disabled={totalChanges === 0 || isCommitting}
          className={clsx(
            "flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md disabled:opacity-50",
            totalChanges > 0 ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          )}
        >
          {isCommitting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Committing...
            </>
          ) : (
            <>
              <GitBranch className="w-4 h-4" />
              Quick Commit {totalChanges > 0 && `(${totalChanges})`}
            </>
          )}
        </button>
        <button
          onClick={() => setShowCreatePR(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-md hover:bg-muted"
        >
          <GitPullRequest className="w-4 h-4" />
          PR
        </button>
      </div>

      {/* Prompt Box - Always visible */}
      <div className="px-4 py-2 border-b">
        <PromptBox
          projectFiles={projectFiles}
          uploadEndpoint="/api/upload"
          imageBasePath={getSettings().imageBasePath}
          onSubmit={handlePromptSubmit}
          placeholder="Ask about this project... (use @ to reference files)"
          maxLength={10000}
          defaultExpanded
        />
      </div>

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
      <PortPromptModal
        isOpen={showPortPrompt}
        onClose={() => setShowPortPrompt(false)}
        onSubmit={async (port, saveToConfig) => {
          if (saveToConfig && repoPath) {
            try {
              await send("updateAgentsConfig", { repoPath, port });
            } catch {
              // Silent fail on save
            }
          }
          setDevServerPort(port);
        }}
      />
    </div>
  );
}
