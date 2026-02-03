"use client";

import { useState, useEffect } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { FileText, Loader2, AlertTriangle } from "lucide-react";
import type { GitDiff } from "@vibogit/shared";

interface FileViewerProps {
  repoPath: string | null;
  filePath: string | null;
  fileStatus: string;
}

export function FileViewer({ repoPath, filePath, fileStatus }: FileViewerProps) {
  const { send } = useDaemon();
  const [diff, setDiff] = useState<GitDiff | null>(null);
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!repoPath || !filePath) {
      setDiff(null);
      setContent(null);
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      setError(null);
      try {
        if (fileStatus === "untracked") {
          const result = await send<{ content: string }>("readFile", {
            repoPath,
            filePath,
          });
          setContent(result.content);
          setDiff(null);
        } else {
          const result = await send<{ diff: GitDiff }>("diff", {
            repoPath,
            file: filePath,
            staged: false,
          });
          setDiff(result.diff);
          setContent(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load file");
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [repoPath, filePath, fileStatus, send]);

  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="w-12 h-12 mb-2 opacity-50" />
        <p className="text-sm">Select a file to view</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <AlertTriangle className="w-8 h-8 mb-2 text-yellow-500" />
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  // Render new file content
  if (content !== null) {
    const lines = content.split("\n");
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 bg-green-50 border-b text-sm font-medium text-green-800">
          {filePath} <span className="text-green-600">(new file)</span>
        </div>
        <div className="flex-1 overflow-auto font-mono text-xs">
          {lines.map((line, i) => (
            <div key={i} className="flex hover:bg-muted/30">
              <span className="w-10 px-2 py-0.5 text-right text-muted-foreground bg-muted/50 select-none border-r text-[10px]">
                {i + 1}
              </span>
              <span className="px-2 py-0.5 flex-1 bg-green-50 text-green-900 whitespace-pre overflow-x-auto">
                {line || " "}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Render diff
  if (diff) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 bg-muted border-b text-sm font-medium">
          {filePath}
        </div>
        <div className="flex-1 overflow-auto font-mono text-xs">
          {diff.hunks.length === 0 ? (
            <div className="p-4 text-muted-foreground text-center">No changes</div>
          ) : (
            diff.hunks.map((hunk, hunkIndex) => (
              <div key={hunkIndex} className="mb-2">
                <div className="px-2 py-1 bg-blue-50 text-blue-700 text-[10px]">
                  @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                </div>
                {hunk.lines.map((line, lineIndex) => {
                  const bgColor =
                    line.type === "add"
                      ? "bg-green-50"
                      : line.type === "delete"
                      ? "bg-red-50"
                      : "";
                  const textColor =
                    line.type === "add"
                      ? "text-green-800"
                      : line.type === "delete"
                      ? "text-red-800"
                      : "";
                  const prefix =
                    line.type === "add" ? "+" : line.type === "delete" ? "-" : " ";

                  return (
                    <div key={lineIndex} className={`flex hover:bg-muted/30 ${bgColor}`}>
                      <span className="w-10 px-1 py-0.5 text-right text-muted-foreground bg-muted/50 select-none border-r text-[10px]">
                        {line.oldLineNumber || ""}
                      </span>
                      <span className="w-10 px-1 py-0.5 text-right text-muted-foreground bg-muted/50 select-none border-r text-[10px]">
                        {line.newLineNumber || ""}
                      </span>
                      <span className={`px-2 py-0.5 flex-1 whitespace-pre overflow-x-auto ${textColor}`}>
                        {prefix}{line.content}
                      </span>
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  return null;
}
