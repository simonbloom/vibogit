"use client";

import { useMemo, useState } from "react";
import { Eye, EyeOff, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AI_PROVIDERS } from "@/lib/ai-service";
import type { Config } from "@vibogit/shared";

interface AISettingsSectionProps {
  config: Config;
  isDaemonConnected: boolean;
  onSave: (updates: Partial<Config>) => void;
}

export function AISettingsSection({ config, isDaemonConnected, onSave }: AISettingsSectionProps) {
  const [showApiKey, setShowApiKey] = useState(false);
  const selectedProvider = useMemo(
    () => AI_PROVIDERS.find((provider) => provider.id === config.aiProvider),
    [config.aiProvider]
  );

  return (
    <section className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-foreground">AI Provider</label>
        <select
          value={config.aiProvider}
          onChange={(event) => {
            const newProvider = event.target.value as Config["aiProvider"];
            const provider = AI_PROVIDERS.find((p) => p.id === newProvider);
            onSave({ aiProvider: newProvider, aiModel: provider?.model || "" });
          }}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {AI_PROVIDERS.map((provider) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </div>

      {selectedProvider && selectedProvider.models.length > 1 && (
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">Model</label>
          <select
            value={config.aiModel || selectedProvider.model}
            onChange={(event) => onSave({ aiModel: event.target.value })}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {selectedProvider.models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.displayName}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between gap-4">
          <label className="block text-sm font-medium text-foreground">API Key</label>
          {selectedProvider && (
            <a
              href={selectedProvider.keyHelpUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              Get key
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>

        <div className="relative">
          <input
            type={showApiKey ? "text" : "password"}
            value={config.aiApiKey}
            onChange={(event) => onSave({ aiApiKey: event.target.value })}
            placeholder={selectedProvider?.keyPlaceholder || "Enter API key"}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 pr-10 font-mono text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={() => setShowApiKey((current) => !current)}
            className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2"
            aria-label={showApiKey ? "Hide API key" : "Show API key"}
          >
            {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>

        <p className="mt-1 text-xs text-muted-foreground">
          {isDaemonConnected ? "Stored in ~/.vibogit/config.json" : "Stored locally in your browser"}
        </p>
      </div>
    </section>
  );
}
