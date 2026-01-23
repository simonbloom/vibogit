import simpleGit, { type SimpleGit, type StatusResult, type BranchSummary } from "simple-git";
import type {
  GitStatus,
  GitFile,
  GitBranch,
  GitCommit,
  GitDiff,
  DiffHunk,
  DiffLine,
  FileStatus,
  GitStash,
} from "./types";

export class GitService {
  private getGit(repoPath: string): SimpleGit {
    return simpleGit(repoPath);
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    const git = this.getGit(repoPath);
    const status: StatusResult = await git.status();
    const branchStatus = await this.getBranchStatus(git);

    const staged: GitFile[] = [];
    const unstaged: GitFile[] = [];
    const untracked: GitFile[] = [];

    // Process staged files
    for (const file of status.staged) {
      staged.push({
        path: file,
        status: this.getFileStatus(status, file, true),
        staged: true,
      });
    }

    // Process modified (unstaged) files
    for (const file of status.modified) {
      if (!status.staged.includes(file)) {
        unstaged.push({
          path: file,
          status: "modified",
          staged: false,
        });
      }
    }

    // Process deleted files
    for (const file of status.deleted) {
      if (!status.staged.includes(file)) {
        unstaged.push({
          path: file,
          status: "deleted",
          staged: false,
        });
      }
    }

    // Process untracked files
    for (const file of status.not_added) {
      untracked.push({
        path: file,
        status: "untracked",
        staged: false,
      });
    }

    return {
      branch: status.current || "HEAD",
      ahead: branchStatus.ahead,
      behind: branchStatus.behind,
      staged,
      unstaged,
      untracked,
    };
  }

  private async getBranchStatus(git: SimpleGit): Promise<{ ahead: number; behind: number }> {
    try {
      const status = await git.status();
      return {
        ahead: status.ahead,
        behind: status.behind,
      };
    } catch {
      return { ahead: 0, behind: 0 };
    }
  }

  private getFileStatus(status: StatusResult, file: string, staged: boolean): FileStatus {
    if (staged) {
      if (status.created.includes(file)) return "added";
      if (status.deleted.includes(file)) return "deleted";
      if (status.renamed.some((r) => r.to === file)) return "renamed";
    }
    if (status.modified.includes(file)) return "modified";
    if (status.deleted.includes(file)) return "deleted";
    if (status.not_added.includes(file)) return "untracked";
    return "modified";
  }

  async stage(repoPath: string, files: string[]): Promise<void> {
    const git = this.getGit(repoPath);
    await git.add(files);
  }

  async unstage(repoPath: string, files: string[]): Promise<void> {
    const git = this.getGit(repoPath);
    await git.reset(["HEAD", "--", ...files]);
  }

  async commit(repoPath: string, message: string): Promise<{ hash: string; message: string }> {
    const git = this.getGit(repoPath);
    const result = await git.commit(message);
    return {
      hash: result.commit,
      message,
    };
  }

  async push(
    repoPath: string,
    remote: string = "origin",
    branch?: string,
    force: boolean = false
  ): Promise<void> {
    const git = this.getGit(repoPath);
    if (force) {
      if (branch) {
        await git.raw(["push", "--force", remote, branch]);
      } else {
        await git.raw(["push", "--force", remote]);
      }
    } else {
      if (branch) {
        await git.push(remote, branch);
      } else {
        await git.push(remote);
      }
    }
  }

  async pull(repoPath: string, remote: string = "origin", branch?: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.pull(remote, branch);
  }

  async fetch(
    repoPath: string,
    remote: string = "origin",
    prune: boolean = false
  ): Promise<void> {
    const git = this.getGit(repoPath);
    if (prune) {
      await git.fetch(remote, ["--prune"]);
    } else {
      await git.fetch(remote);
    }
  }

  async getBranches(repoPath: string): Promise<GitBranch[]> {
    const git = this.getGit(repoPath);
    const summary: BranchSummary = await git.branch(["-a", "-v"]);
    const branches: GitBranch[] = [];

    for (const [name, data] of Object.entries(summary.branches)) {
      branches.push({
        name: name.replace(/^remotes\//, ""),
        current: data.current,
        remote: name.startsWith("remotes/") ? name.split("/")[1] : undefined,
      });
    }

    return branches;
  }

  async checkout(repoPath: string, branch: string): Promise<void> {
    const git = this.getGit(repoPath);
    await git.checkout(branch);
  }

  async createBranch(
    repoPath: string,
    name: string,
    checkout: boolean = true
  ): Promise<void> {
    const git = this.getGit(repoPath);
    if (checkout) {
      await git.checkoutLocalBranch(name);
    } else {
      await git.branch([name]);
    }
  }

  async getDiff(repoPath: string, file: string, staged: boolean = false): Promise<GitDiff> {
    const git = this.getGit(repoPath);
    const args = staged ? ["--cached", "--", file] : ["--", file];
    const diffOutput = await git.diff(args);

    return this.parseDiff(file, diffOutput);
  }

  private parseDiff(file: string, diffOutput: string): GitDiff {
    const hunks: DiffHunk[] = [];
    const lines = diffOutput.split("\n");
    let currentHunk: DiffHunk | null = null;
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);

      if (hunkMatch) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        oldLineNum = parseInt(hunkMatch[1], 10);
        newLineNum = parseInt(hunkMatch[3], 10);
        currentHunk = {
          oldStart: oldLineNum,
          oldLines: parseInt(hunkMatch[2] || "1", 10),
          newStart: newLineNum,
          newLines: parseInt(hunkMatch[4] || "1", 10),
          lines: [],
        };
      } else if (currentHunk) {
        if (line.startsWith("+")) {
          const diffLine: DiffLine = {
            type: "add",
            content: line.substring(1),
            newLineNumber: newLineNum++,
          };
          currentHunk.lines.push(diffLine);
        } else if (line.startsWith("-")) {
          const diffLine: DiffLine = {
            type: "delete",
            content: line.substring(1),
            oldLineNumber: oldLineNum++,
          };
          currentHunk.lines.push(diffLine);
        } else if (line.startsWith(" ")) {
          const diffLine: DiffLine = {
            type: "context",
            content: line.substring(1),
            oldLineNumber: oldLineNum++,
            newLineNumber: newLineNum++,
          };
          currentHunk.lines.push(diffLine);
        }
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    return {
      path: file,
      hunks,
      isBinary: diffOutput.includes("Binary files"),
    };
  }

  async getLog(
    repoPath: string,
    limit: number = 50,
    branch?: string
  ): Promise<GitCommit[]> {
    const git = this.getGit(repoPath);
    const options = {
      maxCount: limit,
      format: {
        hash: "%H",
        hashShort: "%h",
        message: "%s",
        author: "%an",
        email: "%ae",
        date: "%ai",
        refs: "%D",
      },
    };

    const log = await git.log(branch ? { ...options, from: branch } : options);

    return log.all.map((entry) => {
      const e = entry as unknown as {
        hash: string;
        hashShort: string;
        message: string;
        author: string;
        email: string;
        date: string;
        refs: string;
      };
      return {
        hash: e.hash,
        hashShort: e.hashShort || e.hash.substring(0, 7),
        message: e.message,
        author: e.author,
        email: e.email,
        date: e.date,
        refs: e.refs ? e.refs.split(", ").filter(Boolean) : undefined,
      };
    });
  }

  async stashList(repoPath: string): Promise<GitStash[]> {
    const git = this.getGit(repoPath);
    const result = await git.stashList();

    return result.all.map((entry, index) => ({
      index,
      message: entry.message,
      date: entry.date,
    }));
  }

  async stashSave(repoPath: string, message?: string): Promise<void> {
    const git = this.getGit(repoPath);
    if (message) {
      await git.stash(["push", "-m", message]);
    } else {
      await git.stash(["push"]);
    }
  }

  async stashPop(repoPath: string, index?: number): Promise<void> {
    const git = this.getGit(repoPath);
    if (index !== undefined) {
      await git.stash(["pop", `stash@{${index}}`]);
    } else {
      await git.stash(["pop"]);
    }
  }

  async stashDrop(repoPath: string, index?: number): Promise<void> {
    const git = this.getGit(repoPath);
    if (index !== undefined) {
      await git.stash(["drop", `stash@{${index}}`]);
    } else {
      await git.stash(["drop"]);
    }
  }
}
