import { homedir } from "os";
import { join } from "path";
import { mkdir, chmod } from "fs/promises";
import { existsSync } from "fs";
import { $ } from "bun";
import { Config, DEFAULT_CONFIG } from "@vibogit/shared";

const CONFIG_DIR = join(homedir(), ".vibogit");
const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export class ConfigService {
  private config: Config = { ...DEFAULT_CONFIG };
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;

    // Ensure config directory exists
    if (!existsSync(CONFIG_DIR)) {
      await mkdir(CONFIG_DIR, { recursive: true });
    }

    // Load existing config or create default
    if (existsSync(CONFIG_FILE)) {
      await this.loadConfig();
    } else {
      // Auto-detect computer name on first run
      this.config.computerName = await this.detectComputerName();
      await this.saveConfig();
    }

    this.initialized = true;
    console.log(`[Config] Loaded from ${CONFIG_FILE}`);
  }

  private async loadConfig(): Promise<void> {
    try {
      const file = Bun.file(CONFIG_FILE);
      const content = await file.text();
      const parsed = JSON.parse(content);
      this.config = { ...DEFAULT_CONFIG, ...parsed };
    } catch (error) {
      console.error("[Config] Failed to load config, using defaults:", error);
      this.config = { ...DEFAULT_CONFIG };
      // Try to detect computer name even on error
      this.config.computerName = await this.detectComputerName();
    }
  }

  private async saveConfig(): Promise<void> {
    try {
      const content = JSON.stringify(this.config, null, 2);
      await Bun.write(CONFIG_FILE, content);
      // Set file permissions to 600 (user read/write only)
      await chmod(CONFIG_FILE, 0o600);
    } catch (error) {
      console.error("[Config] Failed to save config:", error);
    }
  }

  private async detectComputerName(): Promise<string> {
    try {
      const result = await $`scutil --get ComputerName`.text();
      return result.trim();
    } catch {
      try {
        const result = await $`hostname`.text();
        return result.trim();
      } catch {
        return "";
      }
    }
  }

  getConfig(): Config {
    return { ...this.config };
  }

  async setConfig(partial: Partial<Config>): Promise<Config> {
    this.config = { ...this.config, ...partial };
    await this.saveConfig();
    return this.getConfig();
  }

  getConfigPath(): string {
    return CONFIG_FILE;
  }
}
