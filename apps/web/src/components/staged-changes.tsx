"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { AICommitButton } from "@/components/ai-commit-button";
import { FileViewer } from "@/components/file-viewer";
import { Check, FileText, FilePlus, FileX, ArrowUp, ArrowDown, Loader2 } from "lucide-react";

interface StagedChangesProps {
  repoPath: string | null;
}

export function StagedChanges({ repoPath }: StagedChangesProps) {
  const { state, send, refreshStatus } = useDaemon();
  const { status } = state;
  const [toCommit, setToCommit] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState("");
  const [isCommitting, setIsCommitting] = useState(false);
  const [selectedFile, setSelectedFile] = useState<{ path: string; status: string } | null>(null);

  const allFiles = [
    ...(status?.staged || []),
    ...(status?.unstaged || []),
    ...(status?.untracked || []),
  ];

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

  const handleCommit = async () => {
    if (!repoPath || filesToCommit.length === 0 || !commitMessage.trim()) return;
    setIsCommitting(true);
    try {
      const currentlyStaged = status?.staged.map((f) => f.path) || [];
      if (currentlyStaged.length > 0) {
        await send("unstage", { repoPath, files: currentlyStaged });
      }
      await send("stage", { repoPath, files: filesToCommit.map((f) => f.path) });
      await send("commit", { repoPath, message: commitMessage });
      setCommitMessage("");
      setSelectedFile(null);
      await refreshStatus();
    } catch (error) {
      console.error("Failed to commit:", error);
    } finally {
      setIsCommitting(false);
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

  const getStatusColor = (fileStatus: string) => {
    switch (fileStatus) {
      case "added":
      case "untracked":
        return "text-green-700";
      case "deleted":
        return "text-red-600 line-through";
      default:
        return "text-yellow-700";
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
    <div className="flex h-full">
      {/* Left: File cards */}
      <div className="w-1/2 flex flex-col gap-4 p-4 overflow-auto border-r">
        {/* Will Commit Card */}
        <div className="rounded-lg border-2 border-green-200 bg-green-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-green-100 border-b border-green-200">
            <span className="text-sm font-semibold text-green-800">
              Will Commit ({filesToCommit.length})
            </span>
          </div>
          {filesToCommit.length === 0 ? (
            <div className="px-4 py-4 text-sm text-green-700 text-center italic">
              No files selected
            </div>
          ) : (
            <div className="divide-y divide-green-200 max-h-48 overflow-auto">
              {filesToCommit.map((file) => (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile({ path: file.path, status: file.status })}
                  className={`flex items-center gap-2 px-3 py-1.5 hover:bg-green-100/50 cursor-pointer ${
                    selectedFile?.path === file.path ? "bg-green-200/50" : ""
                  }`}
                >
                  {getStatusIcon(file.status)}
                  <span className={`text-sm truncate flex-1 ${getStatusColor(file.status)}`}>
                    {file.path}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); excludeFile(file.path); }}
                    className="p-1 text-green-600 hover:text-green-800 hover:bg-green-200 rounded"
                    title="Exclude"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {/* Commit Input */}
          <div className="px-3 py-2 bg-green-100/50 border-t border-green-200">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Commit message..."
                className="flex-1 px-2 py-1 text-sm border border-green-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
                onKeyDown={(e) => e.key === "Enter" && handleCommit()}
              />
              <AICommitButton
                onMessageGenerated={setCommitMessage}
                disabled={filesToCommit.length === 0}
              />
              <button
                onClick={handleCommit}
                disabled={isCommitting || filesToCommit.length === 0 || !commitMessage.trim()}
                className="px-3 py-1 text-sm font-medium bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
              >
                {isCommitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Commit"}
              </button>
            </div>
          </div>
        </div>

        {/* Won't Commit Card */}
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="px-4 py-2 bg-muted border-b">
            <span className="text-sm font-semibold text-muted-foreground">
              Won't Commit ({filesExcluded.length})
            </span>
          </div>
          {filesExcluded.length === 0 ? (
            <div className="px-4 py-4 text-sm text-muted-foreground text-center italic">
              All files staged
            </div>
          ) : (
            <div className="divide-y max-h-48 overflow-auto">
              {filesExcluded.map((file) => (
                <div
                  key={file.path}
                  onClick={() => setSelectedFile({ path: file.path, status: file.status })}
                  className={`flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 cursor-pointer ${
                    selectedFile?.path === file.path ? "bg-muted" : ""
                  }`}
                >
                  {getStatusIcon(file.status)}
                  <span className={`text-sm truncate flex-1 ${getStatusColor(file.status)}`}>
                    {file.path}
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); includeFile(file.path); }}
                    className="p-1 text-muted-foreground hover:text-foreground hover:bg-muted rounded"
                    title="Include"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right: File Viewer */}
      <div className="w-1/2 border-l bg-muted/20">
        <FileViewer
          repoPath={repoPath}
          filePath={selectedFile?.path || null}
          fileStatus={selectedFile?.status || ""}
        />
      </div>
    </div>
  );
}
