import { existsSync, readFileSync } from "fs";
import { join } from "path";

export interface AgentsConfig {
  port?: number;
  devCommand?: string;
  devArgs?: string[];
  found: boolean;
  filePath?: string;
}

export function readAgentsConfig(repoPath: string): AgentsConfig {
  // Check for agents.md first (lowercase), then AGENTS.md
  const agentsPath = join(repoPath, "agents.md");
  const AGENTSPath = join(repoPath, "AGENTS.md");
  
  let filePath: string | undefined;
  let content: string | undefined;
  
  if (existsSync(agentsPath)) {
    filePath = agentsPath;
    content = readFileSync(agentsPath, "utf-8");
  } else if (existsSync(AGENTSPath)) {
    filePath = AGENTSPath;
    content = readFileSync(AGENTSPath, "utf-8");
  }
  
  if (!content || !filePath) {
    return { found: false };
  }
  
  // Parse port from various patterns
  const port = parsePort(content);
  
  // Parse dev command
  const { devCommand, devArgs } = parseDevCommand(content);
  
  return {
    found: true,
    filePath,
    port,
    devCommand,
    devArgs,
  };
}

function parsePort(content: string): number | undefined {
  // Pattern 1: "Dev server port: 5557" or "dev server port: 5557"
  const devServerPortMatches = [...content.matchAll(/dev\s*server\s*port[:\s]+(\d+)/gi)];
  if (devServerPortMatches.length > 0) {
    const lastMatch = devServerPortMatches[devServerPortMatches.length - 1];
    return parseInt(lastMatch[1], 10);
  }
  
  // Pattern 2: "Port: 3000" or "port: 3000"
  const portMatches = [...content.matchAll(/(?:^|\n)\s*-?\s*port[:\s]+(\d+)/gim)];
  if (portMatches.length > 0) {
    const lastMatch = portMatches[portMatches.length - 1];
    return parseInt(lastMatch[1], 10);
  }
  
  // Pattern 3: "PORT=8080"
  const envMatches = [...content.matchAll(/PORT\s*=\s*(\d+)/g)];
  if (envMatches.length > 0) {
    const lastMatch = envMatches[envMatches.length - 1];
    return parseInt(lastMatch[1], 10);
  }
  
  return undefined;
}

function parseDevCommand(content: string): { devCommand?: string; devArgs?: string[] } {
  // Pattern: "Run dev: `bun run dev`" or "- Run dev: `npm run dev`"
  const runDevMatch = content.match(/run\s*dev[:\s]+`([^`]+)`/i);
  if (runDevMatch) {
    const fullCommand = runDevMatch[1].trim();
    const parts = fullCommand.split(/\s+/);
    return {
      devCommand: parts[0],
      devArgs: parts.slice(1),
    };
  }
  
  return {};
}

export function updateAgentsConfig(
  repoPath: string,
  port: number,
  devCommand?: string
): { success: boolean; created: boolean; filePath: string } {
  const agentsPath = join(repoPath, "agents.md");
  const AGENTSPath = join(repoPath, "AGENTS.md");
  
  let filePath = agentsPath;
  let content = "";
  let created = true;
  
  // Check which file exists
  if (existsSync(agentsPath)) {
    content = readFileSync(agentsPath, "utf-8");
    created = false;
  } else if (existsSync(AGENTSPath)) {
    filePath = AGENTSPath;
    content = readFileSync(AGENTSPath, "utf-8");
    created = false;
  }
  
  // Update or create content
  const newContent = updateOrCreatePortSection(content, port, devCommand);
  
  // Use Bun.write for file writing
  Bun.write(filePath, newContent);
  
  return { success: true, created, filePath };
}

function updateOrCreatePortSection(
  content: string,
  port: number,
  devCommand?: string
): string {
  // If content is empty, create new file
  if (!content.trim()) {
    let newContent = `# Project Configuration\n\n## Development\n- Dev server port: ${port}\n`;
    if (devCommand) {
      newContent += `- Run dev: \`${devCommand}\`\n`;
    }
    return newContent;
  }
  
  // Check if there's already a port line
  const portRegex = /(-?\s*(?:dev\s*server\s*)?port[:\s]+)\d+/i;
  if (portRegex.test(content)) {
    // Update existing port
    return content.replace(portRegex, `$1${port}`);
  }
  
  // Check if there's a Development section
  if (/##\s*Development/i.test(content)) {
    // Add port after the Development header
    return content.replace(
      /(##\s*Development[^\n]*\n)/i,
      `$1- Dev server port: ${port}\n`
    );
  }
  
  // Append a new Development section
  let addition = `\n## Development\n- Dev server port: ${port}\n`;
  if (devCommand) {
    addition += `- Run dev: \`${devCommand}\`\n`;
  }
  return content.trimEnd() + "\n" + addition;
}
