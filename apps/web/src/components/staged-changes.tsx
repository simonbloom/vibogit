"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Check, FileText, FilePlus, FileX, ArrowUp, ArrowDown } from "lucide-react";

interface StagedChangesProps {
  repoPath: string | null;
}

export function StagedChanges({ repoPath }: StagedChangesProps) {
  const { state, send, refreshStatus } = useDaemon();
  const { status } = state;
  const [toCommit, setToCommit] = useState<Set<string>>(new Set());

  const allFiles = [
    ...(status?.staged || []),
    ...(status?.unstaged || []),
    ...(status?.untracked || []),
  ];

  // Auto-add all files to commit when changes update
  useEffect(() => {
    setToCommit(new Set(allFiles.map((f) => f.path)));
  }, [status]);

  const filesToCommit = allFiles.filter((f) => toCommit.has(f.path));
  const filesExcluded = allFiles.filter((f) => !toCommit.has(f.path));

  const excludeFile = (path: string) => {
    setToCommit((prev) => {
      const next = new Set(prev);
      next.delete(path);
      return next;
    });
  };

  const includeFile = (path: string) => {
    setToCommit((prev) => new Set(prev).add(path));
  };

  const stageForCommit = async () => {
    if (!repoPath || filesToCommit.length === 0) return;
    try {
      // Unstage everything first
      const currentlyStaged = status?.staged.map((f) => f.path) || [];
      if (currentlyStaged.length > 0) {
        await send("unstage", { repoPath, files: currentlyStaged });
      }
      // Stage only selected files
      await send("stage", { repoPath, files: filesToCommit.map((f) => f.path) });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to stage:", error);
    }
  };

  const getStatusIcon = (fileStatus: string) => {
    switch (fileStatus) {
      case "added":
      case "untracked":
        return <FilePlus className="w-4 h-4 text-green-600" />;
      case "deleted":
        return <FileX className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-yellow-600" />;
    }
  };

  if (allFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Check className="w-8 h-8 mb-2" />
        <p>No changes</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 h-full overflow-auto">
      {/* To Commit Card */}
      <div className="rounded-lg border-2 border-green-200 bg-green-50 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-green-100 border-b border-green-200">
          <span className="text-sm font-semibold text-green-800">
            Will Commit ({filesToCommit.length})
          </span>
          {filesToCommit.length > 0 && (
            <button
              onClick={stageForCommit}
              className="px-3 py-1 text-xs font-medium bg-green-600 text-white rounded hover:bg-green-700"
            >
              Stage All
            </button>
          )}
        </div>
        {filesToCommit.length === 0 ? (
          <div className="px-4 py-6 text-sm text-green-700 text-center italic">
            No files selected for commit
          </div>
        ) : (
          <div className="divide-y divide-green-200">
            {filesToCommit.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-3 px-4 py-2 hover:bg-green-100/50"
              >
                {getStatusIcon(file.status)}
                <span className="text-sm truncate flex-1 text-green-900">{file.path}</span>
                <span className="text-xs text-green-600">{file.status}</span>
                <button
                  onClick={() => excludeFile(file.path)}
                  className="p-1.5 text-green-600 hover:text-green-800 hover:bg-green-200 rounded"
                  title="Exclude from commit"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Excluded Card */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-muted border-b">
          <span className="text-sm font-semibold text-muted-foreground">
            Won't Commit ({filesExcluded.length})
          </span>
        </div>
        {filesExcluded.length === 0 ? (
          <div className="px-4 py-6 text-sm text-muted-foreground text-center italic">
            All files will be committed
          </div>
        ) : (
          <div className="divide-y">
            {filesExcluded.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50"
              >
                {getStatusIcon(file.status)}
                <span className="text-sm truncate flex-1">{file.path}</span>
                <span className="text-xs text-muted-foreground">{file.status}</span>
                <button
                  onClick={() => includeFile(file.path)}
                  className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                  title="Include in commit"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
