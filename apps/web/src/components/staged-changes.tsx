"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Check, Minus, FileText, FilePlus, FileX, Loader2 } from "lucide-react";
import { clsx } from "clsx";

interface StagedChangesProps {
  repoPath: string | null;
}

export function StagedChanges({ repoPath }: StagedChangesProps) {
  const { state, send, refreshStatus } = useDaemon();
  const { status } = state;
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
  const [isStaging, setIsStaging] = useState(false);

  const allChanges = [
    ...(status?.staged.map((f) => ({ ...f, source: "staged" as const })) || []),
    ...(status?.unstaged.map((f) => ({ ...f, source: "unstaged" as const })) || []),
    ...(status?.untracked.map((f) => ({ ...f, source: "untracked" as const })) || []),
  ];

  // Auto-stage all files on mount or when changes update
  useEffect(() => {
    const allPaths = new Set(allChanges.map((f) => f.path));
    setStagedFiles(allPaths);
  }, [status]);

  const toggleFile = (path: string) => {
    setStagedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (stagedFiles.size === allChanges.length) {
      setStagedFiles(new Set());
    } else {
      setStagedFiles(new Set(allChanges.map((f) => f.path)));
    }
  };

  const stageSelected = async () => {
    if (!repoPath || stagedFiles.size === 0) return;
    setIsStaging(true);
    try {
      // Unstage everything first
      const currentlyStaged = status?.staged.map((f) => f.path) || [];
      if (currentlyStaged.length > 0) {
        await send("unstage", { repoPath, files: currentlyStaged });
      }
      // Stage selected files
      const filesToStage = Array.from(stagedFiles);
      if (filesToStage.length > 0) {
        await send("stage", { repoPath, files: filesToStage });
      }
      await refreshStatus();
    } catch (error) {
      console.error("Failed to stage files:", error);
    } finally {
      setIsStaging(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "added":
      case "untracked":
        return <FilePlus className="w-4 h-4 text-green-600" />;
      case "deleted":
        return <FileX className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-yellow-600" />;
    }
  };

  if (allChanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Check className="w-8 h-8 mb-2" />
        <p>No changes</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <button
          onClick={toggleAll}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <div className={clsx(
            "w-4 h-4 border rounded flex items-center justify-center",
            stagedFiles.size === allChanges.length ? "bg-primary border-primary" : "border-input"
          )}>
            {stagedFiles.size === allChanges.length && <Check className="w-3 h-3 text-primary-foreground" />}
            {stagedFiles.size > 0 && stagedFiles.size < allChanges.length && <Minus className="w-3 h-3" />}
          </div>
          {stagedFiles.size} of {allChanges.length} selected
        </button>
        <button
          onClick={stageSelected}
          disabled={isStaging || stagedFiles.size === 0}
          className="px-3 py-1 text-sm bg-primary text-primary-foreground rounded-md disabled:opacity-50"
        >
          {isStaging ? <Loader2 className="w-4 h-4 animate-spin" /> : "Stage Selected"}
        </button>
      </div>
      <div className="flex-1 overflow-auto">
        {allChanges.map((file) => (
          <button
            key={file.path}
            onClick={() => toggleFile(file.path)}
            className="w-full flex items-center gap-3 px-4 py-2 text-left hover:bg-muted/50 border-b border-border/50"
          >
            <div className={clsx(
              "w-4 h-4 border rounded flex items-center justify-center flex-shrink-0",
              stagedFiles.has(file.path) ? "bg-primary border-primary" : "border-input"
            )}>
              {stagedFiles.has(file.path) && <Check className="w-3 h-3 text-primary-foreground" />}
            </div>
            {getStatusIcon(file.status)}
            <span className="text-sm truncate flex-1">{file.path}</span>
            <span className="text-xs text-muted-foreground">{file.status}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
