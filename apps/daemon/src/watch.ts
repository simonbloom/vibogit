import { watch, type FSWatcher } from "chokidar";
import type { FileChangeEvent } from "./types";

type ChangeCallback = (event: FileChangeEvent) => void;

export class FileWatcher {
  private watchers: Map<string, FSWatcher> = new Map();
  private callbacks: Map<string, Set<ChangeCallback>> = new Map();

  watch(repoPath: string, callback: ChangeCallback): void {
    // Register callback
    if (!this.callbacks.has(repoPath)) {
      this.callbacks.set(repoPath, new Set());
    }
    this.callbacks.get(repoPath)!.add(callback);

    // Only create watcher if one doesn't exist
    if (this.watchers.has(repoPath)) {
      return;
    }

    console.log(`[FileWatcher] Watching: ${repoPath}`);

    const watcher = watch(repoPath, {
      ignored: [
        /(^|[\/\\])\../, // Dotfiles
        /node_modules/,
        /\.git/,
        /\.next/,
        /dist/,
        /build/,
      ],
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50,
      },
    });

    watcher.on("add", (path) => this.emit(repoPath, path, "add"));
    watcher.on("change", (path) => this.emit(repoPath, path, "change"));
    watcher.on("unlink", (path) => this.emit(repoPath, path, "unlink"));

    watcher.on("error", (error) => {
      console.error(`[FileWatcher] Error in ${repoPath}:`, error);
    });

    this.watchers.set(repoPath, watcher);
  }

  private emit(
    repoPath: string,
    path: string,
    event: "add" | "change" | "unlink"
  ): void {
    const callbacks = this.callbacks.get(repoPath);
    if (!callbacks) return;

    const changeEvent: FileChangeEvent = {
      repoPath,
      path,
      event,
    };

    for (const callback of callbacks) {
      callback(changeEvent);
    }
  }

  unwatch(repoPath: string, callback?: ChangeCallback): void {
    const callbacks = this.callbacks.get(repoPath);
    
    if (callback && callbacks) {
      callbacks.delete(callback);
      
      // If there are still callbacks, don't close the watcher
      if (callbacks.size > 0) {
        return;
      }
    }

    const watcher = this.watchers.get(repoPath);
    if (watcher) {
      console.log(`[FileWatcher] Stopping watch: ${repoPath}`);
      watcher.close();
      this.watchers.delete(repoPath);
    }
    
    this.callbacks.delete(repoPath);
  }

  unwatchAll(): void {
    for (const [repoPath, watcher] of this.watchers) {
      console.log(`[FileWatcher] Stopping watch: ${repoPath}`);
      watcher.close();
    }
    this.watchers.clear();
    this.callbacks.clear();
  }
}
