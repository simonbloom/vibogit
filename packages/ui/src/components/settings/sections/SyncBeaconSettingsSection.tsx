"use client";

import { useEffect, useState } from "react";
import { AlertCircle, Copy, Check, Loader2, Radio, Pencil, RefreshCw } from "lucide-react";
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
  config?: Config;
}

interface SyncBeaconSettingsSectionProps {
  config: Config;
  onSave: (updates: Partial<Config>) => void;
}

export function SyncBeaconSettingsSection({ config, onSave }: SyncBeaconSettingsSectionProps) {
  const { send, getConfigPath, getHostname } = useDaemon();
  const [machineNameInput, setMachineNameInput] = useState(config.syncBeaconMachineName);
  const [isToggling, setIsToggling] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [localPairingCode, setLocalPairingCode] = useState<string>("");

  // Unified code field state
  const [isEditing, setIsEditing] = useState(false);
  const [editCodeInput, setEditCodeInput] = useState("");
  const [isSavingCode, setIsSavingCode] = useState(false);

  useEffect(() => {
    setMachineNameInput(config.syncBeaconMachineName);
  }, [config.syncBeaconMachineName]);

  useEffect(() => {
    if (config.syncBeaconPairingCode.trim()) {
      setLocalPairingCode(config.syncBeaconPairingCode.trim());
    }
  }, [config.syncBeaconPairingCode]);

  const displayCode = localPairingCode || config.syncBeaconPairingCode.trim();
  const hasPairingCode = Boolean(displayCode);

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
      setLocalPairingCode("");
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

      if (!result.hasGistScope) {
        const scopeMessage = "GitHub token missing gist scope. Run in terminal: gh auth refresh -s gist";
        setInlineError(scopeMessage);
        toast.error(scopeMessage);
        return;
      }

      // If no pairing code exists, generate one and save everything atomically
      if (!hasPairingCode) {
        setIsGenerating(true);
        try {
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
            if (machineNameInput.trim() !== machineName) {
              setMachineNameInput(machineName);
            }
            toast.success("Sync Beacon enabled — pairing code generated");
          } else {
            toast.success("Sync Beacon enabled");
          }
        } catch (err) {
          const message = getErrorMessage(err, "Failed to generate pairing code");
          setInlineError(message);
          toast.error(message);
        } finally {
          setIsGenerating(false);
        }
      } else {
        onSave({ syncBeaconEnabled: true });
        toast.success("Sync Beacon enabled");
      }
    } catch (error) {
      const message = getErrorMessage(error, "Unable to enable Sync Beacon");
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsToggling(false);
    }
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

  const handleStartEdit = () => {
    setEditCodeInput(displayCode);
    setIsEditing(true);
    setInlineError(null);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditCodeInput("");
    setInlineError(null);
  };

  const handleSaveCode = async () => {
    const trimmed = editCodeInput.trim().toLowerCase();
    if (!trimmed) return;

    setIsSavingCode(true);
    setInlineError(null);
    try {
      // Verify the code exists by pulling
      await send<unknown>("sync_beacon_pull", { pairingCode: trimmed });
      setLocalPairingCode(trimmed);
      onSave({ syncBeaconPairingCode: trimmed });
      setIsEditing(false);
      setEditCodeInput("");
      toast.success("Pairing code updated");
    } catch (err) {
      const message = getErrorMessage(err, "No beacon found for this code");
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsSavingCode(false);
    }
  };

  const handleGenerateNew = async () => {
    setIsGenerating(true);
    setInlineError(null);
    try {
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
        onSave({ syncBeaconPairingCode: pushResult.pairingCode });
        setIsEditing(false);
        setEditCodeInput("");
        toast.success("New pairing code generated");
      }
    } catch (err) {
      const message = getErrorMessage(err, "Failed to generate new code");
      setInlineError(message);
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

  // Determine if we should show edit mode: explicitly editing, or enabled with no code (and not generating)
  const showEditMode = config.syncBeaconEnabled && (isEditing || (!hasPairingCode && !isGenerating));

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

      {/* Pairing code field — unified display/edit */}
      {config.syncBeaconEnabled ? (
        <div className="rounded-lg border border-border bg-muted/20 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Pairing Code</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Share this code with your other machines to join the same beacon.
              </p>
            </div>
          </div>

          {/* Loading state during first-enable code generation */}
          {isGenerating ? (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Generating pairing code…</span>
            </div>
          ) : showEditMode ? (
            /* Edit mode */
            <div className="mt-3 space-y-2">
              <div className="flex gap-2">
                <Input
                  value={editCodeInput}
                  onChange={(event) => setEditCodeInput(event.target.value)}
                  placeholder="Enter a 6-character code"
                  maxLength={6}
                  className="font-mono tracking-widest"
                  aria-label="Pairing code input"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleSaveCode()}
                  disabled={isSavingCode || editCodeInput.trim().length < 1}
                >
                  {isSavingCode ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Save
                </Button>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleGenerateNew()}
                  disabled={isGenerating}
                  className="text-xs"
                >
                  <RefreshCw className="mr-1 h-3 w-3" />
                  Generate New
                </Button>
                {isEditing ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleCancelEdit}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                ) : null}
              </div>
            </div>
          ) : hasPairingCode ? (
            /* Display mode */
            <div className="mt-3 flex items-center gap-2">
              <div className="flex-1 rounded-md border border-border bg-background px-4 py-2.5 font-mono text-lg tracking-widest text-foreground select-all">
                {displayCode}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void handleCopyCode()}
              >
                {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {isCopied ? "Copied" : "Copy"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleStartEdit}
                className="text-xs"
              >
                <Pencil className="mr-1 h-3 w-3" />
                Change
              </Button>
            </div>
          ) : null}
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
