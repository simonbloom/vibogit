"use client";

import { useEffect, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { getSettings, saveSettings, EDITOR_OPTIONS } from "@/lib/settings";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Code,
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
  selectedPath?: string;
  onFileSelect?: (file: { path: string; name: string }) => void;
}

export function FileTree({ repoPath, selectedPath, onFileSelect }: FileTreeProps) {
  const { send } = useDaemon();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [showHidden, setShowHidden] = useState(() => getSettings().showHiddenFiles);
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);

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

  const handleToggleHidden = () => {
    const newValue = !showHidden;
    setShowHidden(newValue);
    saveSettings({ showHiddenFiles: newValue });
  };

  const handleOpenInEditor = async (e: React.MouseEvent, filePath: string) => {
    e.stopPropagation();
    if (!repoPath) return;

    const settings = getSettings();
    const editorConfig = EDITOR_OPTIONS.find((ed) => ed.id === settings.editor);
    const fullPath = `${repoPath}/${filePath}`;

    try {
      if (settings.editor === "custom") {
        const command = settings.customEditorCommand;
        if (command) {
          await send("openEditor", { path: fullPath, editor: command });
        }
      } else if (editorConfig?.appName) {
        await send("openEditor", { path: fullPath, appName: editorConfig.appName });
      }
    } catch (error) {
      console.error("Failed to open in editor:", error);
    }
  };

  const filterHidden = (nodes: FileNode[]): FileNode[] => {
    if (showHidden) return nodes;
    return nodes
      .filter((node) => !node.name.startsWith("."))
      .map((node) => ({
        ...node,
        children: node.children ? filterHidden(node.children) : undefined,
      }));
  };

  const filteredTree = filterHidden(tree);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end px-3 py-2 border-b">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={handleToggleHidden}
              className="rounded"
            />
            Show hidden
          </label>
        </div>
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (filteredTree.length === 0) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-end px-3 py-2 border-b">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showHidden}
              onChange={handleToggleHidden}
              className="rounded"
            />
            Show hidden
          </label>
        </div>
        <div className="flex items-center justify-center flex-1 text-muted-foreground">
          No files to display
        </div>
      </div>
    );
  }

  const renderNode = (node: FileNode, depth: number = 0) => {
    const isExpanded = expandedPaths.has(node.path);
    const isDirectory = node.type === "directory";
    const isSelected = selectedPath === node.path;
    const isHovered = hoveredPath === node.path;

    return (
      <div key={node.path}>
        <div
          className={clsx(
            "group w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors text-left relative",
            isDirectory ? "cursor-pointer" : "cursor-pointer",
            isSelected && !isDirectory && "bg-muted"
          )}
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
          onClick={() => {
            if (isDirectory) {
              toggleExpanded(node.path);
            } else if (onFileSelect) {
              onFileSelect({ path: node.path, name: node.name });
            }
          }}
          onMouseEnter={() => !isDirectory && setHoveredPath(node.path)}
          onMouseLeave={() => setHoveredPath(null)}
        >
          {isDirectory ? (
            <>
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              )}
              {isExpanded ? (
                <FolderOpen className="w-4 h-4 text-primary" />
              ) : (
                <Folder className="w-4 h-4 text-primary" />
              )}
            </>
          ) : (
            <>
              <span className="w-4" />
              <FileText className="w-4 h-4 text-muted-foreground" />
            </>
          )}
          <span className="text-sm truncate flex-1">{node.name}</span>
          {!isDirectory && isHovered && (
            <button
              onClick={(e) => handleOpenInEditor(e, node.path)}
              className="p-1 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
              title="Open in editor"
            >
              <Code className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {isDirectory && isExpanded && node.children && (
          <div>
            {filterHidden(node.children).map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end px-3 py-2 border-b">
        <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
          <input
            type="checkbox"
            checked={showHidden}
            onChange={handleToggleHidden}
            className="rounded"
          />
          Show hidden
        </label>
      </div>
      <div className="flex-1 overflow-auto py-2">
        {filteredTree.map((node) => renderNode(node))}
      </div>
    </div>
  );
}
