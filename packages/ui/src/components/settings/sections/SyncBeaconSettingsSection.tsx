"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Copy, Check, Loader2, Radio } from "lucide-react";
import type { Config } from "@vibogit/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDaemon } from "@/lib/daemon-context";
import { toast } from "sonner";

interface SyncBeaconCheckResult {
  available: boolean;
  authenticated: boolean;
  message: string;
}

interface SyncBeaconSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function SyncBeaconSettingsSection({ config, onSave }: SyncBeaconSettingsSectionProps) {
  const { send, getHostname } = useDaemon();
  const [machineNameInput, setMachineNameInput] = useState(config.syncBeaconMachineName);
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isToggling, setIsToggling] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    setMachineNameInput(config.syncBeaconMachineName);
  }, [config.syncBeaconMachineName]);

  const hasPairingCode = Boolean(config.syncBeaconPairingCode.trim());

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

  const handleToggle = async () => {
    setInlineError(null);
    if (config.syncBeaconEnabled) {
      onSave({ syncBeaconEnabled: false });
      return;
    }

    setIsToggling(true);
    try {
      const result = await send<SyncBeaconCheckResult>("sync_beacon_check_gh");
      if (!result.available || !result.authenticated) {
        setInlineError(result.message);
        toast.error(result.message);
        return;
      }

      onSave({ syncBeaconEnabled: true });
      toast.success(hasPairingCode ? "Sync Beacon enabled" : "Sync Beacon enabled — generating pairing code");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to enable Sync Beacon";
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopyCode = async () => {
    if (!config.syncBeaconPairingCode) return;
    try {
      await navigator.clipboard.writeText(config.syncBeaconPairingCode);
      setIsCopied(true);
      toast.success("Pairing code copied");
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy pairing code");
    }
  };

  const handleJoinBeacon = async () => {
    const trimmed = joinCodeInput.trim().toLowerCase();
    if (!trimmed) return;

    setIsJoining(true);
    setInlineError(null);
    try {
      await send<unknown>("sync_beacon_pull", { pairingCode: trimmed });
      onSave({ syncBeaconPairingCode: trimmed });
      setJoinCodeInput("");
      toast.success("Joined beacon successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to join beacon";
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsJoining(false);
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

      {/* Enable/disable toggle */}
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Enable Sync Beacon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Checks `gh` authentication before enabling and starts automatic background syncs.
            </p>
          </div>
          <Button
            type="button"
            variant={config.syncBeaconEnabled ? "default" : "outline"}
            onClick={() => void handleToggle()}
            disabled={isToggling}
          >
            {isToggling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {config.syncBeaconEnabled ? "Disable" : "Enable"}
          </Button>
        </div>
      </div>

      {/* Pairing code display */}
      {config.syncBeaconEnabled && hasPairingCode ? (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Pairing Code</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this code with your other machines to join the same beacon.
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 rounded-md border border-border bg-background px-4 py-2.5 font-mono text-lg tracking-widest text-foreground select-all">
              {config.syncBeaconPairingCode}
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleCopyCode()}
            >
              {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {isCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      ) : null}

      {/* Join existing beacon */}
      {config.syncBeaconEnabled ? (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div>
            <p className="text-sm font-medium text-foreground">Join Existing Beacon</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter a 6-character pairing code from another machine to join its beacon.
            </p>
          </div>
          <div className="mt-3 flex gap-2">
            <Input
              value={joinCodeInput}
              onChange={(event) => setJoinCodeInput(event.target.value)}
              placeholder="Enter pairing code"
              maxLength={6}
              className="font-mono tracking-widest"
              aria-label="Join beacon pairing code"
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => void handleJoinBeacon()}
              disabled={isJoining || joinCodeInput.trim().length < 1}
            >
              {isJoining ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Join
            </Button>
          </div>
        </div>
      ) : null}

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
