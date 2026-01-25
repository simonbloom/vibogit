import { spawn, type Subprocess } from "bun";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface DevServerConfig {
  command: string;
  args: string[];
  port?: number;
}

export interface DevServerState {
  running: boolean;
  port?: number;
  logs: string[];
}

type LogCallback = (log: string) => void;

export class DevServerManager {
  private processes: Map<string, Subprocess> = new Map();
  private logs: Map<string, string[]> = new Map();
  private callbacks: Map<string, Set<LogCallback>> = new Map();
  private ports: Map<string, number> = new Map();

  async detectCommand(repoPath: string): Promise<DevServerConfig | null> {
    // Check package.json for scripts
    const packageJsonPath = join(repoPath, "package.json");
    if (existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));
        const scripts = packageJson.scripts || {};

        // Common dev script names in order of preference
        const devScripts = ["dev", "start", "serve", "develop"];
        for (const script of devScripts) {
          if (scripts[script]) {
            // Detect package manager
            const packageManager = this.detectPackageManager(repoPath);
            return {
              command: packageManager,
              args: ["run", script],
              port: this.detectPort(scripts[script]),
            };
          }
        }
      } catch {
        // Ignore parse errors
      }
    }

    return null;
  }

  private detectPackageManager(repoPath: string): string {
    if (existsSync(join(repoPath, "bun.lockb"))) return "bun";
    if (existsSync(join(repoPath, "pnpm-lock.yaml"))) return "pnpm";
    if (existsSync(join(repoPath, "yarn.lock"))) return "yarn";
    return "npm";
  }

  private detectPort(script: string): number | undefined {
    // Try to detect port from script
    // Match: --port 3000, -p 3000, PORT=3000, :3000
    const portMatch = script.match(/(?:--port\s+|-p\s+|PORT=|:)(\d{4,5})/);
    if (portMatch) {
      return parseInt(portMatch[1], 10);
    }
    // Default ports for common frameworks
    if (script.includes("next")) return 3000;
    if (script.includes("vite")) return 5173;
    if (script.includes("react-scripts")) return 3000;
    return 3000;
  }

  async start(
    repoPath: string,
    config: DevServerConfig,
    onLog: LogCallback
  ): Promise<void> {
    // Stop any existing process
    await this.stop(repoPath);

    // Initialize logs
    this.logs.set(repoPath, []);
    
    // Register callback
    if (!this.callbacks.has(repoPath)) {
      this.callbacks.set(repoPath, new Set());
    }
    this.callbacks.get(repoPath)!.add(onLog);

    const addLog = (log: string) => {
      const logs = this.logs.get(repoPath) || [];
      logs.push(log);
      // Keep only last 200 lines
      if (logs.length > 200) {
        logs.shift();
      }
      this.logs.set(repoPath, logs);
      
      // Notify all callbacks
      const callbacks = this.callbacks.get(repoPath);
      if (callbacks) {
        for (const cb of callbacks) {
          cb(log);
        }
      }
    };

    console.log(`[DevServer] Starting: ${config.command} ${config.args.join(" ")}`);
    addLog(`> ${config.command} ${config.args.join(" ")}`);

    if (config.port) {
      this.ports.set(repoPath, config.port);
    } else {
      this.ports.delete(repoPath);
    }

    const proc = spawn({
      cmd: [config.command, ...config.args],
      cwd: repoPath,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        ...process.env,
        FORCE_COLOR: "1",
        NODE_ENV: "development",
        ...(config.port ? { PORT: String(config.port) } : {}),
      },
    });

    this.processes.set(repoPath, proc);

    // Read stdout
    (async () => {
      const reader = proc.stdout.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(Boolean);
        for (const line of lines) {
          addLog(line);
        }
      }
    })();

    // Read stderr
    (async () => {
      const reader = proc.stderr.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value);
        const lines = text.split("\n").filter(Boolean);
        for (const line of lines) {
          addLog(line);
        }
      }
    })();

    // Handle exit
    proc.exited.then((code) => {
      addLog(`> Process exited with code ${code}`);
      this.processes.delete(repoPath);
      this.ports.delete(repoPath);
    });
  }

  async stop(repoPath: string): Promise<void> {
    const proc = this.processes.get(repoPath);
    if (proc) {
      console.log(`[DevServer] Stopping process for: ${repoPath}`);
      proc.kill();
      this.processes.delete(repoPath);
      this.ports.delete(repoPath);
    }
  }

  async restart(
    repoPath: string,
    config: DevServerConfig,
    onLog: LogCallback
  ): Promise<void> {
    await this.stop(repoPath);
    await this.start(repoPath, config, onLog);
  }

  getState(repoPath: string): DevServerState {
    const running = this.processes.has(repoPath);
    const logs = this.logs.get(repoPath) || [];
    
    // Try to detect port from logs
    let port: number | undefined;
    for (const log of logs) {
      const portMatch = log.match(/localhost:(\d+)/);
      if (portMatch) {
        port = parseInt(portMatch[1], 10);
      }
    }

    if (!port) {
      port = this.ports.get(repoPath);
    }

    return {
      running,
      port,
      logs,
    };
  }

  getLogs(repoPath: string): string[] {
    return this.logs.get(repoPath) || [];
  }

  subscribeToLogs(repoPath: string, callback: LogCallback): () => void {
    if (!this.callbacks.has(repoPath)) {
      this.callbacks.set(repoPath, new Set());
    }
    this.callbacks.get(repoPath)!.add(callback);

    return () => {
      this.callbacks.get(repoPath)?.delete(callback);
    };
  }

  stopAll(): void {
    for (const [repoPath] of this.processes) {
      this.stop(repoPath);
    }
  }
}
