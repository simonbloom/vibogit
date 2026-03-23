"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Copy, Loader2, Radio } from "lucide-react";
import type { Config } from "@vibogit/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useDaemon } from "@/lib/daemon-context";
import { toast } from "sonner";

const INTERVAL_OPTIONS = [
  { label: "1 minute", value: 60_000 },
  { label: "2 minutes", value: 120_000 },
  { label: "5 minutes", value: 300_000 },
  { label: "10 minutes", value: 600_000 },
  { label: "15 minutes", value: 900_000 },
] as const;

interface SyncBeaconCheckResult {
  available: boolean;
  authenticated: boolean;
  message: string;
}

interface SyncBeaconValidationResult {
  valid: boolean;
  message: string;
}

interface SyncBeaconSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function SyncBeaconSettingsSection({ config, onSave }: SyncBeaconSettingsSectionProps) {
  const { send, getHostname } = useDaemon();
  const [machineNameInput, setMachineNameInput] = useState(config.syncBeaconMachineName);
  const [gistIdInput, setGistIdInput] = useState(config.syncBeaconGistId);
  const [isToggling, setIsToggling] = useState(false);
  const [isValidatingGist, setIsValidatingGist] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  useEffect(() => {
    setMachineNameInput(config.syncBeaconMachineName);
  }, [config.syncBeaconMachineName]);

  useEffect(() => {
    setGistIdInput(config.syncBeaconGistId);
  }, [config.syncBeaconGistId]);

  const hasCreatedGist = Boolean(config.syncBeaconGistId.trim());
  const selectedInterval = useMemo(
    () => INTERVAL_OPTIONS.find((option) => option.value === config.syncBeaconInterval)?.value ?? 300_000,
    [config.syncBeaconInterval]
  );

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

  const handleValidateAndSaveGist = async () => {
    const trimmed = gistIdInput.trim();
    if (!trimmed) {
      setGistIdInput("");
      setInlineError(null);
      onSave({ syncBeaconGistId: "" });
      return;
    }

    setIsValidatingGist(true);
    setInlineError(null);
    try {
      const result = await send<SyncBeaconValidationResult>("sync_beacon_validate_gist", { gistId: trimmed });
      if (!result.valid) {
        setInlineError(result.message);
        setGistIdInput(config.syncBeaconGistId);
        toast.error(result.message);
        return;
      }

      onSave({ syncBeaconGistId: trimmed });
      toast.success("Sync Beacon Gist connected");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to validate Sync Beacon Gist";
      setInlineError(message);
      setGistIdInput(config.syncBeaconGistId);
      toast.error(message);
    } finally {
      setIsValidatingGist(false);
    }
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
      toast.success(hasCreatedGist ? "Sync Beacon enabled" : "Sync Beacon enabled — creating your private Gist" );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to enable Sync Beacon";
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsToggling(false);
    }
  };

  const handleCopyGist = async () => {
    if (!config.syncBeaconGistId) return;
    try {
      setIsCopying(true);
      await navigator.clipboard.writeText(config.syncBeaconGistId);
      toast.success("Copied Gist ID");
    } catch {
      toast.error("Couldn't copy Gist ID");
    } finally {
      setIsCopying(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-medium text-foreground">Sync Beacon</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Share repo status between machines through a private GitHub Gist.
          </p>
        </div>
        <Badge variant={config.syncBeaconEnabled ? "success" : "secondary"} className="gap-1">
          <Radio className="h-3 w-3" />
          {config.syncBeaconEnabled ? "Active" : "Disabled"}
        </Badge>
      </div>

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

      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">Update interval</label>
        <select
          value={selectedInterval}
          onChange={(event) => onSave({ syncBeaconInterval: Number(event.target.value) })}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {INTERVAL_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3 rounded-lg border border-border bg-muted/20 p-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-foreground">Shared Gist ID</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Enter an existing Gist ID to join another machine, or enable Sync Beacon to create one automatically.
            </p>
          </div>
          {hasCreatedGist ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Ready to share
            </Badge>
          ) : null}
        </div>

        <div className="flex gap-2">
          <Input
            value={gistIdInput}
            onChange={(event) => setGistIdInput(event.target.value)}
            onBlur={() => void handleValidateAndSaveGist()}
            placeholder="Paste a Gist ID to join an existing beacon"
            aria-label="Sync Beacon Gist ID"
            aria-invalid={inlineError ? true : undefined}
          />
          <Button type="button" variant="outline" onClick={() => void handleValidateAndSaveGist()} disabled={isValidatingGist}>
            {isValidatingGist ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Validate
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => void handleCopyGist()}
            disabled={isCopying || !gistIdInput.trim()}
          >
            {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
            Copy
          </Button>
        </div>

        {inlineError ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{inlineError}</span>
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span>
          {hasCreatedGist
            ? "Share this Gist ID on your other machines to join the same beacon."
            : "Enable Sync Beacon to create your first private Gist automatically."}
        </span>
      </div>
    </section>
  );
}
