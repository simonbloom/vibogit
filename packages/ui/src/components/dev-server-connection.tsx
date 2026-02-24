"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Loader2, RefreshCw, X, AlertTriangle, ChevronDown, ChevronRight, Globe, Settings, Copy, Terminal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PortMismatchModal, type PortSource } from "@/components/port-mismatch-modal";
import type { DevServerState, DevServerConfig, DevServerDiagnosis } from "@vibogit/shared";
import { getSettings, TERMINAL_OPTIONS } from "@/lib/settings";
import { getModelForProvider } from "@/lib/ai-service";

type Status = "disconnected" | "connecting" | "restarting" | "connected" | "error";

interface AgentsConfig {
  port?: number;
  devCommand?: string;
  devArgs?: string[];
  found: boolean;
  filePath?: string;
  isMonorepo: boolean;
}

interface Props {
  repoPath: string | null;
  onPortChange?: (port: number | null) => void;
  onRequestPortPrompt?: (isMonorepo?: boolean) => void;
  onMonorepoChange?: (isMonorepo: boolean) => void;
}

interface MismatchPromptState {
  agentsPort: number;
  scriptPort: number;
}

type MismatchDecision =
  | { action: "sync"; port: number; source: PortSource }
  | { action: "skip" }
  | { action: "cancel" };

interface ResolvedStartConfig {
  targetPort: number;
  devCommand?: string;
  devArgs?: string[];
  stalePorts: number[];
}

export function DevServerConnection({ repoPath, onPortChange, onRequestPortPrompt, onMonorepoChange }: Props) {
  const { send, state: daemonState } = useDaemon();
  const [status, setStatus] = useState<Status>("disconnected");
  const [port, setPort] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [diagnosis, setDiagnosis] = useState<DevServerDiagnosis | null>(null);
  const [logsExpanded, setLogsExpanded] = useState(false);
  const [aiCommands, setAiCommands] = useState<string[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [mismatchPrompt, setMismatchPrompt] = useState<MismatchPromptState | null>(null);
  const mismatchResolverRef = useRef<((decision: MismatchDecision) => void) | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const portCheckRef = useRef<AbortController | null>(null);
  const statusRef = useRef<Status>(status);
  statusRef.current = status;

  const runDiagnosis = useCallback(async (targetPort: number) => {
    try {
      const response = await send<{ diagnosis: DevServerDiagnosis }>("devServerDiagnose", {
        path: repoPath,
        port: targetPort,
      });
      setDiagnosis(response.diagnosis);
      setLogsExpanded(false);
      setAiCommands(null);
    } catch {
      // Silent fail - keep generic error
    }
  }, [repoPath, send]);

  const sendCommandToTerminal = useCallback(async (command: string, autoExec = true) => {
    const settings = getSettings();
    const terminalConfig = TERMINAL_OPTIONS.find((t) => t.id === settings.terminal);
    const terminalApp = terminalConfig?.appName || "Terminal";
    try {
      await send("sendToTerminal", { text: command, terminal: terminalApp, autoExecute: autoExec && settings.autoExecutePrompt });
      toast.success("Sent to terminal");
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("Accessibility")) {
        toast.error("ViboGit needs Accessibility permission to paste into terminals. Enable it in System Settings > Privacy & Security > Accessibility.");
      } else {
        toast.error("Failed to send to terminal");
      }
    }
  }, [send]);

  const handleAiFix = useCallback(async () => {
    if (!diagnosis || !repoPath) return;
    const settings = getSettings();
    if (!settings.aiApiKey) return;

    setAiLoading(true);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ commands: string[] }>("ai_diagnose_dev_server", {
        provider: settings.aiProvider,
        model: getModelForProvider(settings.aiProvider, settings.aiModel),
        apiKey: settings.aiApiKey,
        path: repoPath,
        command: "bun",
        commandArgs: ["run", "dev"],
        port: port || detectedPort || 3000,
        diagnosisCode: diagnosis.diagnosisCode,
        problem: diagnosis.problem,
        lastLogs: diagnosis.lastLogs,
      });
      setAiCommands(result.commands);
    } catch (error) {
      toast.error("AI diagnosis failed", {
        description: error instanceof Error ? error.message : "Could not get AI suggestions",
        duration: 5000,
      });
    } finally {
      setAiLoading(false);
    }
  }, [diagnosis, repoPath, port, detectedPort]);

  const clearPolling = useCallback(() => {
    if (portCheckRef.current) {
      portCheckRef.current.abort();
      portCheckRef.current = null;
    }
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const checkServerState = useCallback(async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    try {
      const response = await send<{ state: DevServerState }>("devServerState", {
        path: repoPath,
      });

      if (response.state.running && response.state.port) {
        clearPolling();
        setStatus("connected");
        setPort(response.state.port);
        onPortChange?.(response.state.port);
      }
    } catch {
      // Silent fail on check
    }
  }, [repoPath, daemonState.connection, send, clearPolling, onPortChange]);

  useEffect(() => {
    clearPolling();
    setStatus("disconnected");
    setPort(null);
    setDetectedPort(null);
    setErrorMessage(null);
    onPortChange?.(null);

    if (!repoPath || daemonState.connection !== "connected") return;

    const fetchConfig = async () => {
      try {
        const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", {
          repoPath,
        });
        const configuredPort = configResponse.config.port ?? null;
        setDetectedPort(configuredPort);
        onPortChange?.(configuredPort);
        onMonorepoChange?.(configResponse.config.isMonorepo);
      } catch {
        // Config fetch failed, leave as unknown
      }
    };
    void fetchConfig();

    void checkServerState();

    return () => {
      clearPolling();
    };
  }, [repoPath, daemonState.connection, send, clearPolling, onPortChange, onMonorepoChange, checkServerState]);

  useEffect(() => {
    return () => {
      clearPolling();
      if (mismatchResolverRef.current) {
        mismatchResolverRef.current({ action: "cancel" });
        mismatchResolverRef.current = null;
      }
    };
  }, [clearPolling]);

  const startPolling = useCallback((targetPort: number, targetRepoPath: string) => {
    clearPolling();

    timeoutRef.current = setTimeout(() => {
      clearPolling();
      setStatus("error");
      setErrorMessage("Server start timeout (30s)");
    }, 30000);

    pollingRef.current = setInterval(async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", {
          path: targetRepoPath,
        });

        if (response.state.running && response.state.port) {
          clearPolling();
          setStatus("connected");
          setPort(response.state.port);
          onPortChange?.(response.state.port);
        }
      } catch {
        // Daemon error, continue polling
      }
    }, 1000);
  }, [clearPolling, onPortChange, send]);

  const openMismatchPrompt = useCallback((agentsPort: number, scriptPort: number): Promise<MismatchDecision> => {
    return new Promise<MismatchDecision>((resolve) => {
      mismatchResolverRef.current = resolve;
      setMismatchPrompt({ agentsPort, scriptPort });
    });
  }, []);

  const resolveMismatchPrompt = useCallback((decision: MismatchDecision) => {
    const resolver = mismatchResolverRef.current;
    mismatchResolverRef.current = null;
    setMismatchPrompt(null);
    resolver?.(decision);
  }, []);

  const killPorts = useCallback(async (ports: number[]) => {
    const uniquePorts = [...new Set(ports.filter((value): value is number => Number.isInteger(value) && value > 0))];
    for (const killPort of uniquePorts) {
      try {
        await send("killPort", { port: killPort });
      } catch {
        // Best effort cleanup; continue startup.
      }
    }
  }, [send]);

  const resolveStartConfig = useCallback(async (activePort?: number): Promise<ResolvedStartConfig | null> => {
    if (!repoPath) return null;

    const [configResponse, detectResponse] = await Promise.all([
      send<{ config: AgentsConfig }>("readAgentsConfig", { repoPath }),
      send<{ config: DevServerConfig | null }>("devServerDetect", { path: repoPath }),
    ]);

    const agentsConfig = configResponse.config;
    const detectedConfig = detectResponse.config;

    let agentsPort = agentsConfig.port;
    const scriptPort = detectedConfig?.explicitPort;
    const fallbackDetectedPort = detectedConfig?.port;
    const stalePorts = new Set<number>();

    if (typeof agentsPort === "number") stalePorts.add(agentsPort);
    if (typeof scriptPort === "number") stalePorts.add(scriptPort);
    if (typeof activePort === "number") stalePorts.add(activePort);

    let targetPort: number | undefined;

    if (typeof agentsPort === "number" && typeof scriptPort === "number" && agentsPort !== scriptPort) {
      const decision = await openMismatchPrompt(agentsPort, scriptPort);

      if (decision.action === "cancel") {
        return null;
      }

      if (decision.action === "skip") {
        targetPort = scriptPort;
      } else {
        await send("writeAgentsConfig", { repoPath, port: decision.port });
        await send("writeDevScriptPort", { repoPath, port: decision.port });
        agentsPort = decision.port;
        targetPort = decision.port;
        setDetectedPort(decision.port);
        onPortChange?.(decision.port);
        toast.success(`Synced dev port to :${decision.port}`);
      }
    }

    if (!targetPort) {
      targetPort = scriptPort ?? agentsPort ?? fallbackDetectedPort;
    }

    if (!targetPort) {
      onRequestPortPrompt?.(agentsConfig.isMonorepo);
      return null;
    }

    stalePorts.delete(targetPort);

    const preferDetectedCommand = typeof scriptPort === "number";
    const devCommand = preferDetectedCommand
      ? (detectedConfig?.command ?? agentsConfig.devCommand)
      : (agentsConfig.devCommand ?? detectedConfig?.command);
    const devArgs = preferDetectedCommand
      ? (detectedConfig?.args ?? agentsConfig.devArgs)
      : (agentsConfig.devArgs ?? detectedConfig?.args);

    return {
      targetPort,
      devCommand,
      devArgs,
      stalePorts: [...stalePorts],
    };
  }, [repoPath, send, onPortChange, onRequestPortPrompt, openMismatchPrompt]);

  const handleConnect = async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    setStatus("connecting");
    setErrorMessage(null);
    setDiagnosis(null);
    setAiCommands(null);

    try {
      const resolved = await resolveStartConfig();
      if (!resolved) {
        setStatus("disconnected");
        return;
      }

      await killPorts([resolved.targetPort, ...resolved.stalePorts]);
      await send("cleanupDevLocks", { path: repoPath });

      await send("devServerStart", {
        path: repoPath,
        config: {
          command: resolved.devCommand || "bun",
          args: resolved.devArgs || ["run", "dev"],
          port: resolved.targetPort,
        },
      });

      startPolling(resolved.targetPort, repoPath);

      const diagPort = resolved.targetPort;
      timeoutRef.current = setTimeout(() => {
        if (statusRef.current === "connecting") {
          setStatus("error");
          setErrorMessage("Server did not start within 30 seconds");
          clearPolling();
          void runDiagnosis(diagPort);
        }
      }, 30000);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to connect";
      setStatus("error");
      setErrorMessage(errorMsg);
      void runDiagnosis(detectedPort || 3000);
    }
  };

  const handleRestart = async () => {
    if (!repoPath || !port || daemonState.connection !== "connected") return;

    setStatus("restarting");
    setErrorMessage(null);

    try {
      const resolved = await resolveStartConfig(port);
      if (!resolved) {
        setStatus("connected");
        return;
      }

      await send("devServerStop", { path: repoPath });
      await killPorts([port, resolved.targetPort, ...resolved.stalePorts]);
      await send("cleanupDevLocks", { path: repoPath });

      await send("devServerStart", {
        path: repoPath,
        config: {
          command: resolved.devCommand || "bun",
          args: resolved.devArgs || ["run", "dev"],
          port: resolved.targetPort,
        },
      });

      startPolling(resolved.targetPort, repoPath);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : "Failed to restart";
      setStatus("error");
      setErrorMessage(errorMsg);
      toast.error("Dev server restart failed", {
        description: errorMsg,
        duration: 5000,
      });
    }
  };

  const handleDisconnect = async () => {
    if (!repoPath || daemonState.connection !== "connected") return;

    try {
      await send("devServerStop", { path: repoPath });
      if (port) {
        await send("killPort", { port });
      }
    } catch {
      // Silent fail
    }

    clearPolling();
    setStatus("disconnected");
    setPort(null);
    onPortChange?.(detectedPort ?? null);
  };

  const handleOpenBrowser = async () => {
    if (port) {
      await send("openBrowser", { url: `http://localhost:${port}` });
    }
  };

  const renderWithModal = (content: ReactNode) => (
    <>
      {content}
      <PortMismatchModal
        isOpen={mismatchPrompt !== null}
        scriptPort={mismatchPrompt?.scriptPort ?? 3000}
        agentsPort={mismatchPrompt?.agentsPort ?? 3000}
        onConfirm={(selectedPort, source) => resolveMismatchPrompt({ action: "sync", port: selectedPort, source })}
        onSkip={() => resolveMismatchPrompt({ action: "skip" })}
        onCancel={() => resolveMismatchPrompt({ action: "cancel" })}
      />
    </>
  );

  if (daemonState.connection !== "connected" || !repoPath) {
    return null;
  }

  if (status === "disconnected") {
    return renderWithModal(
      <div className="flex items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 px-2 py-1 text-sm bg-muted text-muted-foreground rounded-md font-mono hover:bg-muted/80 transition-colors"
            >
              :{detectedPort ?? "????"}
              <ChevronDown className="w-3 h-3" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={() => onRequestPortPrompt?.()}>
              <Settings className="w-4 h-4 mr-2" />
              Edit port...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="destructive" size="sm" onClick={handleConnect}>
          Connect
        </Button>
      </div>
    );
  }

  if (status === "connecting") {
    return renderWithModal(
      <div className="flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500 text-white rounded-md">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Connecting...
      </div>
    );
  }

  if (status === "restarting") {
    return renderWithModal(
      <div className="flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500 text-white rounded-md">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Restarting...
      </div>
    );
  }

  if (status === "connected") {
    return renderWithModal(
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={handleOpenBrowser}
          className="flex items-center gap-1.5 px-2 py-1 text-sm bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors cursor-pointer"
          title="Open in browser"
        >
          <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
          :{port}
        </button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex items-center justify-center w-6 h-6 text-muted-foreground hover:text-foreground transition-colors"
              title="More options"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuItem onClick={handleOpenBrowser}>
              <Globe className="w-4 h-4 mr-2" />
              Open in browser
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRequestPortPrompt?.()}>
              <Settings className="w-4 h-4 mr-2" />
              Edit port...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={handleRestart}
          title="Restart server"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 hover:text-destructive"
          onClick={handleDisconnect}
          title="Stop server"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  if (status === "error") {
    const hasAiKey = !!getSettings().aiApiKey;

    return renderWithModal(
      <div className="flex flex-col gap-2">
        {/* Error header row */}
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-destructive">
            <AlertTriangle className="w-3.5 h-3.5" />
            {diagnosis?.problem || "Failed"}
          </div>
          <Button variant="ghost" size="sm" className="text-destructive" onClick={handleConnect}>
            Retry
          </Button>
        </div>

        {/* Diagnostic card */}
        {diagnosis && (
          <div className="ml-2 p-3 rounded-md border border-border bg-muted/30 text-sm max-w-[400px]">
            <p className="text-muted-foreground mb-3">{diagnosis.suggestion}</p>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap">
              {diagnosis.suggestedCommand && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={() => sendCommandToTerminal(diagnosis.suggestedCommand!)}
                >
                  <Terminal className="w-3 h-3" />
                  Run <code className="font-mono">{diagnosis.suggestedCommand}</code>
                </Button>
              )}
              {hasAiKey && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs"
                  onClick={handleAiFix}
                  disabled={aiLoading}
                >
                  {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  Fix with AI
                </Button>
              )}
              {diagnosis.lastLogs.length > 0 && (
                <button
                  type="button"
                  onClick={() => setLogsExpanded(!logsExpanded)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {logsExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  {logsExpanded ? "Hide logs" : "Show logs"}
                </button>
              )}
            </div>

            {/* AI suggestion */}
            {aiCommands && aiCommands.length > 0 && (
              <div className="mt-3 p-2 rounded border border-primary/20 bg-primary/5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-xs font-medium">AI Suggestion</span>
                </div>
                <pre className="text-xs font-mono whitespace-pre-wrap mb-2">{aiCommands.join("\n")}</pre>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-6 text-xs"
                    onClick={() => sendCommandToTerminal(aiCommands.join(" && "), false)}
                  >
                    <Terminal className="w-3 h-3" />
                    Run in Terminal
                  </Button>
                  <button
                    type="button"
                    onClick={() => setAiCommands(null)}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Collapsible logs */}
            {logsExpanded && diagnosis.lastLogs.length > 0 && (
              <div className="mt-3">
                <div
                  className="rounded overflow-auto max-h-[160px] px-2 py-1.5"
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
                <div className="flex justify-end mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(diagnosis.lastLogs.join("\n"));
                      toast.success("Logs copied to clipboard");
                    }}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                  >
                    <Copy className="w-3 h-3" />
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return renderWithModal(null);
}
