"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, Terminal, Copy } from "lucide-react";
import { toast } from "sonner";
import type { DevServerDiagnosis } from "@vibogit/shared";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onRetry: () => void;
  onRunCommand: (command: string) => void;
  diagnosis: DevServerDiagnosis;
  port: number;
  command?: string;
  commandArgs?: string[];
}

function buildAiPrompt(diagnosis: DevServerDiagnosis, port: number, command: string, commandArgs: string[]): string {
  const lines = [
    "My dev server failed to start.",
    "",
    `- Command: ${command} ${commandArgs.join(" ")}`,
    `- Port: ${port}`,
    `- Error: ${diagnosis.problem}`,
  ];

  if (diagnosis.lastLogs.length > 0) {
    lines.push("");
    lines.push("Last logs:");
    const logSlice = diagnosis.lastLogs.slice(-10);
    for (const line of logSlice) {
      lines.push(line);
    }
  }

  lines.push("");
  lines.push("What terminal command(s) should I run to fix this?");

  return lines.join("\n");
}

export function DiagnosticModal({
  isOpen,
  onClose,
  onRetry,
  onRunCommand,
  diagnosis,
  port,
  command = "bun",
  commandArgs = ["run", "dev"],
}: Props) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const aiPrompt = buildAiPrompt(diagnosis, port, command, commandArgs);

  const handleRetry = () => {
    onRetry();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto bg-background border rounded-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Dev Server Error</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Problem banner */}
        <div className="flex items-start gap-3 p-3 mb-4 bg-destructive/10 border border-destructive/20 rounded-md">
          <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-destructive">{diagnosis.problem}</p>
        </div>

        {/* What happened */}
        <div className="mb-4">
          <h3 className="text-sm font-medium mb-1.5">What happened</h3>
          <p className="text-sm text-muted-foreground">{diagnosis.suggestion}</p>
        </div>

        {/* Suggested fix */}
        {diagnosis.suggestedCommand && (
          <div className="mb-4 p-3 rounded-md border bg-muted/30">
            <h3 className="text-sm font-medium mb-2">Suggested fix</h3>
            <code className="block text-sm font-mono mb-3">$ {diagnosis.suggestedCommand}</code>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => onRunCommand(diagnosis.suggestedCommand!)}
            >
              <Terminal className="w-3.5 h-3.5" />
              Run in Terminal
            </Button>
          </div>
        )}

        {/* Server logs */}
        {diagnosis.lastLogs.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium mb-1.5">Server logs</h3>
            <div
              className="rounded overflow-auto max-h-[200px] px-3 py-2"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                fontSize: "11px",
                lineHeight: "1.5",
                background: "#1e1e1e",
                color: "#d4d4d4",
              }}
            >
              {diagnosis.lastLogs.map((line, i) => (
                <div key={i} className="whitespace-pre-wrap break-all">{line}</div>
              ))}
            </div>
            <div className="flex justify-end mt-1.5">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(diagnosis.lastLogs.join("\n"));
                  toast.success("Logs copied to clipboard");
                }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy logs
              </button>
            </div>
          </div>
        )}

        {/* AI prompt */}
        <div className="mb-6">
          <h3 className="text-sm font-medium mb-1.5">Ask AI for help</h3>
          <div
            className="rounded border bg-muted/50 px-3 py-2 overflow-auto max-h-[200px]"
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
              fontSize: "11px",
              lineHeight: "1.5",
            }}
          >
            <pre className="whitespace-pre-wrap break-words text-muted-foreground">{aiPrompt}</pre>
          </div>
          <div className="flex mt-1.5">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(aiPrompt);
                toast.success("Prompt copied to clipboard");
              }}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Copy className="w-3 h-3" />
              Copy prompt
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={handleRetry}>Retry Connection</Button>
        </div>
      </div>
    </div>
  );
}
