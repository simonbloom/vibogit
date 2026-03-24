"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Copy, Check, Loader2, Radio, Link2 } from "lucide-react";
import type { Config } from "@vibogit/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDaemon } from "@/lib/daemon-context";
import { toast } from "sonner";

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string" && err.trim()) return err;
  return fallback;
}

interface SyncBeaconCheckResult {
  available: boolean;
  authenticated: boolean;
  hasGistScope: boolean;
  message: string;
}

interface SyncBeaconPushResult {
  data: unknown;
  pairingCode: string;
}

interface SyncBeaconSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function SyncBeaconSettingsSection({ config, onSave }: SyncBeaconSettingsSectionProps) {
  const { send, getConfigPath, getHostname } = useDaemon();
  const [machineNameInput, setMachineNameInput] = useState(config.syncBeaconMachineName);
  const [isCopied, setIsCopied] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [localPairingCode, setLocalPairingCode] = useState<string>("");
  const [joinMode, setJoinMode] = useState(false);
  const [joinCodeInput, setJoinCodeInput] = useState("");

  useEffect(() => {
    setMachineNameInput(config.syncBeaconMachineName);
  }, [config.syncBeaconMachineName]);

  useEffect(() => {
    if (config.syncBeaconPairingCode.trim()) {
      setLocalPairingCode(config.syncBeaconPairingCode.trim());
    }
  }, [config.syncBeaconPairingCode]);

  const displayCode = localPairingCode || config.syncBeaconPairingCode.trim();

  const handleMachineNameBlur = async () => {
    const trimmed = machineNameInput.trim();
    if (trimmed) {
      onSave({ syncBeaconMachineName: trimmed });
      return;
    }
    const fallback = await getHostname();
    setMachineNameInput(fallback);
    onSave({ syncBeaconMachineName: fallback });
  };

  const checkGhAuth = async (): Promise<boolean> => {
    const result = await send<SyncBeaconCheckResult>("sync_beacon_check_gh");
    if (!result.available || !result.authenticated) {
      setInlineError(result.message);
      toast.error(result.message);
      return false;
    }
    if (!result.hasGistScope) {
      const msg = "GitHub token missing gist scope. Run in terminal: gh auth refresh -s gist";
      setInlineError(msg);
      toast.error(msg);
      return false;
    }
    return true;
  };

  const handleCreateBeacon = async () => {
    setInlineError(null);
    setIsWorking(true);
    try {
      if (!(await checkGhAuth())) return;
      const configPath = await getConfigPath();
      const machineName = machineNameInput.trim() || (await getHostname());
      const pushResult = await send<SyncBeaconPushResult>("sync_beacon_push", {
        configPath,
        repos: [],
        machineName,
        pairingCode: undefined,
      });
      if (pushResult.pairingCode) {
        setLocalPairingCode(pushResult.pairingCode);
        onSave({ syncBeaconPairingCode: pushResult.pairingCode, syncBeaconEnabled: true });
        if (!machineNameInput.trim()) setMachineNameInput(machineName);
        toast.success("Beacon created");
      }
    } catch (err) {
      setInlineError(getErrorMessage(err, "Failed to create beacon"));
      toast.error(getErrorMessage(err, "Failed to create beacon"));
    } finally {
      setIsWorking(false);
    }
  };

  const handleJoinBeacon = async () => {
    const trimmed = joinCodeInput.trim().toLowerCase();
    if (!trimmed) return;
    setInlineError(null);
    setIsWorking(true);
    try {
      if (!(await checkGhAuth())) return;
      await send<unknown>("sync_beacon_pull", { pairingCode: trimmed });
      setLocalPairingCode(trimmed);
      onSave({ syncBeaconPairingCode: trimmed, syncBeaconEnabled: true });
      setJoinMode(false);
      setJoinCodeInput("");
      toast.success("Joined beacon");
    } catch (err) {
      setInlineError(getErrorMessage(err, "No beacon found for this code"));
      toast.error(getErrorMessage(err, "No beacon found for this code"));
    } finally {
      setIsWorking(false);
    }
  };

  const handleDisable = () => {
    setLocalPairingCode("");
    setJoinMode(false);
    onSave({ syncBeaconEnabled: false });
    toast.success("Sync Beacon disabled");
  };

  const handleCopyCode = async () => {
    if (!displayCode) return;
    try {
      await navigator.clipboard.writeText(displayCode);
      setIsCopied(true);
      toast.success("Pairing code copied");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy pairing code");
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Sync Beacon</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Share repo status between machines using a short pairing code.
          </p>
        </div>
        <Badge variant={config.syncBeaconEnabled ? "success" : "secondary"} className="gap-1">
          <Radio className="h-3 w-3" />
          {config.syncBeaconEnabled ? "Active" : "Disabled"}
        </Badge>
      </div>

      {config.syncBeaconEnabled ? (
        <>
          {/* Connected state */}
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-sm font-medium text-foreground">Pairing Code</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Share this code with your other machines to join the same beacon.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-md border border-border bg-background px-4 py-2.5 font-mono text-lg tracking-widest text-foreground select-all">
                {displayCode}
              </div>
              <Button type="button" variant="outline" onClick={() => void handleCopyCode()}>
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>

          <Button type="button" variant="outline" size="sm" onClick={handleDisable}>
            Disable
          </Button>
        </>
      ) : (
        <>
          {/* Disconnected — Create or Join */}
          {joinMode ? (
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">Join an existing beacon</p>
              <p className="text-xs text-muted-foreground">
                Enter the pairing code from your other machine.
              </p>
              <div className="flex gap-2">
                <Input
                  value={joinCodeInput}
                  onChange={(e) => setJoinCodeInput(e.target.value)}
                  placeholder="Enter pairing code"
                  maxLength={6}
                  className="font-mono tracking-widest"
                  autoFocus
                />
                <Button
                  type="button"
                  onClick={() => void handleJoinBeacon()}
                  disabled={isWorking || joinCodeInput.trim().length < 1}
                >
                  {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Join
                </Button>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => { setJoinMode(false); setInlineError(null); }}>
                Back
              </Button>
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-muted/30 p-4">
              <p className="text-sm font-medium text-foreground">Get started</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Create a new beacon to generate a pairing code, or join an existing one from another machine.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => void handleCreateBeacon()}
                  disabled={isWorking}
                >
                  {isWorking ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Create Beacon
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => { setJoinMode(true); setInlineError(null); }}
                  disabled={isWorking}
                >
                  Join Beacon
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Machine name */}
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Machine name</label>
        <Input
          value={machineNameInput}
          onChange={(event) => setMachineNameInput(event.target.value)}
          onBlur={() => void handleMachineNameBlur()}
          placeholder="Defaults to this machine's hostname"
        />
        <p className="mt-1 text-xs text-muted-foreground">Shown to your other machines in the beacon panel.</p>
      </div>

      {/* Error display */}
      {inlineError ? (
        <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{inlineError}</span>
        </div>
      ) : null}
    </section>
  );
}
