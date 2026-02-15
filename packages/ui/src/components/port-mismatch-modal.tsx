"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PortSource = "script" | "agents" | "custom";

interface Props {
  isOpen: boolean;
  scriptPort: number;
  agentsPort: number;
  onConfirm: (port: number, source: PortSource) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export function PortMismatchModal({
  isOpen,
  scriptPort,
  agentsPort,
  onConfirm,
  onSkip,
  onCancel,
}: Props) {
  const [source, setSource] = useState<PortSource>("script");
  const [customPort, setCustomPort] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setSource("script");
    setCustomPort("");
    setError(null);
  }, [isOpen, scriptPort, agentsPort]);

  const selectedPort = useMemo(() => {
    if (source === "script") return scriptPort;
    if (source === "agents") return agentsPort;
    return Number.parseInt(customPort, 10);
  }, [source, scriptPort, agentsPort, customPort]);

  const handleConfirm = () => {
    if (source === "custom") {
      if (Number.isNaN(selectedPort)) {
        setError("Please enter a valid port number");
        return;
      }
      if (selectedPort < 1 || selectedPort > 65535) {
        setError("Port must be between 1 and 65535");
        return;
      }
      if (selectedPort < 1024 && selectedPort !== 80 && selectedPort !== 443) {
        setError("Ports below 1024 require admin privileges");
        return;
      }
    }

    onConfirm(selectedPort, source);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Port mismatch detected</DialogTitle>
          <DialogDescription>
            Choose which port to use and sync to both <code>AGENTS.md</code> and <code>scripts.dev</code>.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="flex items-start gap-2 rounded border p-3 cursor-pointer">
            <input
              type="radio"
              checked={source === "script"}
              onChange={() => {
                setSource("script");
                setError(null);
              }}
              className="mt-1"
            />
            <div className="text-sm">
              <div className="font-medium">Use script value</div>
              <div className="text-muted-foreground font-mono">scripts.dev: {scriptPort}</div>
            </div>
          </label>

          <label className="flex items-start gap-2 rounded border p-3 cursor-pointer">
            <input
              type="radio"
              checked={source === "agents"}
              onChange={() => {
                setSource("agents");
                setError(null);
              }}
              className="mt-1"
            />
            <div className="text-sm">
              <div className="font-medium">Use AGENTS value</div>
              <div className="text-muted-foreground font-mono">AGENTS.md: {agentsPort}</div>
            </div>
          </label>

          <label className="flex items-start gap-2 rounded border p-3 cursor-pointer">
            <input
              type="radio"
              checked={source === "custom"}
              onChange={() => {
                setSource("custom");
                setError(null);
              }}
              className="mt-1"
            />
            <div className="text-sm w-full">
              <div className="font-medium mb-2">Use custom value</div>
              <input
                type="number"
                value={customPort}
                onChange={(event) => {
                  setCustomPort(event.target.value);
                  setError(null);
                }}
                min="1"
                max="65535"
                placeholder="Enter port"
                disabled={source !== "custom"}
                className="w-full rounded border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
            </div>
          </label>

          {error && (
            <div className="flex items-center gap-1.5 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="secondary" onClick={onSkip}>
            Skip once
          </Button>
          <Button type="button" onClick={handleConfirm}>
            Sync both & continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
