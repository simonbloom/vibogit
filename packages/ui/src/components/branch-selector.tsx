"use client";

import { useState, useRef, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
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
    if (!pendingBranch || !repoPath) return;

    setIsLoading(true);
    try {
      await send("stashSave", { repoPath, message: `Auto-stash before switching to ${pendingBranch}` });
      await switchBranch(pendingBranch);
    } catch (error) {
      console.error("Failed to stash and switch:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="secondary"
        size="sm"
        onClick={() => setIsOpen(!isOpen)}
      >
        <GitBranch className="w-4 h-4 text-primary" />
        <span>{currentBranch?.name || "No branch"}</span>
        <ChevronDown className={clsx("w-4 h-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
      </Button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-popover border rounded-lg shadow-xl z-50 overflow-hidden">
          {showUnsavedWarning ? (
            <div className="p-4">
              <div className="flex items-start gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Unsaved changes</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    You have uncommitted changes. What would you like to do?
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Button
                  className="w-full"
                  onClick={handleStashAndSwitch}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Stash & Switch"}
                </Button>
                <Button
                  variant="secondary"
                  className="w-full"
                  onClick={() => switchBranch(pendingBranch!)}
                  disabled={isLoading}
                >
                  Switch anyway (discard changes)
                </Button>
                <Button
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowUnsavedWarning(false);
                    setPendingBranch(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : showNewBranch ? (
            <div className="p-3">
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="new-branch-name"
                className="w-full px-3 py-2 bg-background border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateBranch();
                  if (e.key === "Escape") setShowNewBranch(false);
                }}
              />
              <div className="flex gap-2 mt-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setShowNewBranch(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={handleCreateBranch}
                  disabled={isLoading || !newBranchName.trim()}
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create"}
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-64 overflow-y-auto">
                {localBranches.map((branch) => (
                  <Button
                    key={branch.name}
                    variant="ghost"
                    onClick={() => handleBranchSelect(branch.name)}
                    disabled={isLoading}
                    className={clsx(
                      "w-full justify-start gap-3 rounded-none",
                      branch.current && "bg-primary/10 text-primary"
                    )}
                  >
                    {branch.current ? <Check className="w-4 h-4" /> : <div className="w-4" />}
                    <span className="truncate flex-1 text-left">{branch.name}</span>
                  </Button>
                ))}
              </div>
              <div className="border-t">
                <Button
                  variant="ghost"
                  onClick={() => setShowNewBranch(true)}
                  className="w-full justify-start gap-3 rounded-none text-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span>New timeline</span>
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
