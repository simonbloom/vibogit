"use client";

import { useState, useEffect } from "react";
import { Monitor, Download, Image, Camera, Check, Folder } from "lucide-react";
import { clsx } from "clsx";

interface PathSelectorProps {
  value: string;
  onChange: (path: string) => void;
  homeDir?: string;
}

interface QuickPath {
  id: string;
  label: string;
  icon: React.ReactNode;
  path: string;
}

interface DetectedApp {
  id: string;
  name: string;
  path: string;
  detected: boolean;
}

export function PathSelector({ value, onChange, homeDir = "" }: PathSelectorProps) {
  const [detectedApps, setDetectedApps] = useState<DetectedApp[]>([]);
  const [selectedQuick, setSelectedQuick] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<string | null>(null);

  // Determine home directory (we'll try to infer from value or use a default)
  const home = homeDir || (value?.match(/^\/Users\/([^/]+)/)?.[0] || "/Users/you");

  const quickPaths: QuickPath[] = [
    { id: "desktop", label: "Desktop", icon: <Monitor className="w-4 h-4" />, path: `${home}/Desktop/` },
    { id: "downloads", label: "Downloads", icon: <Download className="w-4 h-4" />, path: `${home}/Downloads/` },
    { id: "pictures", label: "Pictures", icon: <Image className="w-4 h-4" />, path: `${home}/Pictures/` },
    { id: "screenshots", label: "Screenshots", icon: <Camera className="w-4 h-4" />, path: `${home}/Pictures/Screenshots/` },
  ];

  // Common screenshot app locations
  const knownApps: DetectedApp[] = [
    { id: "cleanshot", name: "CleanShot X", path: `${home}/Desktop/`, detected: false },
    { id: "shottr", name: "Shottr", path: `${home}/Pictures/Shottr/`, detected: false },
    { id: "macos", name: "macOS Default", path: `${home}/Desktop/`, detected: true },
    { id: "droplr", name: "Droplr", path: `${home}/Droplr/`, detected: false },
  ];

  useEffect(() => {
    // Check which quick path matches current value
    const matchingQuick = quickPaths.find(q => value === q.path);
    setSelectedQuick(matchingQuick?.id || null);
    
    // Check which app path matches current value
    const matchingApp = knownApps.find(a => value === a.path);
    setSelectedApp(matchingApp?.id || null);
    
    setDetectedApps(knownApps);
  }, [value, home]);

  const handleQuickSelect = (quick: QuickPath) => {
    onChange(quick.path);
    setSelectedQuick(quick.id);
    setSelectedApp(null);
  };

  const handleAppSelect = (app: DetectedApp) => {
    onChange(app.path);
    setSelectedApp(app.id);
    setSelectedQuick(null);
  };

  return (
    <div className="space-y-4">
      {/* Manual Input */}
      <div>
        <div className="relative">
          <input
            type="text"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setSelectedQuick(null);
              setSelectedApp(null);
            }}
            placeholder="/Users/you/Desktop/"
            className="w-full px-3 py-2 pr-10 bg-neutral-50 border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono text-sm"
          />
          <Folder className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
        </div>
      </div>

      {/* Quick Select */}
      <div>
        <div className="text-xs font-medium text-neutral-500 mb-2 flex items-center gap-1">
          <span>⚡</span> Quick Select
        </div>
        <div className="flex flex-wrap gap-2">
          {quickPaths.map((quick) => (
            <button
              key={quick.id}
              onClick={() => handleQuickSelect(quick)}
              className={clsx(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                selectedQuick === quick.id
                  ? "bg-green-100 text-green-700 border border-green-300"
                  : "bg-neutral-100 text-neutral-600 border border-neutral-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200"
              )}
            >
              {selectedQuick === quick.id ? <Check className="w-3.5 h-3.5" /> : quick.icon}
              {quick.label}
            </button>
          ))}
        </div>
      </div>

      {/* Detected Apps */}
      <div>
        <div className="text-xs font-medium text-neutral-500 mb-2 flex items-center gap-1">
          <span>📷</span> Screenshot Apps
        </div>
        <div className="bg-neutral-50 rounded-lg border border-neutral-200 divide-y divide-neutral-200">
          {detectedApps.map((app) => (
            <button
              key={app.id}
              onClick={() => handleAppSelect(app)}
              className={clsx(
                "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg",
                selectedApp === app.id
                  ? "bg-green-50"
                  : "hover:bg-blue-50"
              )}
            >
              <div
                className={clsx(
                  "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors",
                  selectedApp === app.id
                    ? "border-green-500 bg-green-500"
                    : "border-neutral-300"
                )}
              >
                {selectedApp === app.id && <Check className="w-2.5 h-2.5 text-white" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={clsx(
                    "text-sm font-medium",
                    selectedApp === app.id ? "text-green-700" : "text-neutral-700"
                  )}>
                    {app.name}
                  </span>
                </div>
                <div className="text-xs text-neutral-500 font-mono truncate">
                  {app.path.replace(home, "~")}
                </div>
              </div>
              {selectedApp === app.id && (
                <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className="flex items-start gap-2 text-xs text-neutral-500 bg-blue-50 rounded-lg px-3 py-2">
        <span>💡</span>
        <span>This path is used when copying prompts with pasted images</span>
      </div>
    </div>
  );
}
