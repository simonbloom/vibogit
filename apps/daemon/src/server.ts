import type { ServerWebSocket } from "bun";
import type { WebSocketMessage, DevServerConfig } from "./types";
import type { Config } from "@vibogit/shared";
import { GitService } from "./git";
import { FileWatcher } from "./watch";
import { SystemService } from "./system";
import { DevServerManager } from "./devserver";
import { SecureStorage } from "./keychain";
import { ConfigService } from "./config";
import { readAgentsConfig, updateAgentsConfig } from "./agents-config";
import { readdirSync, statSync, existsSync, readFileSync } from "fs";
import { join, relative } from "path";
import { homedir } from "os";

interface Skill {
  name: string;
  description: string;
  path: string;
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const frontmatterMatch = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!frontmatterMatch) return {};
  
  const frontmatter = frontmatterMatch[1];
  const nameMatch = frontmatter.match(/^name:\s*["']?(.+?)["']?\s*$/m);
  const descMatch = frontmatter.match(/^description:\s*["']?(.+?)["']?\s*$/m);
  
  return {
    name: nameMatch?.[1]?.trim(),
    description: descMatch?.[1]?.trim(),
  };
}

function getSkillsDirectories(): string[] {
  const paths = new Set<string>();

  const factorySkillsPath = process.env.FACTORY_SKILLS_PATH;
  if (factorySkillsPath) {
    paths.add(factorySkillsPath);
  }

  const factoryHome = process.env.FACTORY_HOME;
  if (factoryHome) {
    paths.add(join(factoryHome, "skills"));
  }

  const homeCandidates = new Set(
    [process.env.HOME, homedir(), process.env.USER ? join("/Users", process.env.USER) : null].filter(
      (value): value is string => Boolean(value)
    )
  );

  for (const home of homeCandidates) {
    paths.add(join(home, ".factory", "skills"));
  }

  return Array.from(paths);
}

function listSkills(): Skill[] {
  const skillsByPath = new Map<string, Skill>();

  for (const skillsPath of getSkillsDirectories()) {
    if (!existsSync(skillsPath)) continue;

    try {
      const entries = readdirSync(skillsPath, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith(".")) continue;

        const skillDir = join(skillsPath, entry.name);
        const skillFile = join(skillDir, "SKILL.md");

        if (!existsSync(skillFile)) continue;

        try {
          const content = readFileSync(skillFile, "utf-8");
          const { name, description } = parseSkillFrontmatter(content);

          skillsByPath.set(skillDir, {
            name: name || entry.name,
            description: description || "",
            path: skillDir,
          });
        } catch {
          // Skip malformed skill files
        }
      }
    } catch {
      // Skills directory not readable
    }
  }

  return Array.from(skillsByPath.values()).sort((a, b) => a.name.localeCompare(b.name));
}

interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
}

async function listFilesRecursive(basePath: string, currentPath: string, maxDepth: number, depth = 0, showHidden = false): Promise<FileNode[]> {
  if (depth > maxDepth) return [];
  
  const ignoreDirs = new Set(["node_modules", ".git", ".next", "dist", "build", ".turbo", ".cache"]);
  const nodes: FileNode[] = [];
  
  try {
    const entries = readdirSync(currentPath, { withFileTypes: true });
    
    for (const entry of entries) {
      if (ignoreDirs.has(entry.name)) continue;
      if (!showHidden && entry.name.startsWith(".")) continue;
      
      const fullPath = join(currentPath, entry.name);
      const relativePath = relative(basePath, fullPath);
      
      if (entry.isDirectory()) {
        const children = await listFilesRecursive(basePath, fullPath, maxDepth, depth + 1, showHidden);
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "directory",
          children,
        });
      } else {
        nodes.push({
          name: entry.name,
          path: relativePath,
          type: "file",
        });
      }
    }
  } catch {
    // Ignore errors (permission denied, etc.)
  }
  
  // Sort: directories first, then files, alphabetically
  return nodes.sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "directory" ? -1 : 1;
  });
}

interface ClientData {
  id: string;
  watchedPaths: Set<string>;
}

const gitService = new GitService();
const fileWatcher = new FileWatcher();
const systemService = new SystemService();
const devServerManager = new DevServerManager();
const secureStorage = new SecureStorage();
const configService = new ConfigService();
const clients = new Map<ServerWebSocket<ClientData>, ClientData>();

// Initialize config service
configService.init().catch((err) => {
  console.error("[Config] Failed to initialize:", err);
});

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

      case "stageAll": {
        const { repoPath } = payload as { repoPath: string };
        await gitService.stage(repoPath, ["."]);
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
      case "readFile": {
        const { repoPath, filePath } = payload as {
          repoPath: string;
          filePath: string;
        };
        const fullPath = join(repoPath, filePath);
        const file = Bun.file(fullPath);
        const size = file.size;
        if (size > 1024 * 1024) {
          throw new Error("File too large (> 1MB)");
        }
        const content = await file.text();
        response = { content };
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
        const { path, terminal } = payload as { path: string; terminal?: string };
        await systemService.openInTerminal(path, terminal);
        response = { success: true };
        break;
      }

      case "sendToTerminal": {
        const { text, terminal } = payload as { text: string; terminal?: string };
        await systemService.sendToTerminal(text, terminal);
        response = { success: true };
        break;
      }

      case "openEditor": {
        const { path, editor, appName } = payload as { path: string; editor?: string; appName?: string };
        await systemService.openInEditor(path, editor, appName);
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
        console.log("[devServerStart] Starting for path:", path, "config:", config);
        await devServerManager.start(path, config, (log) => {
          // Send log to client
          try {
            ws.send(JSON.stringify({
              type: "devServerLog",
              id: generateId(),
              payload: { path, log },
            }));
          } catch (err) {
            console.log("[devServerStart] Failed to send log:", err);
          }
        });
        console.log("[devServerStart] Started successfully");
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

      case "stashList": {
        const { repoPath } = payload as { repoPath: string };
        const stashes = await gitService.stashList(repoPath);
        response = { stashes };
        break;
      }

      case "stashSave": {
        const { repoPath, message } = payload as { repoPath: string; message?: string };
        await gitService.stashSave(repoPath, message);
        response = { success: true };
        break;
      }

      case "stashPop": {
        const { repoPath, index } = payload as { repoPath: string; index?: number };
        await gitService.stashPop(repoPath, index);
        response = { success: true };
        break;
      }

      case "stashDrop": {
        const { repoPath, index } = payload as { repoPath: string; index?: number };
        await gitService.stashDrop(repoPath, index);
        response = { success: true };
        break;
      }

      case "keychainGet": {
        const { key } = payload as { key: string };
        const value = await secureStorage.getApiKey(key);
        response = { value };
        break;
      }

      case "keychainSet": {
        const { key, value } = payload as { key: string; value: string };
        await secureStorage.setApiKey(key, value);
        response = { success: true };
        break;
      }

      case "keychainDelete": {
        const { key } = payload as { key: string };
        const deleted = await secureStorage.deleteApiKey(key);
        response = { success: deleted };
        break;
      }

      case "listFiles": {
        const { path, showHidden } = payload as { path: string; showHidden?: boolean };
        const tree = await listFilesRecursive(path, path, 2, 0, showHidden ?? false);
        response = { tree };
        break;
      }

      case "getRemotes": {
        const { repoPath } = payload as { repoPath: string };
        const remotes = await gitService.getRemotes(repoPath);
        response = { remotes };
        break;
      }

      case "readAgentsConfig": {
        const { repoPath } = payload as { repoPath: string };
        const config = readAgentsConfig(repoPath);
        response = { config };
        break;
      }

      case "updateAgentsConfig": {
        const { repoPath, port, devCommand } = payload as {
          repoPath: string;
          port: number;
          devCommand?: string;
        };
        const result = updateAgentsConfig(repoPath, port, devCommand);
        response = result;
        break;
      }

      case "killPort": {
        const { port } = payload as { port: number };
        console.log("[killPort] Killing port:", port);
        
        if (!port || port < 1 || port > 65535) {
          response = { success: false, killed: false, error: "Invalid port" };
          break;
        }
        
        try {
          // Check if anything is on the port first
          const checkResult = Bun.spawnSync({
            cmd: ["lsof", "-ti", `:${port}`],
          });
          
          const pids = checkResult.stdout.toString().trim();
          console.log("[killPort] PIDs on port", port, ":", pids || "(none)");
          
          if (!pids) {
            response = { success: true, killed: false };
            break;
          }
          
          // Kill the processes
          Bun.spawnSync({
            cmd: ["sh", "-c", `lsof -ti:${port} | xargs kill -9 2>/dev/null || true`],
          });
          
          console.log("[killPort] Killed processes on port", port);
          response = { success: true, killed: true };
        } catch (error) {
          console.log("[killPort] Error:", error);
          response = { success: false, killed: false, error: String(error) };
        }
        break;
      }

      case "getConfig": {
        const config = configService.getConfig();
        response = { config };
        break;
      }

      case "setConfig": {
        const { config: partialConfig } = payload as { config: Partial<Config> };
        const updatedConfig = await configService.setConfig(partialConfig);
        response = { config: updatedConfig };
        // Broadcast config change to all other clients
        broadcast(
          {
            type: "configChanged",
            id: generateId(),
            payload: { config: updatedConfig },
          },
          (data) => data.id !== clientData?.id
        );
        break;
      }

      case "list-skills": {
        const skills = listSkills();
        response = { skills };
        break;
      }

      case "getFavicon": {
        const { path: projectPath } = payload as { path: string };
        const MAX_SIZE = 100 * 1024; // 100KB
        const IGNORE_DIRS = new Set(["node_modules", ".next", ".git", "dist", "build", ".turbo", ".cache", ".output"]);
        
        const getMimeType = (file: string): string | null => {
          if (file.endsWith(".svg")) return "image/svg+xml";
          if (file.endsWith(".ico")) return "image/x-icon";
          if (file.endsWith(".png")) return "image/png";
          return null;
        };
        
        // Search for favicon/icon files recursively (max 4 levels deep)
        const findIcons = (dir: string, depth = 0): string[] => {
          if (depth > 4) return [];
          const results: string[] = [];
          
          try {
            const entries = readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory()) {
                if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
                  results.push(...findIcons(join(dir, entry.name), depth + 1));
                }
              } else if (entry.isFile()) {
                const name = entry.name.toLowerCase();
                // Match favicon.*, icon.*, logo.*, or *-icon.* patterns
                if (
                  (name.startsWith("favicon.") || name.startsWith("icon.") || name.startsWith("logo.") || name.includes("-icon.")) &&
                  (name.endsWith(".svg") || name.endsWith(".ico") || name.endsWith(".png"))
                ) {
                  results.push(join(dir, entry.name));
                }
              }
            }
          } catch {
            // Skip unreadable directories
          }
          
          return results;
        };
        
        const iconFiles = findIcons(projectPath);
        
        // Sort by priority: favicon > icon > logo, then svg > ico > png, then shorter path
        iconFiles.sort((a, b) => {
          const nameA = a.toLowerCase();
          const nameB = b.toLowerCase();
          
          // Prioritize "favicon" in name
          const aFavicon = nameA.includes("favicon");
          const bFavicon = nameB.includes("favicon");
          if (aFavicon && !bFavicon) return -1;
          if (!aFavicon && bFavicon) return 1;
          
          // Prioritize SVG > ICO > PNG
          const extOrder = (p: string) => p.endsWith(".svg") ? 0 : p.endsWith(".ico") ? 1 : 2;
          const extDiff = extOrder(nameA) - extOrder(nameB);
          if (extDiff !== 0) return extDiff;
          
          // Prioritize shorter paths (closer to root)
          return a.length - b.length;
        });
        
        let favicon: string | null = null;
        let mimeType: string | null = null;
        
        for (const iconPath of iconFiles) {
          try {
            const stats = statSync(iconPath);
            if (stats.size <= MAX_SIZE) {
              const mime = getMimeType(iconPath);
              if (mime) {
                const content = readFileSync(iconPath);
                favicon = content.toString("base64");
                mimeType = mime;
                break;
              }
            }
          } catch {
            // Skip unreadable files
          }
        }
        
        response = { favicon, mimeType };
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
