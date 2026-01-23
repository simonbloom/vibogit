"use client";

import { useState, useRef, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import {
  GitBranch,
  ChevronDown,
  Plus,
  Check,
  Loader2,
  AlertCircle,
} from "lucide-react";
import type { GitBranch as GitBranchType } from "@vibogit/shared";

interface BranchSelectorProps {
  currentBranch: GitBranchType | undefined;
  branches: GitBranchType[];
}

export function BranchSelector({ currentBranch, branches }: BranchSelectorProps) {
  const { send, state, refreshStatus, refreshBranches } = useDaemon();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showNewBranch, setShowNewBranch] = useState(false);
  const [newBranchName, setNewBranchName] = useState("");
  const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);
  const [pendingBranch, setPendingBranch] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { status, repoPath } = state;
  const hasUnsavedChanges =
    (status?.staged.length || 0) +
    (status?.unstaged.length || 0) +
    (status?.untracked.length || 0) > 0;

  // Filter local branches
  const localBranches = branches.filter((b) => !b.remote);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowNewBranch(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleBranchSelect = async (branchName: string) => {
    if (branchName === currentBranch?.name) {
      setIsOpen(false);
      return;
    }

    if (hasUnsavedChanges) {
      setPendingBranch(branchName);
      setShowUnsavedWarning(true);
      return;
    }

    await switchBranch(branchName);
  };

  const switchBranch = async (branchName: string) => {
    if (!repoPath) return;

    setIsLoading(true);
    try {
      await send("checkout", { repoPath, branch: branchName });
      await refreshStatus();
      await refreshBranches();
      setIsOpen(false);
      setShowUnsavedWarning(false);
      setPendingBranch(null);
    } catch (error) {
      console.error("Failed to switch branch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBranch = async () => {
    if (!repoPath || !newBranchName.trim()) return;

    setIsLoading(true);
    try {
      await send("createBranch", {
        repoPath,
        name: newBranchName.trim(),
        checkout: true,
      });
      await refreshStatus();
      await refreshBranches();
      setNewBranchName("");
      setShowNewBranch(false);
      setIsOpen(false);
    } catch (error) {
      console.error("Failed to create branch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStashAndSwitch = async () => {
    // For now, just switch - stash can be implemented later
    if (pendingBranch) {
      await switchBranch(pendingBranch);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={clsx(
          "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors",
          "bg-surface hover:bg-surface-light border border-border"
        )}
      >
        <GitBranch className="w-4 h-4 text-accent" />
        <span className="text-sm text-text-primary">
          {currentBranch?.name || "No branch"}
        </span>
        <ChevronDown className={clsx("w-4 h-4 text-text-muted transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-surface border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          {showUnsavedWarning ? (
            <div className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-status-modified flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-text-primary font-medium">Unsaved changes</p>
                  <p className="text-xs text-text-secondary mt-1">
                    You have uncommitted changes. What would you like to do?
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleStashAndSwitch}
                  disabled={isLoading}
                  className="w-full px-3 py-2 bg-accent text-background text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Switch anyway"
                  )}
                </button>
                <button
                  onClick={() => {
                    setShowUnsavedWarning(false);
                    setPendingBranch(null);
                  }}
                  className="w-full px-3 py-2 bg-surface-light text-text-secondary text-sm rounded-lg hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : showNewBranch ? (
            <div className="p-3">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="new-branch-name"
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBranch();
                  if (e.key === "Escape") setShowNewBranch(false);
                }}
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => setShowNewBranch(false)}
                  className="flex-1 px-3 py-1.5 bg-surface-light text-text-secondary text-sm rounded-lg hover:text-text-primary transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateBranch}
                  disabled={isLoading || !newBranchName.trim()}
                  className="flex-1 px-3 py-1.5 bg-accent text-background text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  ) : (
                    "Create"
                  )}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                {localBranches.map((branch) => (
                  <button
                    key={branch.name}
                    onClick={() => handleBranchSelect(branch.name)}
                    disabled={isLoading}
                    className={clsx(
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors",
                      branch.current
                        ? "bg-accent/10 text-accent"
                        : "hover:bg-surface-light text-text-primary"
                    )}
                  >
                    {branch.current ? (
                      <Check className="w-4 h-4" />
                    ) : (
                      <div className="w-4" />
                    )}
                    <span className="text-sm truncate flex-1">{branch.name}</span>
                  </button>
                ))}
              </div>
              <div className="border-t border-border">
                <button
                  onClick={() => setShowNewBranch(true)}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-accent hover:bg-surface-light transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-sm">New timeline</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
