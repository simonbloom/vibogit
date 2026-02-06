import { useState, useEffect, useRef, useCallback } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { ChevronDown, ChevronRight, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { DevServerState } from "@vibogit/shared";

interface Props {
  repoPath: string | null;
  expanded?: boolean; // When true, show full-height logs without toggle
}

export function DevServerLogs({ repoPath, expanded: alwaysExpanded }: Props) {
  const { send, state: daemonState } = useDaemon();
  const [internalExpanded, setInternalExpanded] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("devServerLogsExpanded") === "true";
  });
  const [logs, setLogs] = useState<string[]>([]);
  const [cleared, setCleared] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLogsLengthRef = useRef(0);

  const expanded = alwaysExpanded ?? internalExpanded;

  // Persist expanded state (only for internal toggle mode)
  useEffect(() => {
    if (!alwaysExpanded) {
      localStorage.setItem("devServerLogsExpanded", String(internalExpanded));
    }
  }, [internalExpanded, alwaysExpanded]);

  // Poll for logs when expanded
  useEffect(() => {
    if (!expanded || !repoPath || daemonState.connection !== "connected") return;

    const fetchLogs = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: repoPath,
        });
        if (!cleared) {
          setLogs(response.state.logs);
        }
      } catch {
        // Ignore errors
      }
    };

    fetchLogs();
    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [expanded, repoPath, daemonState.connection, send, cleared]);

  // Auto-scroll to bottom when new logs arrive
  useEffect(() => {
    if (logs.length > prevLogsLengthRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevLogsLengthRef.current = logs.length;
  }, [logs]);

  const handleClear = useCallback(() => {
    setLogs([]);
    setCleared(true);
  }, []);

  const handleToggle = useCallback(() => {
    setInternalExpanded((prev) => !prev);
    if (!internalExpanded) {
      setCleared(false);
    }
  }, [internalExpanded]);

  if (!repoPath) return null;

  // Full-height mode (when used as a tab)
  if (alwaysExpanded) {
    return (
      <div className="h-full flex flex-col bg-background">
        <div className="flex items-center justify-between px-3 py-2 border-b">
          <span className="text-sm font-medium">Dev Server Logs</span>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={handleClear}
            title="Clear logs"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
        <div
          ref={scrollRef}
          className="flex-1 overflow-auto px-3 py-2"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "12px",
            lineHeight: "1.5",
            background: "#1e1e1e",
            color: "#d4d4d4",
          }}
        >
          {logs.length === 0 ? (
            <div className="text-muted-foreground italic py-2">No logs available. Start the dev server to see output.</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // Collapsible mode (legacy, no longer used in main view)
  return (
    <div className="border-t bg-background">
      <button
        type="button"
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm font-medium">
          {internalExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          Dev Server Logs
        </div>
        {internalExpanded && (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleClear}
              title="Clear logs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleToggle}
              title="Close"
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}
      </button>
      {internalExpanded && (
        <div
          ref={scrollRef}
          className="h-[200px] overflow-auto px-3 pb-2"
          style={{
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "12px",
            lineHeight: "1.5",
            background: "#1e1e1e",
            color: "#d4d4d4",
          }}
        >
          {logs.length === 0 ? (
            <div className="text-muted-foreground italic py-2">No logs available</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
