import type { ServerWebSocket } from "bun";
import type { WebSocketMessage, DevServerConfig } from "./types";
import { GitService } from "./git";
import { FileWatcher } from "./watch";
import { SystemService } from "./system";
import { DevServerManager } from "./devserver";

interface ClientData {
  id: string;
  watchedPaths: Set<string>;
}

const gitService = new GitService();
const fileWatcher = new FileWatcher();
const systemService = new SystemService();
const devServerManager = new DevServerManager();
const clients = new Map<ServerWebSocket<ClientData>, ClientData>();

function generateId(): string {
  return Math.random().toString(36).substring(2, 15);
}

function broadcast(message: WebSocketMessage, filter?: (data: ClientData) => boolean): void {
  const json = JSON.stringify(message);
  for (const [ws, data] of clients) {
    if (!filter || filter(data)) {
      ws.send(json);
    }
  }
}

async function handleMessage(
  ws: ServerWebSocket<ClientData>,
  message: WebSocketMessage
): Promise<void> {
  const { type, id, payload } = message;
  const clientData = clients.get(ws);

  try {
    let response: unknown;

    switch (type) {
      case "status": {
        const { repoPath } = payload as { repoPath: string };
        const status = await gitService.getStatus(repoPath);
        response = { status };
        break;
      }

      case "stage": {
        const { repoPath, files } = payload as { repoPath: string; files: string[] };
        await gitService.stage(repoPath, files);
        response = { success: true };
        break;
      }

      case "unstage": {
        const { repoPath, files } = payload as { repoPath: string; files: string[] };
        await gitService.unstage(repoPath, files);
        response = { success: true };
        break;
      }

      case "commit": {
        const { repoPath, message: commitMessage } = payload as {
          repoPath: string;
          message: string;
        };
        const result = await gitService.commit(repoPath, commitMessage);
        response = result;
        break;
      }

      case "push": {
        const { repoPath, remote, branch, force } = payload as {
          repoPath: string;
          remote?: string;
          branch?: string;
          force?: boolean;
        };
        await gitService.push(repoPath, remote, branch, force);
        response = { success: true };
        break;
      }

      case "pull": {
        const { repoPath, remote, branch } = payload as {
          repoPath: string;
          remote?: string;
          branch?: string;
        };
        await gitService.pull(repoPath, remote, branch);
        response = { success: true };
        break;
      }

      case "fetch": {
        const { repoPath, remote, prune } = payload as {
          repoPath: string;
          remote?: string;
          prune?: boolean;
        };
        await gitService.fetch(repoPath, remote, prune);
        response = { success: true };
        break;
      }

      case "branches": {
        const { repoPath } = payload as { repoPath: string };
        const branches = await gitService.getBranches(repoPath);
        response = { branches };
        break;
      }

      case "checkout": {
        const { repoPath, branch } = payload as { repoPath: string; branch: string };
        await gitService.checkout(repoPath, branch);
        response = { success: true };
        break;
      }

      case "createBranch": {
        const { repoPath, name, checkout } = payload as {
          repoPath: string;
          name: string;
          checkout?: boolean;
        };
        await gitService.createBranch(repoPath, name, checkout);
        response = { success: true };
        break;
      }

      case "diff": {
        const { repoPath, file, staged } = payload as {
          repoPath: string;
          file: string;
          staged?: boolean;
        };
        const diff = await gitService.getDiff(repoPath, file, staged);
        response = { diff };
        break;
      }

      case "log": {
        const { repoPath, limit, branch } = payload as {
          repoPath: string;
          limit?: number;
          branch?: string;
        };
        const commits = await gitService.getLog(repoPath, limit, branch);
        response = { commits };
        break;
      }

      case "watch": {
        const { repoPath } = payload as { repoPath: string };
        if (clientData) {
          clientData.watchedPaths.add(repoPath);
          fileWatcher.watch(repoPath, (event) => {
            broadcast(
              {
                type: "fileChange",
                id: generateId(),
                payload: event,
              },
              (data) => data.watchedPaths.has(repoPath)
            );
          });
        }
        response = { success: true };
        break;
      }

      case "unwatch": {
        const { repoPath } = payload as { repoPath: string };
        if (clientData) {
          clientData.watchedPaths.delete(repoPath);
        }
        response = { success: true };
        break;
      }

      case "pickFolder": {
        const path = await systemService.pickFolder();
        response = { path };
        break;
      }

      case "isGitRepo": {
        const { path } = payload as { path: string };
        const isRepo = await systemService.isGitRepo(path);
        response = { isRepo };
        break;
      }

      case "initGit": {
        const { path } = payload as { path: string };
        await systemService.initGit(path);
        response = { success: true };
        break;
      }

      case "openFinder": {
        const { path } = payload as { path: string };
        await systemService.openInFinder(path);
        response = { success: true };
        break;
      }

      case "openTerminal": {
        const { path } = payload as { path: string };
        await systemService.openInTerminal(path);
        response = { success: true };
        break;
      }

      case "openEditor": {
        const { path, editor } = payload as { path: string; editor?: string };
        await systemService.openInEditor(path, editor);
        response = { success: true };
        break;
      }

      case "openBrowser": {
        const { url } = payload as { url: string };
        await systemService.openInBrowser(url);
        response = { success: true };
        break;
      }

      case "devServerDetect": {
        const { path } = payload as { path: string };
        const config = await devServerManager.detectCommand(path);
        response = { config };
        break;
      }

      case "devServerStart": {
        const { path, config } = payload as { path: string; config: DevServerConfig };
        await devServerManager.start(path, config, (log) => {
          // Send log to client
          ws.send(JSON.stringify({
            type: "devServerLog",
            id: generateId(),
            payload: { path, log },
          }));
        });
        response = { success: true };
        break;
      }

      case "devServerStop": {
        const { path } = payload as { path: string };
        await devServerManager.stop(path);
        response = { success: true };
        break;
      }

      case "devServerRestart": {
        const { path, config } = payload as { path: string; config: DevServerConfig };
        await devServerManager.restart(path, config, (log) => {
          ws.send(JSON.stringify({
            type: "devServerLog",
            id: generateId(),
            payload: { path, log },
          }));
        });
        response = { success: true };
        break;
      }

      case "devServerState": {
        const { path } = payload as { path: string };
        const state = devServerManager.getState(path);
        response = { state };
        break;
      }

      default:
        throw new Error(`Unknown message type: ${type}`);
    }

    ws.send(
      JSON.stringify({
        type,
        id,
        payload: response,
      })
    );
  } catch (error) {
    ws.send(
      JSON.stringify({
        type,
        id,
        error: error instanceof Error ? error.message : "Unknown error",
      })
    );
  }
}

export function createServer(port: number) {
  return Bun.serve<ClientData>({
    port,
    fetch(req, server) {
      const url = new URL(req.url);
      
      if (url.pathname === "/health") {
        return new Response("OK", { status: 200 });
      }

      const upgraded = server.upgrade(req, {
        data: {
          id: generateId(),
          watchedPaths: new Set<string>(),
        },
      });

      if (!upgraded) {
        return new Response("WebSocket upgrade failed", { status: 400 });
      }
    },
    websocket: {
      open(ws) {
        const data = ws.data;
        clients.set(ws, data);
        console.log(`[Client ${data.id}] Connected`);

        ws.send(
          JSON.stringify({
            type: "connect",
            id: generateId(),
            payload: { clientId: data.id },
          })
        );
      },
      message(ws, message) {
        try {
          const parsed = JSON.parse(message.toString()) as WebSocketMessage;
          handleMessage(ws, parsed);
        } catch (error) {
          console.error("[WebSocket] Failed to parse message:", error);
        }
      },
      close(ws) {
        const data = clients.get(ws);
        if (data) {
          console.log(`[Client ${data.id}] Disconnected`);
          clients.delete(ws);
        }
      },
    },
  });
}
