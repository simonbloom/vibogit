"use client";

import { useDaemon } from "@/lib/daemon-context";
import { Check, FileText, FilePlus, FileX, ArrowUp, ArrowDown } from "lucide-react";

interface StagedChangesProps {
  repoPath: string | null;
}

export function StagedChanges({ repoPath }: StagedChangesProps) {
  const { state, send, refreshStatus } = useDaemon();
  const { status } = state;

  const stagedFiles = status?.staged || [];
  const unstagedFiles = [
    ...(status?.unstaged || []),
    ...(status?.untracked || []),
  ];

  const stageFile = async (path: string) => {
    if (!repoPath) return;
    try {
      await send("stage", { repoPath, files: [path] });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to stage file:", error);
    }
  };

  const unstageFile = async (path: string) => {
    if (!repoPath) return;
    try {
      await send("unstage", { repoPath, files: [path] });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to unstage file:", error);
    }
  };

  const stageAll = async () => {
    if (!repoPath || unstagedFiles.length === 0) return;
    try {
      await send("stage", { repoPath, files: unstagedFiles.map((f) => f.path) });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to stage all:", error);
    }
  };

  const unstageAll = async () => {
    if (!repoPath || stagedFiles.length === 0) return;
    try {
      await send("unstage", { repoPath, files: stagedFiles.map((f) => f.path) });
      await refreshStatus();
    } catch (error) {
      console.error("Failed to unstage all:", error);
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

  if (stagedFiles.length === 0 && unstagedFiles.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-8">
        <Check className="w-8 h-8 mb-2" />
        <p>No changes</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Staged (Ready to Commit) */}
      <div className="border-b">
        <div className="flex items-center justify-between px-4 py-2 bg-green-50 border-b">
          <span className="text-sm font-medium text-green-800">
            Staged for commit ({stagedFiles.length})
          </span>
          {stagedFiles.length > 0 && (
            <button
              onClick={unstageAll}
              className="text-xs text-green-700 hover:text-green-900"
            >
              Unstage all
            </button>
          )}
        </div>
        {stagedFiles.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground italic">
            No files staged
          </div>
        ) : (
          <div className="max-h-48 overflow-auto">
            {stagedFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 border-b border-border/50"
              >
                {getStatusIcon(file.status)}
                <span className="text-sm truncate flex-1">{file.path}</span>
                <span className="text-xs text-muted-foreground">{file.status}</span>
                <button
                  onClick={() => unstageFile(file.path)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                  title="Unstage"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unstaged (Not committing) */}
      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-4 py-2 bg-muted/50 border-b">
          <span className="text-sm font-medium text-muted-foreground">
            Not staged ({unstagedFiles.length})
          </span>
          {unstagedFiles.length > 0 && (
            <button
              onClick={stageAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Stage all
            </button>
          )}
        </div>
        {unstagedFiles.length === 0 ? (
          <div className="px-4 py-3 text-sm text-muted-foreground italic">
            All changes staged
          </div>
        ) : (
          <div className="flex-1 overflow-auto">
            {unstagedFiles.map((file) => (
              <div
                key={file.path}
                className="flex items-center gap-3 px-4 py-2 hover:bg-muted/50 border-b border-border/50"
              >
                {getStatusIcon(file.status)}
                <span className="text-sm truncate flex-1">{file.path}</span>
                <span className="text-xs text-muted-foreground">{file.status}</span>
                <button
                  onClick={() => stageFile(file.path)}
                  className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                  title="Stage"
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
