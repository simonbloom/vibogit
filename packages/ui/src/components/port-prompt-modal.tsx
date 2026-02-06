"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, AlertCircle, AlertTriangle } from "lucide-react";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (port: number, saveToConfig: boolean) => void;
  defaultPort?: number;
  isMonorepo?: boolean;
}

export function PortPromptModal({ isOpen, onClose, onSubmit, defaultPort = 3000, isMonorepo = false }: Props) {
  const [port, setPort] = useState(defaultPort.toString());
  const [saveToConfig, setSaveToConfig] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reset port when defaultPort changes
  useEffect(() => {
    setPort(defaultPort.toString());
  }, [defaultPort]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const portNum = parseInt(port, 10);
    
    // Validate port
    if (isNaN(portNum)) {
      setError("Please enter a valid port number");
      return;
    }
    
    if (portNum < 1 || portNum > 65535) {
      setError("Port must be between 1 and 65535");
      return;
    }
    
    // Common reserved ports warning
    if (portNum < 1024 && portNum !== 80 && portNum !== 443) {
      setError("Ports below 1024 require admin privileges");
      return;
    }
    
    onSubmit(portNum, saveToConfig);
    onClose();
  };

  const handlePortChange = (value: string) => {
    setPort(value);
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-background border rounded-lg shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {isMonorepo ? "Monorepo Detected" : "Dev Server Port"}
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Monorepo Warning */}
        {isMonorepo && (
          <div className="flex items-start gap-3 p-3 mb-4 bg-yellow-500/10 border border-yellow-500/20 rounded-md">
            <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-500">This project uses turbo/nx/lerna</p>
              <p className="text-muted-foreground mt-1">
                Running &quot;bun run dev&quot; will start all workspaces. For a single app, open its folder directly in ViboGit.
              </p>
            </div>
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {isMonorepo 
            ? "Enter the port to monitor for the main application."
            : "No port configuration found in agents.md. Please enter the port your dev server runs on."}
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="port" className="block text-sm font-medium mb-1.5">
              Port Number
            </label>
            <input
              id="port"
              type="number"
              value={port}
              onChange={(e) => handlePortChange(e.target.value)}
              placeholder="3000"
              min="1"
              max="65535"
              className="w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
              autoFocus
            />
            {error && (
              <div className="flex items-center gap-1.5 mt-2 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </div>

          {/* Save to config checkbox */}
          <label className="flex items-center gap-2 mb-6 cursor-pointer">
            <input
              type="checkbox"
              checked={saveToConfig}
              onChange={(e) => setSaveToConfig(e.target.checked)}
              className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm">Save port to agents.md for future use</span>
          </label>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">
              {isMonorepo ? "Connect Anyway" : "Connect"}
            </Button>
          </div>
        </form>

        {/* Hint */}
        <div className="mt-4 p-3 bg-muted/50 rounded-md">
          <p className="text-xs text-muted-foreground">
            <strong>Tip:</strong> Add this to your agents.md to skip this prompt:
          </p>
          <code className="block mt-1 text-xs font-mono">- Dev server port: {port || "3000"}</code>
        </div>
      </div>
    </div>
  );
}
