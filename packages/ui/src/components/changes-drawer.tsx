"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { clsx } from "clsx";
import { File, Loader2 } from "lucide-react";
import type { GitFile, GitDiff } from "@vibogit/shared";

interface ChangesDrawerProps {
  file: GitFile | null;
  repoPath: string | null;
}

export function ChangesDrawer({ file, repoPath }: ChangesDrawerProps) {
  const { send } = useDaemon();
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !repoPath) {
      setDiff(null);
      return;
    }

    const loadDiff = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await send<{ diff: GitDiff }>("diff", {
          repoPath,
          file: file.path,
          staged: file.staged,
        });
        setDiff(response.diff);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load diff");
        setDiff(null);
      } finally {
        setIsLoading(false);
      }
    };

    loadDiff();
  }, [file, repoPath, send]);

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted">
        <File className="w-12 h-12 mb-4 opacity-50" />
        <p>Select a file to see changes</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-text-muted">
        <Loader2 className="w-8 h-8 animate-spin mb-4" />
        <p>Loading diff...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-status-deleted">
        <p>{error}</p>
      </div>
    );
  }

  if (!diff || diff.hunks.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <DiffHeader file={file} />
        <div className="flex-1 flex items-center justify-center text-text-muted">
          {file.status === "untracked" ? (
            <p>New file (not yet tracked)</p>
          ) : (
            <p>No changes to display</p>
          )}
        </div>
      </div>
    );
  }

  if (diff.isBinary) {
    return (
      <div className="flex flex-col h-full">
        <DiffHeader file={file} />
        <div className="flex-1 flex items-center justify-center text-text-muted">
          <p>Binary file changed</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <DiffHeader file={file} />
      <div className="flex-1 overflow-auto">
        <div className="min-w-fit">
          {diff.hunks.map((hunk, hunkIndex) => (
            <div key={hunkIndex} className="border-b border-border">
              <div className="px-4 py-2 bg-surface text-text-muted text-sm font-mono">
                @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
              </div>
              <div className="font-mono text-sm">
                {hunk.lines.map((line, lineIndex) => (
                  <div
                    key={lineIndex}
                    className={clsx(
                      "flex",
                      line.type === "add" && "bg-status-added/10",
                      line.type === "delete" && "bg-status-deleted/10"
                    )}
                  >
                    <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-text-muted select-none border-r border-border">
                      {line.oldLineNumber || ""}
                    </div>
                    <div className="w-12 flex-shrink-0 px-2 py-0.5 text-right text-text-muted select-none border-r border-border">
                      {line.newLineNumber || ""}
                    </div>
                    <div className="w-6 flex-shrink-0 px-1 py-0.5 text-center select-none">
                      <span
                        className={clsx(
                          line.type === "add" && "text-status-added",
                          line.type === "delete" && "text-status-deleted",
                          line.type === "context" && "text-text-muted"
                        )}
                      >
                        {line.type === "add" ? "+" : line.type === "delete" ? "-" : " "}
                      </span>
                    </div>
                    <div className="flex-1 px-2 py-0.5 overflow-x-auto">
                      <pre
                        className={clsx(
                          "whitespace-pre",
                          line.type === "add" && "text-status-added",
                          line.type === "delete" && "text-status-deleted",
                          line.type === "context" && "text-text-primary"
                        )}
                      >
                        {line.content || " "}
                      </pre>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function DiffHeader({ file }: { file: GitFile }) {
  const statusColors = {
    modified: "text-status-modified",
    added: "text-status-added",
    deleted: "text-status-deleted",
    untracked: "text-status-untracked",
    renamed: "text-status-modified",
    copied: "text-status-added",
  };

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface">
      <span className={clsx("text-xs font-medium uppercase", statusColors[file.status])}>
        {file.status}
      </span>
      <span className="text-text-primary font-mono text-sm">{file.path}</span>
      {file.staged && (
        <span className="text-xs bg-status-added/20 text-status-added px-2 py-0.5 rounded">
          Staged
        </span>
      )}
    </div>
  );
}
