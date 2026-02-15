"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertTriangle, ChevronDown, Globe, Loader2, RefreshCw, Settings, X } from "lucide-react";
import { toast } from "sonner";
import type { AgentsConfig, DevServerConfig, DevServerDiagnostic, DevServerReasonCode, DevServerState } from "@vibogit/shared";

type Status = "disconnected" | "connecting" | "restarting" | "connected" | "error";

const DIAGNOSTIC_PREFIX = "DEV_SERVER_DIAGNOSTIC::";

interface Props {
  repoPath: string | null;
  onPortChange?: (port: number | null) => void;
  onRequestPortPrompt?: (isMonorepo?: boolean) => void;
  onMonorepoChange?: (isMonorepo: boolean) => void;
}

export function DevServerConnection({ repoPath, onPortChange, onRequestPortPrompt, onMonorepoChange }: Props) {
  const { send, state: daemonState } = useDaemon();
  const [status, setStatus] = useState<Status>("disconnected");
  const [port, setPort] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [diagnostic, setDiagnostic] = useState<DevServerDiagnostic | null>(null);
  const [detectedPort, setDetectedPort] = useState<number | null>(null);
  const [agentsConfig, setAgentsConfig] = useState<AgentsConfig | null>(null);
  const [isMonorepo, setIsMonorepo] = useState(false);
  const [preferredUrl, setPreferredUrl] = useState<string | null>(null);
  const [connectStage, setConnectStage] = useState("Starting dev server...");
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const connectSnapshotRef = useRef<{ command?: string; cwd?: string; port?: number }>({});

  const trackEvent = useCallback((event: string, payload: Record<string, unknown> = {}) => {
    console.info("[dev-server-telemetry]", {
      event,
      repoPath,
      at: new Date().toISOString(),
      ...payload,
    });
  }, [repoPath]);

  const parseDiagnostic = useCallback((value: unknown): DevServerDiagnostic | null => {
    const raw = typeof value === "string" ? value : value instanceof Error ? value.message : JSON.stringify(value);
    if (!raw) {
      return null;
    }

    const payload = raw.includes(DIAGNOSTIC_PREFIX)
      ? raw.slice(raw.indexOf(DIAGNOSTIC_PREFIX) + DIAGNOSTIC_PREFIX.length)
      : raw.trim().startsWith("{")
        ? raw
        : null;

    if (!payload) {
      return null;
    }

    try {
      const parsed = JSON.parse(payload) as DevServerDiagnostic;
      return parsed?.reasonCode ? parsed : null;
    } catch {
      return null;
    }
  }, []);

  const reasonTitle = useCallback((reason: DevServerReasonCode) => {
    switch (reason) {
      case "MONOREPO_WRONG_CWD":
        return "We started in the wrong folder";
      case "PORT_MISMATCH":
        return "Your app started on a different port";
      case "STARTUP_TIMEOUT":
        return "Your app is still starting";
      case "COMMAND_FAILED":
        return "The dev command could not run";
      case "PROTOCOL_MISMATCH":
        return "Server responded with a different protocol";
      case "NOT_PREVIEWABLE":
        return "This project may not support localhost preview";
      default:
        return "Connection failed";
    }
  }, []);

  const reasonSteps = useCallback((reason: DevServerReasonCode): string[] => {
    switch (reason) {
      case "MONOREPO_WRONG_CWD":
        return ["Choose the app folder suggested in project config.", "Retry connect."];
      case "PORT_MISMATCH":
        return ["Use the observed port from logs.", "Enable strict port in your dev server and retry."];
      case "STARTUP_TIMEOUT":
        return ["Retry with more time.", "Check logs for install/build delays."];
      case "COMMAND_FAILED":
        return ["Install dependencies.", "Verify the dev command and package manager."];
      case "PROTOCOL_MISMATCH":
        return ["Try the suggested URL.", "Check HTTP/HTTPS server settings."];
      case "NOT_PREVIEWABLE":
        return ["Confirm this repo has a web app.", "If monorepo, select the frontend folder."];
      default:
        return ["Retry connect."];
    }
  }, []);

  const buildAiPrompt = useCallback((item: DevServerDiagnostic | null) => {
    const reasonCode = item?.reasonCode ?? "COMMAND_FAILED";
    const expectedPort = item?.expectedPort ?? connectSnapshotRef.current.port ?? agentsConfig?.port ?? "unknown";
    const command = item?.command ?? connectSnapshotRef.current.command ?? agentsConfig?.devCommand ?? "<unknown>";
    const cwd = item?.cwd ?? connectSnapshotRef.current.cwd ?? repoPath ?? "<repo-root>";
    const suggested = item?.suggestedCwd ?? agentsConfig?.workingDir ?? agentsConfig?.suggestedWorkingDirs?.[0] ?? "unknown";
    const urls = item?.urlAttempts?.join(", ") || "none";
    const logs = item?.logsTail?.join("\n") || "<no logs available>";

    return [
      "I’m trying to run a local web preview and it fails.",
      "",
      `Reason code: ${reasonCode}`,
      `Repo: ${repoPath ?? "unknown"}`,
      `Command run: ${command}`,
      `Working directory used: ${cwd}`,
      `Suggested working directory: ${suggested}`,
      `Expected port: ${expectedPort}`,
      `Observed port: ${item?.observedPort ?? "unknown"}`,
      `URL attempts: ${urls}`,
      "Recent logs:",
      logs,
      "",
      "Please give:",
      "1) the exact corrected command,",
      "2) the correct working directory,",
      "3) any AGENTS.md settings I should add,",
      "4) how to verify success in 3 quick checks.",
    ].join("\n");
  }, [agentsConfig, repoPath]);

  const clearPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    clearPolling();
    setStatus("disconnected");
    setPort(null);
    setPreferredUrl(null);
    setDiagnostic(null);
    setDetectedPort(null);
    setAgentsConfig(null);
    setIsMonorepo(false);
    setErrorMessage(null);
    onPortChange?.(null);

    if (!repoPath || daemonState.connection !== "connected") {
      return;
    }

    const fetchConfig = async () => {
      try {
        const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", { repoPath });
        setAgentsConfig(configResponse.config);
        setDetectedPort(configResponse.config.port ?? null);
        setIsMonorepo(configResponse.config.isMonorepo);
        onMonorepoChange?.(configResponse.config.isMonorepo);

        if (!configResponse.config.previewSuitable && configResponse.config.suitabilityReason) {
          setDiagnostic({
            reasonCode: "NOT_PREVIEWABLE",
            message: configResponse.config.suitabilityReason,
            expectedPort: configResponse.config.port,
            observedPort: undefined,
            command: configResponse.config.devCommand,
            cwd: repoPath,
            suggestedCwd: configResponse.config.workingDir ?? configResponse.config.suggestedWorkingDirs?.[0],
            urlAttempts: [],
            preferredUrl: undefined,
            logsTail: [],
          });
        }
      } catch {
        // ignore
      }
    };

    const checkExisting = async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", { path: repoPath });
        if (response.state.running && response.state.port) {
          setStatus("connected");
          setPort(response.state.port);
          setPreferredUrl(response.state.diagnostic?.preferredUrl ?? `http://localhost:${response.state.port}`);
          onPortChange?.(response.state.port);
        }
      } catch {
        // ignore
      }
    };

    void fetchConfig();
    void checkExisting();

    return () => clearPolling();
  }, [clearPolling, daemonState.connection, onMonorepoChange, onPortChange, repoPath, send]);

  useEffect(() => () => clearPolling(), [clearPolling]);

  const startPolling = useCallback((targetPort: number, targetRepoPath: string) => {
    clearPolling();

    timeoutRef.current = setTimeout(() => {
      clearPolling();
      const timeoutDiagnostic: DevServerDiagnostic = {
        reasonCode: "STARTUP_TIMEOUT",
        message: "Server did not start within 30 seconds.",
        expectedPort: targetPort,
        observedPort: undefined,
        command: connectSnapshotRef.current.command,
        cwd: connectSnapshotRef.current.cwd,
        suggestedCwd: agentsConfig?.workingDir ?? agentsConfig?.suggestedWorkingDirs?.[0],
        urlAttempts: [`http://localhost:${targetPort}`, `https://localhost:${targetPort}`],
        preferredUrl: undefined,
        logsTail: [],
      };
      setDiagnostic(timeoutDiagnostic);
      setStatus("error");
      setErrorMessage(timeoutDiagnostic.message);
      trackEvent("connect_failure_reason", { reasonCode: timeoutDiagnostic.reasonCode });
    }, 30000);

    pollingRef.current = setInterval(async () => {
      try {
        const response = await send<{ state: DevServerState }>("devServerState", { path: targetRepoPath });
        if (response.state.running && response.state.port) {
          clearPolling();
          setStatus("connected");
          setPort(response.state.port);
          setDiagnostic(null);
          setErrorMessage(null);
          setPreferredUrl(response.state.diagnostic?.preferredUrl ?? `http://localhost:${response.state.port}`);
          onPortChange?.(response.state.port);
          trackEvent("retry_success", { port: response.state.port });
          return;
        }

        if (response.state.diagnostic) {
          clearPolling();
          setDiagnostic(response.state.diagnostic);
          setStatus("error");
          setErrorMessage(response.state.diagnostic.message);
          trackEvent("connect_failure_reason", { reasonCode: response.state.diagnostic.reasonCode });
        }
      } catch {
        // ignore while polling
      }
    }, 1000);
  }, [agentsConfig?.suggestedWorkingDirs, agentsConfig?.workingDir, clearPolling, onPortChange, send, trackEvent]);

  const handleConnect = useCallback(async () => {
    if (!repoPath || daemonState.connection !== "connected") {
      return;
    }

    setStatus("connecting");
    setConnectStage("Reading project settings...");
    setDiagnostic(null);
    setErrorMessage(null);
    trackEvent("connect_attempt");

    try {
      const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", { repoPath });
      const config = configResponse.config;
      setAgentsConfig(config);

      let targetPort = config.port;
      let devCommand = config.devCommand;
      let devArgs = config.devArgs;
      let workingDir = config.workingDir;

      if (!targetPort || !devCommand || !devArgs?.length) {
        const detectPath = workingDir ? (workingDir.startsWith("/") ? workingDir : `${repoPath}/${workingDir}`) : repoPath;
        setConnectStage("Detecting dev script...");
        const detectResponse = await send<{ config: DevServerConfig | null }>("devServerDetect", { path: detectPath });

        if (detectResponse.config) {
          targetPort = targetPort ?? detectResponse.config.port;
          devCommand = devCommand ?? detectResponse.config.command;
          devArgs = devArgs ?? detectResponse.config.args;
          workingDir = detectResponse.config.workingDir ?? workingDir;
        }

        if (!targetPort) {
          setStatus("disconnected");
          onRequestPortPrompt?.(config.isMonorepo);
          return;
        }
      }

      connectSnapshotRef.current = {
        command: devCommand ? `${devCommand} ${(devArgs || []).join(" ")}`.trim() : "<unknown>",
        cwd: workingDir ? (workingDir.startsWith("/") ? workingDir : `${repoPath}/${workingDir}`) : repoPath,
        port: targetPort,
      };

      setConnectStage("Starting dev server...");
      await send("killPort", { port: targetPort });
      await send("cleanupDevLocks", { path: repoPath });

      await send("devServerStart", {
        path: repoPath,
        config: {
          command: devCommand ?? "",
          args: devArgs ?? [],
          port: targetPort,
          workingDir,
        },
      });

      setConnectStage("Checking localhost reachability...");
      startPolling(targetPort, repoPath);
    } catch (error) {
      const backendDiagnostic = parseDiagnostic(error);
      const fallback = error instanceof Error ? error.message : "Failed to connect";
      const nextDiagnostic: DevServerDiagnostic = backendDiagnostic ?? {
        reasonCode: "COMMAND_FAILED",
        message: fallback,
        expectedPort: connectSnapshotRef.current.port,
        observedPort: undefined,
        command: connectSnapshotRef.current.command,
        cwd: connectSnapshotRef.current.cwd,
        suggestedCwd: agentsConfig?.workingDir ?? agentsConfig?.suggestedWorkingDirs?.[0],
        urlAttempts: connectSnapshotRef.current.port ? [`http://localhost:${connectSnapshotRef.current.port}`] : [],
        preferredUrl: undefined,
        logsTail: [],
      };

      setDiagnostic(nextDiagnostic);
      setStatus("error");
      setErrorMessage(nextDiagnostic.message);
      trackEvent("connect_failure_reason", { reasonCode: nextDiagnostic.reasonCode });
      toast.error("Dev server failed", { description: nextDiagnostic.message, duration: 5000 });
    }
  }, [agentsConfig, daemonState.connection, onRequestPortPrompt, parseDiagnostic, repoPath, send, startPolling, trackEvent]);

  const handleRestart = useCallback(async () => {
    if (!repoPath || !port || daemonState.connection !== "connected") {
      return;
    }

    setStatus("restarting");
    setDiagnostic(null);
    setErrorMessage(null);

    try {
      await send("devServerStop", { path: repoPath });
      await send("killPort", { port });
      await send("cleanupDevLocks", { path: repoPath });

      const configResponse = await send<{ config: AgentsConfig }>("readAgentsConfig", { repoPath });
      const config = configResponse.config;
      setAgentsConfig(config);

      await send("devServerStart", {
        path: repoPath,
        config: {
          command: config.devCommand ?? "",
          args: config.devArgs ?? [],
          port,
          workingDir: config.workingDir,
        },
      });

      startPolling(port, repoPath);
    } catch (error) {
      const backendDiagnostic = parseDiagnostic(error);
      const message = backendDiagnostic?.message || (error instanceof Error ? error.message : "Failed to restart");
      setDiagnostic(backendDiagnostic);
      setStatus("error");
      setErrorMessage(message);
      toast.error("Dev server restart failed", { description: message, duration: 5000 });
    }
  }, [daemonState.connection, parseDiagnostic, port, repoPath, send, startPolling]);

  const handleDisconnect = useCallback(async () => {
    if (!repoPath || daemonState.connection !== "connected") {
      return;
    }

    try {
      await send("devServerStop", { path: repoPath });
      if (port) {
        await send("killPort", { port });
      }
    } catch {
      // ignore
    }

    clearPolling();
    setStatus("disconnected");
    setPort(null);
    onPortChange?.(null);
  }, [clearPolling, daemonState.connection, onPortChange, port, repoPath, send]);

  const handleOpenBrowser = useCallback(async () => {
    if (!port) {
      return;
    }
    const url = preferredUrl || diagnostic?.preferredUrl || `http://localhost:${port}`;
    await send("openBrowser", { url });
  }, [diagnostic?.preferredUrl, port, preferredUrl, send]);

  const handleCopyPrompt = useCallback(async () => {
    const prompt = buildAiPrompt(diagnostic);
    await navigator.clipboard.writeText(prompt);
    trackEvent("action_clicked", { action: "copy_ai_prompt", reasonCode: diagnostic?.reasonCode });
    toast.success("Troubleshooting prompt copied");
  }, [buildAiPrompt, diagnostic, trackEvent]);

  if (daemonState.connection !== "connected" || !repoPath) {
    return null;
  }

  if (status === "disconnected") {
    return (
      <div className="flex flex-col items-end gap-1">
        {!agentsConfig?.previewSuitable && agentsConfig?.suitabilityReason && (
          <div className="text-[11px] px-2 py-1 rounded bg-yellow-500/15 text-yellow-700 max-w-[340px] truncate" title={agentsConfig.suitabilityReason}>
            Not previewable? {agentsConfig.suitabilityReason}
          </div>
        )}
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
              <DropdownMenuItem onClick={() => onRequestPortPrompt?.(isMonorepo)}>
                <Settings className="w-4 h-4 mr-2" />
                Edit port...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="destructive" size="sm" onClick={handleConnect}>
            Connect
          </Button>
        </div>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500 text-white rounded-md">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        {connectStage}
      </div>
    );
  }

  if (status === "restarting") {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1 text-sm bg-yellow-500 text-white rounded-md">
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
        Restarting...
      </div>
    );
  }

  if (status === "connected") {
    return (
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
            <DropdownMenuItem onClick={() => onRequestPortPrompt?.(isMonorepo)}>
              <Settings className="w-4 h-4 mr-2" />
              Edit port...
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRestart} title="Restart server">
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:text-destructive" onClick={handleDisconnect} title="Stop server">
          <X className="w-3.5 h-3.5" />
        </Button>
      </div>
    );
  }

  if (status === "error") {
    const title = diagnostic ? reasonTitle(diagnostic.reasonCode) : "Failed";
    const steps = diagnostic ? reasonSteps(diagnostic.reasonCode) : [];

    return (
      <div className="flex items-start gap-2" title={errorMessage || undefined}>
        <div className="flex items-center gap-1.5 px-2 py-1 text-sm text-destructive shrink-0">
          <AlertTriangle className="w-3.5 h-3.5" />
          {title}
        </div>
        <div className="flex flex-col gap-1 max-w-[360px]">
          {errorMessage && <span className="text-xs text-destructive/80">{errorMessage}</span>}
          {steps.length > 0 && (
            <ol className="text-[11px] text-muted-foreground list-decimal pl-4 space-y-0.5">
              {steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          )}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={handleConnect}>
              Retry
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onRequestPortPrompt?.(isMonorepo)}>
              Edit settings
            </Button>
            <Button variant="ghost" size="sm" onClick={handleCopyPrompt}>
              Copy AI prompt
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
