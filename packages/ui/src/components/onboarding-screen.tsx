"use client";

import { useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { Check, Copy, RefreshCw, ExternalLink } from "lucide-react";

const desktopDevCommand = "cd apps/desktop && bun run dev";

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-7 px-2 text-xs gap-1"
    >
      {copied ? (
        <>
          <Check className="w-3 h-3" />
          Copied!
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label}
        </>
      )}
    </Button>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-muted rounded-md px-3 py-2 font-mono text-sm">
      <code className="truncate">{command}</code>
      <CopyButton text={command} />
    </div>
  );
}

export function OnboardingScreen() {
  const { reconnect } = useDaemon();

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] p-8">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">ViboGit Desktop</h1>
          <p className="text-muted-foreground">Desktop backend is not available in this runtime.</p>
        </div>

        <div className="border rounded-lg p-6 space-y-6">
          <h2 className="font-semibold text-lg">Run with Tauri</h2>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </span>
              <span className="font-medium">Start the desktop runtime</span>
            </div>
            <div className="ml-8">
              <CommandBlock command={desktopDevCommand} />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </span>
              <span className="font-medium">Open the app window</span>
            </div>
            <p className="ml-8 text-sm text-muted-foreground">
              If you are running in a plain browser tab, launch the Tauri app and reconnect.
            </p>
          </div>

          <div className="pt-2">
            <Button onClick={reconnect} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Reconnect Desktop Backend
            </Button>
          </div>
        </div>

        <div className="mt-4 text-center">
          <a
            href="https://github.com/simonbloom/vibogit"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            View on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
