import chokidar, { FSWatcher } from "chokidar";
import type { WebSocketMessage, FileChangeEvent } from "@vibogit/shared";

let watcher: FSWatcher | null = null;
let debounceTimer: Timer | null = null;
let pendingPaths: Set<string> = new Set();

type BroadcastFn = (event: WebSocketMessage) => void;

export function startWatcher(path: string, broadcast: BroadcastFn): void {
  // Stop existing watcher
  stopWatcher();

  console.log(`Starting file watcher for: ${path}`);

  watcher = chokidar.watch(path, {
    ignored: [
      /(^|[\/\\])\../,  // Dotfiles
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /\.next/,
    ],
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50,
    },
  });

  watcher.on("all", (event, filePath) => {
    // Add to pending paths
    pendingPaths.add(filePath);

    // Debounce: wait 100ms before emitting
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      if (pendingPaths.size > 0) {
        const paths = Array.from(pendingPaths);
        pendingPaths.clear();

        const fileEvent: FileChangeEvent = {
          paths,
          kind: "change",
        };

        console.log(`File changes detected: ${paths.length} files`);

        broadcast({
          id: `event_${Date.now()}`,
          type: "event:file:change" as any,
          payload: fileEvent,
        });
      }
    }, 100);
  });

  watcher.on("error", (error) => {
    console.error("Watcher error:", error);
  });
}

export function stopWatcher(): void {
  if (watcher) {
    console.log("Stopping file watcher");
    watcher.close();
    watcher = null;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  pendingPaths.clear();
}
