import type { WebSocketMessage } from "@vibogit/shared";
import { gitStatus, gitSave, gitShip, gitSync, gitLog, gitDiff } from "./git";
import { setCurrentProject, getCurrentProject, getRecentProjects } from "./projects";
import { startWatcher, stopWatcher } from "./watcher";

type BroadcastFn = (event: WebSocketMessage) => void;

let currentProjectPath: string | null = null;

export async function handleMessage(
  message: WebSocketMessage,
  broadcast: BroadcastFn
): Promise<WebSocketMessage> {
  const { id, type, payload } = message;
  const data = payload as Record<string, unknown> | undefined;

  try {
    switch (type) {
      case "ping":
        return { id, type: "pong", payload: { timestamp: Date.now() } };

      case "git:status": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No project path specified");
        }
        const status = await gitStatus(path);
        return { id, type: "success", payload: status };
      }

      case "git:commit": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No project path specified");
        }
        const message = data?.message as string | undefined;
        const result = await gitSave(path, message);
        return { id, type: "success", payload: result };
      }

      case "git:push": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No project path specified");
        }
        const result = await gitShip(path);
        return { id, type: "success", payload: result };
      }

      case "git:sync": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No project path specified");
        }
        const result = await gitSync(path);
        return { id, type: "success", payload: result };
      }

      case "git:log": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No project path specified");
        }
        const limit = data?.limit as number | undefined;
        const log = await gitLog(path, limit);
        return { id, type: "success", payload: log };
      }

      case "git:diff": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No project path specified");
        }
        const diff = await gitDiff(path);
        return { id, type: "success", payload: diff };
      }

      case "repo:set": {
        const path = data?.path as string;
        if (!path) {
          throw new Error("No path specified");
        }
        
        // Stop existing watcher
        stopWatcher();
        
        // Set new project
        currentProjectPath = path;
        const project = await setCurrentProject(path);
        
        // Start watcher for new project
        startWatcher(path, broadcast);
        
        return { id, type: "success", payload: project };
      }

      case "repo:current": {
        const project = getCurrentProject();
        return { id, type: "success", payload: project };
      }

      case "repo:list": {
        const projects = getRecentProjects();
        return { id, type: "success", payload: projects };
      }

      case "launcher:editor": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No path specified");
        }
        await openInEditor(path);
        return { id, type: "success", payload: { opened: true } };
      }

      case "launcher:terminal": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No path specified");
        }
        await openInTerminal(path);
        return { id, type: "success", payload: { opened: true } };
      }

      case "launcher:finder": {
        const path = (data?.path as string) || currentProjectPath;
        if (!path) {
          throw new Error("No path specified");
        }
        await openInFinder(path);
        return { id, type: "success", payload: { opened: true } };
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }
  } catch (error) {
    return {
      id,
      type: "error",
      payload: {
        message: error instanceof Error ? error.message : "Unknown error",
      },
    };
  }
}

async function openInEditor(path: string): Promise<void> {
  const editors = ["cursor", "code", "subl", "atom"];
  
  for (const editor of editors) {
    try {
      const proc = Bun.spawn(["which", editor]);
      await proc.exited;
      if (proc.exitCode === 0) {
        Bun.spawn([editor, path]);
        return;
      }
    } catch {
      continue;
    }
  }
  
  // Fallback: open with default
  Bun.spawn(["open", path]);
}

async function openInTerminal(path: string): Promise<void> {
  const script = `tell application "Terminal" to do script "cd '${path}'"`;
  Bun.spawn(["osascript", "-e", script]);
}

async function openInFinder(path: string): Promise<void> {
  Bun.spawn(["open", path]);
}
