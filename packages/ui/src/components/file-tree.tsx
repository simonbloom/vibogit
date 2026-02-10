"use client";

import { useEffect, useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { getSettings, EDITOR_OPTIONS } from "@/lib/settings";
import { getPinnedPaths, togglePin } from "@/lib/pin-storage";
import { Button } from "@/components/ui/button";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
} from "@/components/ui/context-menu";
import {
  Folder,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Loader2,
  Code,
  Eye,
  EyeOff,
  Pin,
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

function sortWithPins(nodes: FileNode[], pinnedSet: Set<string>): FileNode[] {
  return [...nodes].sort((a, b) => {
    const aPinned = pinnedSet.has(a.path);
    const bPinned = pinnedSet.has(b.path);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function FileTree({ repoPath, selectedPath, onFileSelect }: FileTreeProps) {
  const { send } = useDaemon();
  const [tree, setTree] = useState<FileNode[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [hoveredPath, setHoveredPath] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [pinnedPaths, setPinnedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (repoPath) {
      setPinnedPaths(new Set(getPinnedPaths(repoPath)));
    }
  }, [repoPath]);

  const loadTree = useCallback(async () => {
    if (!repoPath) {
      setTree([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await send<{ tree: FileNode[] }>("listFiles", {
        path: repoPath,
        showHidden,
      });
      setTree(response.tree || []);
    } catch (error) {
      console.error("Failed to load file tree:", error);
      setTree([]);
    } finally {
      setIsLoading(false);
    }
  }, [repoPath, send, showHidden]);

  useEffect(() => {
    loadTree();
  }, [loadTree]);

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

  const handleTogglePin = (filePath: string) => {
    if (!repoPath) return;
    const updated = togglePin(repoPath, filePath);
    setPinnedPaths(new Set(updated));
  };

  const handleOpenInEditor = async (filePath: string) => {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (tree.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium text-muted-foreground">Files</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowHidden(!showHidden)}
            title={showHidden ? "Hide hidden files" : "Show hidden files"}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </Button>
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
    const nodeIsPinned = pinnedPaths.has(node.path);

    const nodeContent = (
      <div
        className={clsx(
          "group w-full flex items-center gap-2 px-3 py-1.5 hover:bg-muted/50 transition-colors text-left relative",
          "cursor-pointer",
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
        {nodeIsPinned && <Pin className="w-3 h-3 text-primary shrink-0" />}
        <span className="text-sm truncate flex-1">{node.name}</span>
        {!isDirectory && isHovered && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenInEditor(node.path);
            }}
            title="Open in editor"
          >
            <Code className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>
    );

    const sortedChildren = isDirectory && node.children
      ? sortWithPins(node.children, pinnedPaths)
      : [];

    return (
      <div key={node.path}>
        <ContextMenu>
          <ContextMenuTrigger asChild>
            {nodeContent}
          </ContextMenuTrigger>
          <ContextMenuContent>
            <ContextMenuItem onClick={() => handleTogglePin(node.path)}>
              <Pin className="w-4 h-4 mr-2" />
              {nodeIsPinned ? "Unpin" : "Pin to Top"}
            </ContextMenuItem>
            {!isDirectory && (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem onClick={() => handleOpenInEditor(node.path)}>
                  <Code className="w-4 h-4 mr-2" />
                  Open in Editor
                </ContextMenuItem>
              </>
            )}
          </ContextMenuContent>
        </ContextMenu>
        {isDirectory && isExpanded && node.children && (
          <div>
            {sortedChildren.map((child) => renderNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sortedTree = sortWithPins(tree, pinnedPaths);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <span className="text-sm font-medium text-muted-foreground">Files</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={() => setShowHidden(!showHidden)}
          title={showHidden ? "Hide hidden files" : "Show hidden files"}
        >
          {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
        </Button>
      </div>
      <div className="flex-1 overflow-auto py-2 min-h-0">
        {sortedTree.map((node) => renderNode(node))}
      </div>
    </div>
  );
}
