"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { BranchSelector } from "@/components/branch-selector";
import { DevServerConnection } from "@/components/dev-server-connection";
import { DevServerLogs } from "@/components/dev-server-logs";
import { CommitHistory } from "@/components/commit-history";
import { CreatePRDialog } from "@/components/create-pr-dialog";

import { FileTree } from "@/components/file-tree";
import { CodeViewer } from "@/components/code-viewer";
import { StagedChanges } from "@/components/staged-changes";
import { PortPromptModal } from "@/components/port-prompt-modal";
import { PromptBox } from "@/components/prompt-box";
import type { PromptData } from "@/components/prompt-box";
import { Button } from "@/components/ui/button";
import { getSettings, TERMINAL_OPTIONS, EDITOR_OPTIONS } from "@/lib/settings";
import {
  ArrowUp,
  ArrowDown,
  RefreshCw,
  Folder,
  Terminal,
  Code,
  ExternalLink,
  Loader2,
  GitPullRequest,
  GitBranch,
  Github,
  FileEdit,
  ScrollText,
} from "lucide-react";
import { clsx } from "clsx";
import { toast } from "sonner";
import type { DevServerConfig, DevServerState } from "@vibogit/shared";

export function MainInterface() {
  const { state, send, refreshStatus, refreshBranches } = useDaemon();
  const [isPulling, setIsPulling] = useState(false);
  const [isPushing, setIsPushing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [activeView, setActiveView] = useState<"graph" | "tree" | "changes" | "logs">("changes");
  const [showCreatePR, setShowCreatePR] = useState(false);
  const [devServerPort, setDevServerPort] = useState<number | null>(null);
  const [showPortPrompt, setShowPortPrompt] = useState(false);
  const [isMonorepo, setIsMonorepo] = useState(false);
  const [projectFiles, setProjectFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<{ path: string; name: string } | null>(null);
  const [graphRefreshKey, setGraphRefreshKey] = useState(0);

  const { status, branches, repoPath } = state;
  const currentBranch = branches.find((b) => b.current);
  const projectName = repoPath?.split("/").pop() || "Project";

  const totalChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0);

  // Clear selected file when repo changes
  useEffect(() => {
    setSelectedFile(null);
  }, [repoPath]);

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

  const handlePromptSubmit = async (data: PromptData) => {
    const settings = getSettings();
    const terminalConfig = TERMINAL_OPTIONS.find((t) => t.id === settings.terminal);
    const terminalApp = terminalConfig?.appName || "Terminal";

    // Build the full text to send
    let text = data.text;

    // Replace [image N] references with file paths
    data.images.forEach((img) => {
      const reference = `[image ${img.referenceNumber}]`;
      let replacement = img.filename;
      if (img.filePath) {
        replacement = img.filePath;
      } else if (settings.imageBasePath) {
        const basePath = settings.imageBasePath.endsWith("/")
          ? settings.imageBasePath
          : settings.imageBasePath + "/";
        replacement = basePath + img.filename;
      }
      text = text.replace(reference, replacement);
    });

    // Replace [filename] references with full paths
    data.files.forEach((file) => {
      text = text.replace(file.referenceText, file.path);
    });

    try {
      await send("sendToTerminal", { text: text.trim(), terminal: terminalApp, autoExecute: settings.autoExecutePrompt });
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Accessibility")) {
        toast.error("ViboGit needs Accessibility permission to paste into terminals. Enable it in System Settings > Privacy & Security > Accessibility.");
      } else {
        console.error("Failed to send to terminal:", error);
      }
    }
  };

  const handleFetch = async () => {
    if (!repoPath) return;
    setIsFetching(true);
    try {
      await send("fetch", { repoPath });
      await refreshStatus();
      await refreshBranches();
    } catch (error) {
      console.error("Failed to fetch:", error);
    } finally {
      setIsFetching(false);
    }
  };

  // Auto-fetch every 60 seconds to keep ahead/behind counts current
  useEffect(() => {
    if (!repoPath) return;
    const interval = setInterval(() => {
      send("fetch", { repoPath })
        .then(() => refreshStatus())
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(interval);
  }, [repoPath, send, refreshStatus]);

  const handlePull = async () => {
    if (!repoPath) return;
    setIsPulling(true);
    try {
      await send("pull", { repoPath });
      await refreshStatus();
      await refreshBranches();
      setGraphRefreshKey((k) => k + 1);
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
      toast.success("Pushed successfully");
    } catch (error) {
      console.error("Failed to push:", error);
      // Handle Tauri error objects which have a message property
      const errorMsg = error instanceof Error 
        ? error.message 
        : typeof error === 'object' && error !== null && 'message' in error
          ? String((error as { message: unknown }).message)
          : JSON.stringify(error);
      toast.error(`Push failed: ${errorMsg}`);
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
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ message: string }>("ai_generate_commit", {
        diff: combinedDiff,
        provider: settings.aiProvider,
        apiKey: settings.aiApiKey,
      });
      const message = result.message;
      
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
        case "terminal": {
          const settings = getSettings();
          const terminalConfig = TERMINAL_OPTIONS.find((t) => t.id === settings.terminal);
          const terminalApp = terminalConfig?.appName || "Terminal";
          await send("openTerminal", { path: repoPath, terminal: terminalApp });
          break;
        }
        case "editor": {
          const settings = getSettings();
          const editorConfig = EDITOR_OPTIONS.find((e) => e.id === settings.editor);
          
          if (settings.editor === "custom") {
            const command = settings.customEditorCommand;
            if (!command) {
              console.error("No custom editor command configured");
              return;
            }
            try {
              await send("openEditor", { path: repoPath, editor: command });
            } catch (error) {
              console.error("Failed to open editor:", error);
            }
          } else if (editorConfig?.appName) {
            try {
              await send("openEditor", { path: repoPath, appName: editorConfig.appName });
            } catch (error) {
              console.error("Failed to open editor:", error);
            }
          }
          break;
        }
        case "browser":
          if (devServerPort) {
            await send("openBrowser", { url: `http://localhost:${devServerPort}` });
          } else {
            try {
              const [stateResponse, configResponse] = await Promise.all([
                send<{ state: DevServerState }>("devServerState", { path: repoPath }),
                send<{ config: DevServerConfig | null }>("devServerDetect", { path: repoPath }),
              ]);
              const port = stateResponse.state.port || configResponse.config?.port || 5557;
              await send("openBrowser", { url: `http://localhost:${port}` });
            } catch {
              await send("openBrowser", { url: "http://localhost:5557" });
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
              await send("openBrowser", { url });
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <div className="flex items-center gap-3">
          <BranchSelector currentBranch={currentBranch} branches={branches} />
          <DevServerConnection 
            repoPath={repoPath} 
            onPortChange={setDevServerPort} 
            onRequestPortPrompt={() => setShowPortPrompt(true)}
            onMonorepoChange={setIsMonorepo}
          />
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => handleQuickLink("finder")} title="Finder">
            <Folder className="w-5 h-5 text-nav-icon-subscriptions" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleQuickLink("browser")} title="Open in browser">
            <ExternalLink className="w-5 h-5 text-nav-icon-inputs" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleQuickLink("github")} title="GitHub">
            <Github className="w-5 h-5 text-nav-icon-spaces" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleQuickLink("terminal")} title="Terminal">
            <Terminal className="w-5 h-5 text-nav-icon-coding" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => handleQuickLink("editor")} title="Editor">
            <Code className="w-5 h-5 text-nav-icon-knowledge" />
          </Button>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button
          variant={(status?.behind || 0) > 0 ? "default" : "outline"}
          size="sm"
          onClick={handlePull}
          disabled={isPulling}
          className={(status?.behind || 0) > 0 ? "bg-blue-600 hover:bg-blue-700" : ""}
        >
          {isPulling ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDown className="w-4 h-4" />}
          Pull {(status?.behind || 0) > 0 && `(${status?.behind})`}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleFetch}
          disabled={isFetching}
          title="Fetch"
          className="h-9 w-9"
        >
          <RefreshCw className={clsx("w-4 h-4", isFetching && "animate-spin")} />
        </Button>
        <Button
          variant={(status?.ahead || 0) > 0 ? "default" : "outline"}
          size="sm"
          onClick={handlePush}
          disabled={isPushing || (status?.ahead || 0) === 0}
          className={(status?.ahead || 0) > 0 ? "bg-green-600 hover:bg-green-700" : ""}
        >
          {isPushing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          Push {(status?.ahead || 0) > 0 && `(${status?.ahead})`}
        </Button>
        <Button
          variant={totalChanges > 0 ? "default" : "outline"}
          size="sm"
          onClick={handleQuickCommit}
          disabled={totalChanges === 0 || isCommitting}
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
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowCreatePR(true)}
        >
          <GitPullRequest className="w-4 h-4" />
          PR
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 py-3 border-b">
        <Button
          variant={activeView === "changes" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("changes")}
          className="gap-1.5 rounded-full"
        >
          <FileEdit className="w-3.5 h-3.5" />
          Changes
          {totalChanges > 0 && (
            <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary text-primary-foreground rounded-full">
              {totalChanges}
            </span>
          )}
        </Button>
        <Button
          variant={activeView === "tree" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("tree")}
          className="gap-1.5 rounded-full"
        >
          <Folder className="w-3.5 h-3.5" />
          Tree
        </Button>
        <Button
          variant={activeView === "graph" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("graph")}
          className="gap-1.5 rounded-full"
        >
          <GitBranch className="w-3.5 h-3.5" />
          Graph
        </Button>
        <Button
          variant={activeView === "logs" ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveView("logs")}
          className="gap-1.5 rounded-full"
        >
          <ScrollText className="w-3.5 h-3.5" />
          Logs
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeView === "graph" && (
          <div className="h-full">
            <CommitHistory repoPath={repoPath} refreshKey={graphRefreshKey} />
          </div>
        )}
        {activeView === "tree" && (
          <div className="flex h-full">
            <div className="w-2/5 border-r overflow-hidden flex flex-col min-h-0">
              <FileTree
                repoPath={repoPath}
                selectedPath={selectedFile?.path}
                onFileSelect={setSelectedFile}
              />
            </div>
            <div className="w-3/5 overflow-hidden">
              <CodeViewer
                filePath={selectedFile?.path ?? null}
                fileName={selectedFile?.name ?? ""}
                repoPath={repoPath}
              />
            </div>
          </div>
        )}
        {activeView === "changes" && (
          <div className="h-full overflow-auto">
            <StagedChanges repoPath={repoPath} />
          </div>
        )}
        {activeView === "logs" && (
          <div className="h-full overflow-auto">
            <DevServerLogs repoPath={repoPath} expanded />
          </div>
        )}
      </div>

      {/* Prompt Box - Bottom */}
      <div className="border-t bg-muted/30">
        <PromptBox
          projectFiles={projectFiles}
          imageBasePath={getSettings().imageBasePath}
          terminalName={getSettings().terminal}
          onSubmit={handlePromptSubmit}
          placeholder="Ask about this project... (use @ to reference files)"
          maxLength={10000}
        />
      </div>

      <CreatePRDialog isOpen={showCreatePR} onClose={() => setShowCreatePR(false)} repoPath={repoPath} currentBranch={currentBranch} />
      <PortPromptModal
        isOpen={showPortPrompt}
        onClose={() => setShowPortPrompt(false)}
        defaultPort={devServerPort || 3000}
        isMonorepo={isMonorepo}
        onSubmit={async (port, saveToConfig) => {
          if (saveToConfig && repoPath) {
            try {
              await send("writeAgentsConfig", { repoPath, port });
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
