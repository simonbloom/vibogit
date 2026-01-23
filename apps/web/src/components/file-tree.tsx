"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
} from "lucide-react";
import { clsx } from "clsx";

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

interface FileTreeProps {
  repoPath: string | null;
}

export function FileTree({ repoPath }: FileTreeProps) {
  const { send } = useDaemon();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!repoPath) {
      setTree([]);
      return;
    }

    const loadTree = async () => {
      setIsLoading(true);
      try {
        const response = await send<{ tree: FileNode[] }>("listFiles", {
          path: repoPath,
        });
        setTree(response.tree || []);
      } catch (error) {
        console.error("Failed to load file tree:", error);
        setTree([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadTree();
  }, [repoPath, send]);

  const toggleExpanded = (path: string) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-accent" />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-text-muted">
        No files to display
      </div>
    );
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isDirectory = node.type === "directory";

    return (
      <div key={node.path}>
        <button
          onClick={() => isDirectory && toggleExpanded(node.path)}
          className={clsx(
            "w-full flex items-center gap-2 px-3 py-1.5 hover:bg-surface-light transition-colors text-left",
            isDirectory ? "cursor-pointer" : "cursor-default"
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {isDirectory ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-text-muted" />
              ) : (
                <ChevronRight className="w-4 h-4 text-text-muted" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-accent" />
              ) : (
                <Folder className="w-4 h-4 text-accent" />
              )}
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileText className="w-4 h-4 text-text-muted" />
            </>
          )}
          <span className="text-sm text-text-primary truncate">{node.name}</span>
        </button>
        {isDirectory && isExpanded && node.children && (
          <div>
            {node.children.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="py-2">
      {tree.map((node) => renderNode(node))}
    </div>
  );
}
