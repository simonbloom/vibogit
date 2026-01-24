"use client";

import { useEffect, useState, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { getSettings, EDITOR_OPTIONS } from "@/lib/settings";
import { Copy, Code, FileText, Loader2, Check } from "lucide-react";
import { clsx } from "clsx";

const LANG_MAP: Record<string, string> = {
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  ts: "typescript",
  mts: "typescript",
  cts: "typescript",
  jsx: "jsx",
  tsx: "tsx",
  json: "json",
  css: "css",
  scss: "scss",
  less: "less",
  html: "html",
  htm: "html",
  md: "markdown",
  mdx: "markdown",
  py: "python",
  rs: "rust",
  go: "go",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  sql: "sql",
  graphql: "graphql",
  gql: "graphql",
  vue: "vue",
  svelte: "svelte",
  swift: "swift",
  kt: "kotlin",
  java: "java",
  c: "c",
  cpp: "cpp",
  h: "c",
  hpp: "cpp",
  rb: "ruby",
  php: "php",
  xml: "xml",
  svg: "xml",
};

const MAX_LINES = 10000;

interface CodeViewerProps {
  filePath: string | null;
  fileName: string;
  repoPath: string | null;
}

export function CodeViewer({ filePath, fileName, repoPath }: CodeViewerProps) {
  const { send } = useDaemon();
  const [content, setContent] = useState<string>("");
  const [highlightedHtml, setHighlightedHtml] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [copied, setCopied] = useState(false);

  const getLanguage = useCallback((filename: string): string => {
    const ext = filename.split(".").pop()?.toLowerCase() || "";
    return LANG_MAP[ext] || "text";
  }, []);

  useEffect(() => {
    if (!filePath || !repoPath) {
      setContent("");
      setHighlightedHtml("");
      setError(null);
      return;
    }

    const loadFile = async () => {
      setIsLoading(true);
      setError(null);
      setIsTruncated(false);

      try {
        const response = await send<{ content: string; isBinary?: boolean }>("readFile", {
          repoPath,
          filePath,
        });

        if (response.isBinary) {
          setError("Cannot display binary file");
          setContent("");
          setHighlightedHtml("");
          return;
        }

        let fileContent = response.content || "";
        const lines = fileContent.split("\n");

        if (lines.length > MAX_LINES) {
          fileContent = lines.slice(0, MAX_LINES).join("\n");
          setIsTruncated(true);
        }

        setContent(fileContent);

        // Dynamically import shiki
        const shiki = await import("shiki");
        const highlighter = await shiki.createHighlighter({
          themes: ["github-dark"],
          langs: [getLanguage(fileName)],
        });

        const html = highlighter.codeToHtml(fileContent, {
          lang: getLanguage(fileName),
          theme: "github-dark",
        });

        setHighlightedHtml(html);
      } catch (err) {
        console.error("Failed to load file:", err);
        setError("Failed to load file");
        setContent("");
        setHighlightedHtml("");
      } finally {
        setIsLoading(false);
      }
    };

    loadFile();
  }, [filePath, repoPath, fileName, send, getLanguage]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleOpenInEditor = async () => {
    if (!filePath || !repoPath) return;

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

  // Empty state
  if (!filePath) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
        <FileText className="w-12 h-12 mb-4 opacity-50" />
        <p>Select a file to view</p>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium truncate">{fileName}</span>
        </div>
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
          <span className="text-sm font-medium truncate">{fileName}</span>
          <button
            onClick={handleOpenInEditor}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
            title="Open in editor"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground">
          <FileText className="w-12 h-12 mb-4 opacity-50" />
          <p>{error}</p>
          <button
            onClick={handleOpenInEditor}
            className="mt-4 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Open in IDE
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-medium truncate">{fileName}</span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className={clsx(
              "p-1.5 rounded hover:bg-muted transition-colors",
              copied ? "text-green-500" : "text-muted-foreground hover:text-foreground"
            )}
            title={copied ? "Copied!" : "Copy code"}
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
          <button
            onClick={handleOpenInEditor}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded hover:bg-muted"
            title="Open in editor"
          >
            <Code className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {isTruncated && (
          <div className="px-4 py-2 bg-yellow-500/10 border-b border-yellow-500/20 text-yellow-600 text-sm">
            File truncated to {MAX_LINES.toLocaleString()} lines.{" "}
            <button onClick={handleOpenInEditor} className="underline hover:no-underline">
              Open in IDE
            </button>{" "}
            to view full content.
          </div>
        )}
        <div
          className="code-viewer-content text-sm [&_pre]:p-4 [&_pre]:m-0 [&_pre]:overflow-x-auto [&_code]:font-mono"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      </div>
    </div>
  );
}
