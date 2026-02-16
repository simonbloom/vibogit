"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { getSettings } from "@/lib/settings";
import { getModelForProvider } from "@/lib/ai-service";
import { Button } from "@/components/ui/button";
import { X, Sparkles, Loader2, ExternalLink, GitPullRequest } from "lucide-react";
import type { GitCommit, GitBranch } from "@vibogit/shared";

interface CreatePRDialogProps {
  isOpen: boolean;
  onClose: () => void;
  repoPath: string | null;
  currentBranch: GitBranch | undefined;
}

export function CreatePRDialog({
  isOpen,
  onClose,
  repoPath,
  currentBranch,
}: CreatePRDialogProps) {
  const { send } = useDaemon();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [baseBranch, setBaseBranch] = useState("main");
  const [isGenerating, setIsGenerating] = useState(false);
  const [remoteUrl, setRemoteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Get remote URL on open
  useEffect(() => {
    if (!isOpen || !repoPath) return;

    const getRemote = async () => {
      try {
        const response = await send<{ remotes: Array<{ name: string; refs: { fetch: string; push: string } }> }>(
          "getRemotes",
          { repoPath }
        );
        const origin = response.remotes.find((r) => r.name === "origin");
        if (origin?.refs?.push) {
          // Convert git URL to GitHub web URL
          let url = origin.refs.push;
          // Handle SSH format: git@github.com:user/repo.git
          if (url.startsWith("git@github.com:")) {
            url = url.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "");
          }
          // Handle HTTPS format: https://github.com/user/repo.git
          if (url.endsWith(".git")) {
            url = url.replace(/\.git$/, "");
          }
          setRemoteUrl(url);
        }
      } catch {
        setRemoteUrl(null);
      }
    };

    getRemote();
  }, [isOpen, repoPath, send]);

  const handleGenerateWithAI = async () => {
    if (!repoPath || !currentBranch) return;

    const settings = getSettings();
    if (!settings.aiApiKey) {
      setError("Please configure your AI API key in settings");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Get recent commits on this branch
      const logResponse = await send<{ commits: GitCommit[] }>("log", {
        repoPath,
        limit: 10,
      });

      const commits = logResponse.commits.map(
        (c) => `- ${c.hashShort}: ${c.message}`
      );

      const diffSummary = `Changes in ${currentBranch.name} branch`;

      const { invoke } = await import("@tauri-apps/api/core");
      const data = await invoke<{ title: string; description: string }>("ai_generate_pr", {
        commits,
        diff: diffSummary,
        baseBranch,
        headBranch: currentBranch.name,
        provider: settings.aiProvider,
        model: getModelForProvider(settings.aiProvider, settings.aiModel),
        apiKey: settings.aiApiKey,
      });
      setTitle(data.title);
      setDescription(data.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PR content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreatePR = async () => {
    if (!remoteUrl) {
      setError("Could not determine remote repository URL");
      return;
    }
    
    const encodedTitle = encodeURIComponent(title);
    const encodedBody = encodeURIComponent(description);
    const branch = currentBranch?.name || "feature";

    const url = `${remoteUrl}/compare/${baseBranch}...${branch}?expand=1&title=${encodedTitle}&body=${encodedBody}`;

    await send("openBrowser", { url });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface border border-border rounded-xl w-full max-w-2xl shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <GitPullRequest className="w-5 h-5 text-accent" />
            <h2 className="text-lg font-semibold text-text-primary">Create Pull Request</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Branch info */}
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <span className="px-2 py-1 bg-surface-light rounded">{currentBranch?.name}</span>
            <span>→</span>
            <input
              type="text"
              value={baseBranch}
              onChange={(e) => setBaseBranch(e.target.value)}
              className="px-2 py-1 bg-background border border-border rounded text-text-primary w-32"
              placeholder="main"
            />
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-text-secondary">Title</label>
              <Button
                variant="link"
                size="sm"
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                className="h-auto p-0 text-xs"
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Generate with AI
              </Button>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Add a descriptive title..."
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your changes..."
              rows={10}
              className="w-full px-3 py-2 bg-background border border-border rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent resize-none font-mono text-sm"
            />
          </div>

          {error && (
            <div className="p-3 bg-status-deleted/20 border border-status-deleted/50 rounded-lg text-sm text-status-deleted">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border flex justify-end gap-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleCreatePR} disabled={!title.trim()}>
            <ExternalLink className="w-4 h-4" />
            Open on GitHub
          </Button>
        </div>
      </div>
    </div>
  );
}
