"use client";

import { useState } from "react";
import { useDaemon } from "@/lib/daemon-context";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, Copy, ChevronDown, ChevronUp, RefreshCw, ExternalLink } from "lucide-react";

const installMethods = {
  bunx: "bunx vibogit-daemon",
  homebrew: "brew install simonbloom/tap/vibogit && vibogit-daemon",
  global: "bun add -g vibogit-daemon && vibogit-daemon",
};

const bunInstallCommand = "curl -fsSL https://bun.sh/install | bash";

const aiSetupPrompt = `Help me set up ViboGit on my Mac. Please:

1. Check if Bun is installed (run: bun --version)
2. If not installed, install Bun (run: curl -fsSL https://bun.sh/install | bash)
3. Start the ViboGit daemon (run: bunx vibogit-daemon)
4. Keep the daemon running and tell me when it says "WebSocket server running"
5. Then I can open https://vibogit.com in my browser

If you encounter any errors, help me troubleshoot. Common issues:
- Port 9111 in use: run "lsof -ti:9111 | xargs kill -9" first
- Permission errors: may need to restart terminal after Bun install`;

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
  const [installMethod, setInstallMethod] = useState<"bunx" | "homebrew" | "global">("bunx");
  const [showAiPrompt, setShowAiPrompt] = useState(false);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-57px)] p-8">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">ViboGit</h1>
          <p className="text-muted-foreground">Git for the Vibe Coder</p>
        </div>

        <div className="border rounded-lg p-6 space-y-6">
          <h2 className="font-semibold text-lg">Get Started</h2>

          {/* Step 1: Install Bun */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                1
              </span>
              <span className="font-medium">Install Bun (if needed)</span>
            </div>
            <div className="ml-8">
              <CommandBlock command={bunInstallCommand} />
              <p className="text-xs text-muted-foreground mt-1">
                Already have Bun? Skip to step 2.
              </p>
            </div>
          </div>

          {/* Step 2: Start Daemon */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                2
              </span>
              <span className="font-medium">Start the daemon</span>
            </div>
            <div className="ml-8 space-y-2">
              <ToggleGroup
                type="single"
                value={installMethod}
                onValueChange={(value) => value && setInstallMethod(value as typeof installMethod)}
                className="w-full"
              >
                <ToggleGroupItem value="bunx" className="flex-1">
                  bunx
                </ToggleGroupItem>
                <ToggleGroupItem value="homebrew" className="flex-1">
                  Homebrew
                </ToggleGroupItem>
                <ToggleGroupItem value="global" className="flex-1">
                  Global
                </ToggleGroupItem>
              </ToggleGroup>
              <CommandBlock command={installMethods[installMethod]} />
            </div>
          </div>

          {/* Step 3: Open Project */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                3
              </span>
              <span className="font-medium">Open a project</span>
            </div>
            <p className="ml-8 text-sm text-muted-foreground">
              Once connected, click &quot;Open Project&quot; to get started.
            </p>
          </div>

          {/* Retry Connection */}
          <div className="pt-2">
            <Button onClick={reconnect} className="w-full gap-2">
              <RefreshCw className="w-4 h-4" />
              Retry Connection
            </Button>
          </div>
        </div>

        {/* AI Setup Assistant */}
        <div className="mt-4 border rounded-lg">
          <button
            onClick={() => setShowAiPrompt(!showAiPrompt)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
          >
            <span className="font-medium">Need help? Ask an AI</span>
            {showAiPrompt ? (
              <ChevronUp className="w-4 h-4" />
            ) : (
              <ChevronDown className="w-4 h-4" />
            )}
          </button>
          {showAiPrompt && (
            <div className="px-4 pb-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                Copy this prompt and paste it into Claude, ChatGPT, or your favorite AI:
              </p>
              <div className="relative">
                <pre className="bg-muted rounded-md p-3 text-xs whitespace-pre-wrap font-mono max-h-48 overflow-y-auto">
                  {aiSetupPrompt}
                </pre>
                <div className="absolute top-2 right-2">
                  <CopyButton text={aiSetupPrompt} label="Copy prompt" />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* GitHub Link */}
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
