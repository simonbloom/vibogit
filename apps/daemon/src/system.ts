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

  async sendToTerminal(text: string, terminal: string = "Terminal"): Promise<void> {
    // Escape text for AppleScript
    const escapedText = text.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    
    let script: string;
    
    if (terminal === "iTerm" || terminal === "iTerm2") {
      // iTerm2 has native write text command
      script = `
        tell application "iTerm"
          activate
          tell current session of current window
            write text "${escapedText}" without newline
          end tell
        end tell
      `;
    } else {
      // Terminal.app, Ghostty, and others - use clipboard + paste
      const pbcopy = Bun.spawn(["pbcopy"], { stdin: "pipe" });
      pbcopy.stdin.write(text);
      pbcopy.stdin.end();
      await pbcopy.exited;
      
      const appName = terminal === "Ghostty" ? "Ghostty" : terminal;
      
      script = `
        tell application "${appName}"
          activate
        end tell
        delay 0.3
        tell application "System Events"
          tell process "${appName}"
            keystroke "v" using command down
          end tell
        end tell
      `;
    }
    
    await $`osascript -e ${script}`;
  }
}
