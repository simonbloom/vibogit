// WebSocket Message Types
export type MessageType =
  | "connect"
  | "disconnect"
  | "status"
  | "stage"
  | "stageAll"
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
  | "configChanged";

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
}

export interface DevServerState {
  running: boolean;
  port?: number;
  logs: string[];
}

// Stash
export interface GitStash {
  index: number;
  message: string;
  date: string;
}
