// WebSocket Message Types
export type MessageType =
  | "connect"
  | "disconnect"
  | "status"
  | "stage"
  | "unstage"
  | "commit"
  | "push"
  | "pull"
  | "fetch"
  | "branches"
  | "checkout"
  | "createBranch"
  | "diff"
  | "log"
  | "watch"
  | "unwatch"
  | "fileChange"
  | "error"
  | "pickFolder"
  | "isGitRepo"
  | "initGit"
  | "openFinder"
  | "openTerminal"
  | "sendToTerminal"
  | "openEditor"
  | "openBrowser"
  | "devServerDetect"
  | "devServerStart"
  | "devServerStop"
  | "devServerRestart"
  | "devServerState"
  | "devServerLog"
  | "stashList"
  | "stashSave"
  | "stashPop"
  | "stashDrop"
  | "keychainGet"
  | "keychainSet"
  | "keychainDelete"
  | "listFiles"
  | "getRemotes"
  | "readFile"
  | "readAgentsConfig"
  | "updateAgentsConfig"
  | "killPort"
  | "getConfig"
  | "setConfig"
  | "configChanged"
  | "list-skills"
  | "skills-list"
  | "getFavicon";

export interface WebSocketMessage<T = unknown> {
  type: MessageType;
  id: string;
  payload?: T;
  error?: string;
}

// Git Types
export type FileStatus = "modified" | "added" | "deleted" | "untracked" | "renamed" | "copied";

export interface GitFile {
  path: string;
  status: FileStatus;
  staged: boolean;
  oldPath?: string; // For renamed files
}

export interface GitStatus {
  branch: string;
  ahead: number;
  behind: number;
  staged: GitFile[];
  unstaged: GitFile[];
  untracked: GitFile[];
}

export interface GitBranch {
  name: string;
  current: boolean;
  remote?: string;
  tracking?: string;
  ahead?: number;
  behind?: number;
}

export interface GitCommit {
  hash: string;
  hashShort: string;
  message: string;
  author: string;
  email: string;
  date: string;
  refs?: string[];
  parents?: string[];
}

export interface GitDiff {
  path: string;
  hunks: DiffHunk[];
  oldPath?: string;
  isBinary: boolean;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffLine {
  type: "add" | "delete" | "context";
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

// Request/Response Payloads
export interface StatusRequest {
  repoPath: string;
}

export interface StatusResponse {
  status: GitStatus;
}

export interface StageRequest {
  repoPath: string;
  files: string[];
}

export interface UnstageRequest {
  repoPath: string;
  files: string[];
}

export interface CommitRequest {
  repoPath: string;
  message: string;
}

export interface CommitResponse {
  hash: string;
  message: string;
}

export interface PushRequest {
  repoPath: string;
  remote?: string;
  branch?: string;
  force?: boolean;
}

export interface PullRequest {
  repoPath: string;
  remote?: string;
  branch?: string;
}

export interface FetchRequest {
  repoPath: string;
  remote?: string;
  prune?: boolean;
}

export interface BranchesRequest {
  repoPath: string;
}

export interface BranchesResponse {
  branches: GitBranch[];
}

export interface CheckoutRequest {
  repoPath: string;
  branch: string;
}

export interface CreateBranchRequest {
  repoPath: string;
  name: string;
  checkout?: boolean;
}

export interface DiffRequest {
  repoPath: string;
  file: string;
  staged?: boolean;
}

export interface DiffResponse {
  diff: GitDiff;
}

export interface LogRequest {
  repoPath: string;
  limit?: number;
  branch?: string;
}

export interface LogResponse {
  commits: GitCommit[];
}

export interface WatchRequest {
  repoPath: string;
}

export interface FileChangeEvent {
  repoPath: string;
  path: string;
  event: "add" | "change" | "unlink";
}

// Connection State
export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

export interface DaemonState {
  connection: ConnectionState;
  repoPath: string | null;
  status: GitStatus | null;
  branches: GitBranch[];
  error: string | null;
}

// UI State
export interface Tab {
  id: string;
  repoPath: string;
  name: string;
}

// System Requests
export interface PickFolderResponse {
  path: string | null;
}

export interface IsGitRepoRequest {
  path: string;
}

export interface IsGitRepoResponse {
  isRepo: boolean;
}

export interface InitGitRequest {
  path: string;
}

export interface OpenRequest {
  path: string;
  editor?: string;
}

export interface OpenBrowserRequest {
  url: string;
}

// Recent Project
export interface RecentProject {
  path: string;
  name: string;
  lastOpenedAt: string;
}

// Dev Server
export interface DevServerConfig {
  command: string;
  args: string[];
  port?: number;
  workingDir?: string;
}

export type DevServerReasonCode =
  | "MONOREPO_WRONG_CWD"
  | "PORT_MISMATCH"
  | "STARTUP_TIMEOUT"
  | "COMMAND_FAILED"
  | "PROTOCOL_MISMATCH"
  | "NOT_PREVIEWABLE";

export interface DevServerDiagnostic {
  reasonCode: DevServerReasonCode;
  message: string;
  expectedPort?: number;
  observedPort?: number;
  command?: string;
  cwd?: string;
  suggestedCwd?: string;
  urlAttempts: string[];
  preferredUrl?: string;
  logsTail: string[];
}

export interface DevServerState {
  running: boolean;
  port?: number;
  logs: string[];
  diagnostic?: DevServerDiagnostic;
}

export interface AgentsConfig {
  port?: number;
  devCommand?: string;
  devArgs?: string[];
  workingDir?: string;
  suggestedWorkingDirs: string[];
  found: boolean;
  filePath?: string;
  isMonorepo: boolean;
  previewSuitable: boolean;
  suitabilityReason?: string;
}

// Stash
export interface GitStash {
  index: number;
  message: string;
  date: string;
}

// Recent Projects
export interface RecentProject {
  path: string;
  name: string;
  lastOpenedAt: string;
}

// Config Types
export type AiProvider = "anthropic" | "openai" | "gemini";
export type ThemeOption = "light" | "dark" | "ember" | "matrix" | "system";
export type TerminalOption = "Terminal" | "iTerm" | "Ghostty" | "Warp" | "kitty";
export type EditorOption = "cursor" | "antigravity" | "code" | "zed" | "custom";

export interface ConfigTab {
  id: string;
  repoPath: string;
  name: string;
}

export interface Config {
  computerName: string;
  aiProvider: AiProvider;
  aiApiKey: string;
  editor: EditorOption;
  customEditorCommand: string;
  terminal: TerminalOption;
  theme: ThemeOption;
  imageBasePath: string;
  showHiddenFiles: boolean;
  cleanShotMode: boolean;
  autoExecutePrompt: boolean;
  recentTabs: ConfigTab[];
  activeTabId: string | null;
}

export const DEFAULT_CONFIG: Config = {
  computerName: "",
  aiProvider: "anthropic",
  aiApiKey: "",
  editor: "cursor",
  customEditorCommand: "",
  terminal: "Terminal",
  theme: "dark",
  imageBasePath: "",
  showHiddenFiles: false,
  cleanShotMode: false,
  autoExecutePrompt: false,
  recentTabs: [],
  activeTabId: null,
};

// Config WebSocket Messages
export interface GetConfigResponse {
  config: Config;
}

export interface SetConfigRequest {
  config: Partial<Config>;
}

export interface SetConfigResponse {
  config: Config;
}

export interface ConfigChangedEvent {
  config: Config;
}

// Skill Types
export interface Skill {
  name: string;
  description: string;
  path: string;
}

export interface SkillsListRequest {
  type: "list-skills";
}

export interface SkillsListResponse {
  skills: Skill[];
}

// Favicon Types
export interface GetFaviconRequest {
  path: string;
}

export interface GetFaviconResponse {
  favicon: string | null;
  mimeType: string | null;
}
