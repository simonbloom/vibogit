"use client";

import { useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { getSettings } from "@/lib/settings";
import { AI_PROVIDERS } from "@/lib/ai-service";
import { Sparkles, Loader2, AlertCircle } from "lucide-react";
import { clsx } from "clsx";

interface AICommitButtonProps {
  onMessageGenerated: (message: string) => void;
  disabled?: boolean;
}

export function AICommitButton({ onMessageGenerated, disabled }: AICommitButtonProps) {
  const { send, state } = useDaemon();
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    const settings = getSettings();
    const { repoPath, status } = state;

    if (!repoPath || !status) return;

    if (!settings.aiApiKey) {
      setError("Please configure your AI API key in settings");
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // Get all changed files
      const allFiles = [
        ...status.staged.map((f) => f.path),
        ...status.unstaged.map((f) => f.path),
        ...status.untracked.map((f) => f.path),
      ];

      if (allFiles.length === 0) {
        setError("No changes to commit");
        return;
      }

      // Get diff for all files (combine staged and unstaged)
      let combinedDiff = "";
      
      for (const file of allFiles.slice(0, 10)) { // Limit to first 10 files
        try {
          const diffResponse = await send<{ diff: { hunks: unknown[]; isBinary: boolean } }>("diff", {
            repoPath,
            file,
            staged: status.staged.some((f) => f.path === file),
          });
          
          if (diffResponse.diff && !diffResponse.diff.isBinary && diffResponse.diff.hunks.length > 0) {
            combinedDiff += `\n--- ${file} ---\n`;
            // Simplified diff output
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
        // Fallback to file list summary
        combinedDiff = `Changed files:\n${allFiles.map((f) => `- ${f}`).join("\n")}`;
      }

      // Call the AI API
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

      const data = await response.json();
      onMessageGenerated(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate commit message");
    } finally {
      setIsGenerating(false);
    }
  };

  const provider = AI_PROVIDERS.find((p) => p.id === getSettings().aiProvider);

  return (
    <div className="relative">
      <button
        onClick={handleGenerate}
        disabled={disabled || isGenerating}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors",
          "bg-accent/20 text-accent hover:bg-accent/30",
          "disabled:opacity-50 disabled:cursor-not-allowed"
        )}
        title={`Generate with ${provider?.displayName || "AI"}`}
      >
        {isGenerating ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4" />
        )}
        <span>AI</span>
      </button>

      {error && (
        <div className="absolute bottom-full left-0 mb-2 p-2 bg-status-deleted/20 border border-status-deleted/50 rounded-lg text-xs text-status-deleted whitespace-nowrap flex items-center gap-2">
          <AlertCircle className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
