"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { getSettings } from "@/lib/settings";
import { X, Sparkles, Loader2, ExternalLink, GitPullRequest } from "lucide-react";
import { clsx } from "clsx";
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
        // Try to get remote URL from git config
        // For now, we'll construct it from the branch tracking info
        // This is a simplified implementation
        setRemoteUrl(null);
      } catch {
        setRemoteUrl(null);
      }
    };

    getRemote();
  }, [isOpen, repoPath]);

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

      // Get diff summary (simplified)
      const statusResponse = await send<{ status: { staged: unknown[]; unstaged: unknown[] } }>(
        "status",
        { repoPath }
      );

      const diffSummary = `Changes in ${currentBranch.name} branch`;

      const response = await fetch("/api/ai/pr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commits,
          diff: diffSummary,
          baseBranch,
          headBranch: currentBranch.name,
          provider: settings.aiProvider,
          apiKey: settings.aiApiKey,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate PR");
      }

      const data = await response.json();
      setTitle(data.title);
      setDescription(data.description);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate PR content");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCreatePR = () => {
    // For now, open GitHub's PR creation page
    // This would need the remote URL to work properly
    const encodedTitle = encodeURIComponent(title);
    const encodedBody = encodeURIComponent(description);
    const branch = currentBranch?.name || "feature";

    // Generic GitHub URL pattern - user would need to replace with their repo
    const url = `https://github.com/OWNER/REPO/compare/${baseBranch}...${branch}?expand=1&title=${encodedTitle}&body=${encodedBody}`;

    window.open(url, "_blank");
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
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
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
              <button
                onClick={handleGenerateWithAI}
                disabled={isGenerating}
                className="flex items-center gap-1 text-xs text-accent hover:underline disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Generate with AI
              </button>
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
          <button
            onClick={onClose}
            className="px-4 py-2 bg-surface-light text-text-secondary rounded-lg hover:text-text-primary transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreatePR}
            disabled={!title.trim()}
            className={clsx(
              "flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors",
              "bg-accent text-background hover:bg-accent/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <ExternalLink className="w-4 h-4" />
            Open on GitHub
          </button>
        </div>
      </div>
    </div>
  );
}
