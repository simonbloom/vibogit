import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

export class SystemService {
  async pickFolder(): Promise<string | null> {
    try {
      const script = `
        tell application "System Events"
          activate
          set folderPath to choose folder with prompt "Open a Git Project"
          return POSIX path of folderPath
        end tell
      `;

      const result = await $`osascript -e ${script}`.text();
      const path = result.trim();
      return path || null;
    } catch {
      return null;
    }
  }

  async isGitRepo(path: string): Promise<boolean> {
    return existsSync(join(path, ".git"));
  }

  async initGit(path: string): Promise<void> {
    await $`git init ${path}`;
  }

  async openInFinder(path: string): Promise<void> {
    await $`open ${path}`;
  }

  async openInTerminal(path: string, terminal: string = "Terminal"): Promise<void> {
    await $`open -a ${terminal} ${path}`;
  }

  async openInEditor(path: string, editor?: string, appName?: string): Promise<void> {
    if (appName) {
      await $`open -a ${appName} ${path}`;
    } else if (editor) {
      await $`${editor} ${path}`;
    } else {
      await $`open -a Cursor ${path}`;
    }
  }

  async openInBrowser(url: string): Promise<void> {
    await $`open ${url}`;
  }
}
