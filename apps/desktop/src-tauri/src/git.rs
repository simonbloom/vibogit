use git2::{
    DiffOptions, Error as Git2Error, ErrorCode, Repository, Signature, StatusOptions,
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug, Serialize)]
pub enum GitError {
    #[error("Not a git repository: {0}")]
    NotARepository(String),
    #[error("Git error: {0}")]
    Git2(String),
    #[error("Nothing to commit")]
    NothingToCommit,
    #[error("No remote configured")]
    NoRemote,
    #[error("Authentication failed: {0}")]
    AuthFailed(String),
    #[error("Merge conflict detected")]
    MergeConflict,
    #[error("IO error: {0}")]
    Io(String),
}

impl From<Git2Error> for GitError {
    fn from(err: Git2Error) -> Self {
        GitError::Git2(err.message().to_string())
    }
}

impl From<std::io::Error> for GitError {
    fn from(err: std::io::Error) -> Self {
        GitError::Io(err.to_string())
    }
}

fn open_repo(repo_path: &str) -> Result<Repository, GitError> {
    match Repository::open(repo_path) {
        Ok(repo) => Ok(repo),
        Err(err) => {
            let message = err.message().to_string();
            if message.to_lowercase().contains("permission denied") {
                return Err(GitError::Io(message));
            }

            match err.code() {
                ErrorCode::NotFound => Err(GitError::NotARepository(repo_path.to_string())),
                _ => Err(GitError::Git2(message)),
            }
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectState {
    pub branch: String,
    pub is_detached: bool,
    pub changed_files: Vec<FileStatus>,
    pub staged_files: Vec<FileStatus>,
    pub untracked_files: Vec<String>,
    pub ahead: usize,
    pub behind: usize,
    pub has_remote: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub path: String,
    pub status: String, // "modified", "added", "deleted", "renamed"
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveResult {
    pub sha: String,
    pub message: String,
    pub files_committed: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ShipResult {
    pub pushed: bool,
    pub commits_pushed: usize,
    pub remote: String,
    pub branch: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub pulled: usize,
    pub pushed: usize,
    pub conflicts: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Commit {
    pub sha: String,
    pub short_sha: String,
    pub message: String,
    pub author: String,
    pub email: String,
    pub timestamp: i64,
    pub parent_shas: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub refs: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileDiff {
    pub path: String,
    pub status: String,
    pub additions: usize,
    pub deletions: usize,
    pub is_binary: bool,
    pub hunks: Vec<DiffHunk>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffHunk {
    pub header: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiffLine {
    pub content: String,
    pub line_type: String, // "add", "delete", "context"
    pub old_line: Option<u32>,
    pub new_line: Option<u32>,
}

pub fn get_status(repo_path: &str) -> Result<ProjectState, GitError> {
    let repo = open_repo(repo_path)?;

    // Get current branch
    let (branch, is_detached) = if repo.head_detached().unwrap_or(false) {
        let head = repo.head()?;
        let sha = head.peel_to_commit()?.id().to_string();
        (sha[..7].to_string(), true)
    } else {
        let head = repo.head()?;
        let branch_name = head
            .shorthand()
            .unwrap_or("unknown")
            .to_string();
        (branch_name, false)
    };

    // Get status
    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false);

    let statuses = repo.statuses(Some(&mut opts))?;

    let mut changed_files = Vec::new();
    let mut staged_files = Vec::new();
    let mut untracked_files = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let status = entry.status();

        if status.is_index_new() || status.is_index_modified() || status.is_index_deleted() {
            let status_str = if status.is_index_new() {
                "added"
            } else if status.is_index_deleted() {
                "deleted"
            } else {
                "modified"
            };
            staged_files.push(FileStatus {
                path: path.clone(),
                status: status_str.to_string(),
            });
        }

        if status.is_wt_modified() || status.is_wt_deleted() {
            let status_str = if status.is_wt_deleted() {
                "deleted"
            } else {
                "modified"
            };
            changed_files.push(FileStatus {
                path: path.clone(),
                status: status_str.to_string(),
            });
        }

        if status.is_wt_new() {
            untracked_files.push(path);
        }
    }

    // Get ahead/behind
    let (ahead, behind, has_remote) = get_ahead_behind(&repo, &branch).unwrap_or((0, 0, false));

    Ok(ProjectState {
        branch,
        is_detached,
        changed_files,
        staged_files,
        untracked_files,
        ahead,
        behind,
        has_remote,
    })
}

fn get_ahead_behind(repo: &Repository, branch: &str) -> Result<(usize, usize, bool), GitError> {
    let local = match repo.find_branch(branch, git2::BranchType::Local) {
        Ok(b) => b,
        Err(_) => return Ok((0, 0, false)),
    };

    let upstream = match local.upstream() {
        Ok(u) => u,
        Err(_) => return Ok((0, 0, false)),
    };

    let local_oid = local.get().peel_to_commit()?.id();
    let upstream_oid = upstream.get().peel_to_commit()?.id();

    let (ahead, behind) = repo.graph_ahead_behind(local_oid, upstream_oid)?;

    Ok((ahead, behind, true))
}

pub fn save(repo_path: &str, message: Option<String>) -> Result<SaveResult, GitError> {
    let repo = open_repo(repo_path)?;

    // Stage all changes
    let mut index = repo.index()?;
    index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    index.write()?;

    // Check if there's anything to commit
    let tree_id = index.write_tree()?;
    let tree = repo.find_tree(tree_id)?;

    let parent_commit = match repo.head() {
        Ok(head) => Some(head.peel_to_commit()?),
        Err(_) => None,
    };

    // Get signature
    let sig = repo.signature().unwrap_or_else(|_| {
        Signature::now("ViboGit User", "user@vibogit.app").unwrap()
    });

    // Generate message if not provided
    let commit_message = message.unwrap_or_else(|| {
        let status = get_status(repo_path).unwrap_or_else(|_| ProjectState {
            branch: "unknown".to_string(),
            is_detached: false,
            changed_files: vec![],
            staged_files: vec![],
            untracked_files: vec![],
            ahead: 0,
            behind: 0,
            has_remote: false,
        });

        let total_files = status.staged_files.len() + status.changed_files.len() + status.untracked_files.len();
        format!("Update {} file{}", total_files, if total_files == 1 { "" } else { "s" })
    });

    let parents: Vec<&git2::Commit> = parent_commit.iter().collect();
    
    if parents.is_empty() {
        // Initial commit
        let oid = repo.commit(Some("HEAD"), &sig, &sig, &commit_message, &tree, &[])?;
        return Ok(SaveResult {
            sha: oid.to_string(),
            message: commit_message,
            files_committed: 1,
        });
    }

    // Check if tree is same as parent (nothing to commit)
    if tree.id() == parents[0].tree()?.id() {
        return Err(GitError::NothingToCommit);
    }

    let oid = repo.commit(Some("HEAD"), &sig, &sig, &commit_message, &tree, &parents)?;

    // Count committed files
    let files_committed = index.len();

    Ok(SaveResult {
        sha: oid.to_string(),
        message: commit_message,
        files_committed,
    })
}

pub fn ship(repo_path: &str) -> Result<ShipResult, GitError> {
    let repo = open_repo(repo_path)?;

    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("main").to_string();

    // Verify origin remote exists
    let _remote = repo.find_remote("origin").map_err(|_| GitError::NoRemote)?;
    
    // Use git CLI for push - it has proper credential helper support
    eprintln!("Pushing via git CLI: origin/{}", branch_name);
    
    let output = std::process::Command::new("git")
        .args(["push", "origin", &branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| GitError::Io(format!("Failed to run git push: {}", e)))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("Git push failed: {}", stderr);
        return Err(GitError::AuthFailed(stderr.trim().to_string()));
    }

    Ok(ShipResult {
        pushed: true,
        commits_pushed: 1,
        remote: "origin".to_string(),
        branch: branch_name,
    })
}

pub fn sync(repo_path: &str) -> Result<SyncResult, GitError> {
    let repo = open_repo(repo_path)?;

    let head = repo.head()?;
    let branch_name = head.shorthand().unwrap_or("main").to_string();

    // Verify origin remote exists
    let _remote = repo.find_remote("origin").map_err(|_| GitError::NoRemote)?;
    
    // Use git CLI for pull - it has proper credential helper support
    eprintln!("Pulling via git CLI: origin/{}", branch_name);
    
    let output = std::process::Command::new("git")
        .args(["pull", "--ff-only", "origin", &branch_name])
        .current_dir(repo_path)
        .output()
        .map_err(|e| GitError::Io(format!("Failed to run git pull: {}", e)))?;
    
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("Git pull failed: {}", stderr);
        // Check for merge conflict
        if stderr.contains("conflict") || stderr.contains("CONFLICT") {
            return Err(GitError::MergeConflict);
        }
        return Err(GitError::AuthFailed(stderr.trim().to_string()));
    }
    
    let stdout = String::from_utf8_lossy(&output.stdout);
    let pulled = if stdout.contains("Already up to date") { 0 } else { 1 };

    Ok(SyncResult {
        pulled,
        pushed: 0,
        conflicts: false,
    })
}

pub fn fetch(repo_path: &str) -> Result<(), GitError> {
    let repo = open_repo(repo_path)?;

    // Verify origin remote exists
    let _remote = repo.find_remote("origin").map_err(|_| GitError::NoRemote)?;

    let output = std::process::Command::new("git")
        .args(["fetch", "origin"])
        .current_dir(repo_path)
        .output()
        .map_err(|e| GitError::Io(format!("Failed to run git fetch: {}", e)))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        eprintln!("Git fetch failed: {}", stderr);
        return Err(GitError::AuthFailed(stderr.trim().to_string()));
    }

    Ok(())
}

pub fn get_log(repo_path: &str, limit: Option<usize>) -> Result<Vec<Commit>, GitError> {
    let repo = open_repo(repo_path)?;

    // Build a map of OID -> list of ref names for decoration
    let mut ref_map: std::collections::HashMap<git2::Oid, Vec<String>> = std::collections::HashMap::new();
    if let Ok(refs) = repo.references() {
        for reference in refs.flatten() {
            if let Some(name) = reference.shorthand() {
                if let Ok(target) = reference.peel_to_commit() {
                    ref_map.entry(target.id()).or_default().push(name.to_string());
                }
            }
        }
    }
    // Add HEAD decoration
    if let Ok(head) = repo.head() {
        if let Ok(target) = head.peel_to_commit() {
            let entry = ref_map.entry(target.id()).or_default();
            if let Some(name) = head.shorthand() {
                let head_label = format!("HEAD -> {}", name);
                if !entry.iter().any(|r| r.starts_with("HEAD")) {
                    entry.insert(0, head_label);
                }
            }
        }
    }

    let mut revwalk = repo.revwalk()?;
    revwalk.set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)?;
    revwalk.push_head()?;
    for branch in repo.branches(None)? {
        let (branch, _) = branch?;
        if let Some(target) = branch.get().target() {
            let _ = revwalk.push(target);
        }
    }

    let limit = limit.unwrap_or(50);
    let mut commits = Vec::new();

    for (i, oid) in revwalk.enumerate() {
        if i >= limit {
            break;
        }

        let oid = oid?;
        let commit = repo.find_commit(oid)?;

        let parent_shas: Vec<String> = commit
            .parents()
            .map(|p| p.id().to_string())
            .collect();

        let refs = ref_map.get(&oid).cloned();

        commits.push(Commit {
            sha: commit.id().to_string(),
            short_sha: commit.id().to_string()[..7].to_string(),
            message: commit.message().unwrap_or("").to_string(),
            author: commit.author().name().unwrap_or("Unknown").to_string(),
            email: commit.author().email().unwrap_or("").to_string(),
            timestamp: commit.time().seconds(),
            parent_shas,
            refs,
        });
    }

    Ok(commits)
}

pub fn get_diff(repo_path: &str) -> Result<Vec<FileDiff>, GitError> {
    let repo = open_repo(repo_path)?;

    let head = repo.head()?.peel_to_tree()?;
    
    let mut opts = DiffOptions::new();
    opts.include_untracked(true);

    let diff = repo.diff_tree_to_workdir_with_index(Some(&head), Some(&mut opts))?;

    let stats = diff.stats()?;
    let mut file_diffs = Vec::new();

    for i in 0..diff.deltas().len() {
        if let Some(delta) = diff.get_delta(i) {
            let path = delta
                .new_file()
                .path()
                .or_else(|| delta.old_file().path())
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default();

            let status = match delta.status() {
                git2::Delta::Added => "added",
                git2::Delta::Deleted => "deleted",
                git2::Delta::Modified => "modified",
                git2::Delta::Renamed => "renamed",
                _ => "unknown",
            };

            let is_binary = delta.new_file().is_binary() || delta.old_file().is_binary();

            file_diffs.push(FileDiff {
                path,
                status: status.to_string(),
                additions: 0,
                deletions: 0,
                is_binary,
                hunks: vec![],
            });
        }
    }

    // Get overall stats (simplified - doesn't attribute to individual files)
    if !file_diffs.is_empty() {
        let total_adds = stats.insertions();
        let total_dels = stats.deletions();
        let per_file_adds = total_adds / file_diffs.len();
        let per_file_dels = total_dels / file_diffs.len();
        
        for fd in &mut file_diffs {
            fd.additions = per_file_adds;
            fd.deletions = per_file_dels;
        }
    }

    Ok(file_diffs)
}

// Extended Git Types

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Branch {
    pub name: String,
    pub current: bool,
    pub remote: Option<String>,
    pub tracking: Option<String>,
    pub ahead: Option<usize>,
    pub behind: Option<usize>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Remote {
    pub name: String,
    pub refs: RemoteRefs,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct RemoteRefs {
    pub fetch: String,
    pub push: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedFileDiff {
    pub path: String,
    pub hunks: Vec<DetailedDiffHunk>,
    pub old_path: Option<String>,
    pub is_binary: bool,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedDiffHunk {
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub lines: Vec<DetailedDiffLine>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DetailedDiffLine {
    #[serde(rename = "type")]
    pub line_type: String,
    pub content: String,
    pub old_line_number: Option<u32>,
    pub new_line_number: Option<u32>,
}

// Extended Git Operations

pub fn stage(repo_path: &str, files: &[String]) -> Result<(), GitError> {
    let repo = open_repo(repo_path)?;

    let mut index = repo.index()?;
    
    // Handle "*" as stage all
    if files.len() == 1 && files[0] == "*" {
        index.add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)?;
    } else {
        for file in files {
            index.add_path(Path::new(file))?;
        }
    }
    
    index.write()?;
    Ok(())
}

pub fn unstage(repo_path: &str, files: &[String]) -> Result<(), GitError> {
    let repo = open_repo(repo_path)?;

    let head = repo.head()?.peel_to_commit()?;
    let paths: Vec<&Path> = files.iter().map(|f| Path::new(f.as_str())).collect();
    
    repo.reset_default(Some(&head.into_object()), &paths)?;

    Ok(())
}

pub fn checkout(repo_path: &str, branch_or_ref: &str) -> Result<(), GitError> {
    let repo = open_repo(repo_path)?;

    // Try as branch first
    if let Ok(branch) = repo.find_branch(branch_or_ref, git2::BranchType::Local) {
        let refname = branch.get().name().ok_or_else(|| GitError::Git2("Invalid branch name".to_string()))?;
        repo.set_head(refname)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        return Ok(());
    }

    // Try as commit SHA
    if let Ok(oid) = git2::Oid::from_str(branch_or_ref) {
        repo.find_commit(oid)?;
        repo.set_head_detached(oid)?;
        repo.checkout_head(Some(git2::build::CheckoutBuilder::default().force()))?;
        return Ok(());
    }

    Err(GitError::Git2(format!("Could not find branch or commit: {}", branch_or_ref)))
}

pub fn create_branch(repo_path: &str, name: &str, checkout_after: bool) -> Result<(), GitError> {
    let repo = open_repo(repo_path)?;

    let head = repo.head()?.peel_to_commit()?;
    repo.branch(name, &head, false)?;

    if checkout_after {
        checkout(repo_path, name)?;
    }

    Ok(())
}

pub fn get_branches(repo_path: &str) -> Result<Vec<Branch>, GitError> {
    let repo = open_repo(repo_path)?;

    let mut branches = Vec::new();
    let head = repo.head().ok();
    let head_name = head.as_ref().and_then(|h| h.shorthand()).map(|s| s.to_string());

    // Local branches
    for branch_result in repo.branches(Some(git2::BranchType::Local))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        let current = head_name.as_ref().map(|h| h == &name).unwrap_or(false);
        
        let (ahead, behind, tracking) = if let Ok(upstream) = branch.upstream() {
            let upstream_name = upstream.name()?.map(|s| s.to_string());
            let local_oid = branch.get().peel_to_commit()?.id();
            let upstream_oid = upstream.get().peel_to_commit()?.id();
            let (a, b) = repo.graph_ahead_behind(local_oid, upstream_oid).unwrap_or((0, 0));
            (Some(a), Some(b), upstream_name)
        } else {
            (None, None, None)
        };

        branches.push(Branch {
            name,
            current,
            remote: None,
            tracking,
            ahead,
            behind,
        });
    }

    // Remote branches
    for branch_result in repo.branches(Some(git2::BranchType::Remote))? {
        let (branch, _) = branch_result?;
        let name = branch.name()?.unwrap_or("").to_string();
        
        branches.push(Branch {
            name: name.clone(),
            current: false,
            remote: Some(name.split('/').next().unwrap_or("origin").to_string()),
            tracking: None,
            ahead: None,
            behind: None,
        });
    }

    Ok(branches)
}

pub fn get_remotes(repo_path: &str) -> Result<Vec<Remote>, GitError> {
    let repo = open_repo(repo_path)?;

    let mut remotes = Vec::new();
    
    for remote_name in repo.remotes()?.iter().flatten() {
        if let Ok(remote) = repo.find_remote(remote_name) {
            let fetch_url = remote.url().unwrap_or("").to_string();
            let push_url = remote.pushurl().unwrap_or(remote.url().unwrap_or("")).to_string();
            
            remotes.push(Remote {
                name: remote_name.to_string(),
                refs: RemoteRefs {
                    fetch: fetch_url,
                    push: push_url,
                },
            });
        }
    }

    Ok(remotes)
}

pub fn stash_save(repo_path: &str, message: Option<String>) -> Result<(), GitError> {
    let mut repo = open_repo(repo_path)?;

    let sig = repo.signature().unwrap_or_else(|_| {
        Signature::now("ViboGit User", "user@vibogit.app").unwrap()
    });

    let msg = message.as_deref();
    repo.stash_save(&sig, msg.unwrap_or("WIP"), None)?;

    Ok(())
}

pub fn stash_pop(repo_path: &str) -> Result<(), GitError> {
    let mut repo = open_repo(repo_path)?;

    repo.stash_pop(0, None)?;

    Ok(())
}

pub fn get_file_diff(repo_path: &str, file_path: &str, staged: bool) -> Result<DetailedFileDiff, GitError> {
    let repo = open_repo(repo_path)?;

    let mut opts = DiffOptions::new();
    opts.pathspec(file_path);

    let diff = if staged {
        let head = repo.head()?.peel_to_tree()?;
        repo.diff_tree_to_index(Some(&head), None, Some(&mut opts))?
    } else {
        let head = repo.head()?.peel_to_tree()?;
        repo.diff_tree_to_workdir_with_index(Some(&head), Some(&mut opts))?
    };

    let mut result = DetailedFileDiff {
        path: file_path.to_string(),
        hunks: vec![],
        old_path: None,
        is_binary: false,
    };

    diff.print(git2::DiffFormat::Patch, |delta, hunk, line| {
        // Check binary
        if delta.new_file().is_binary() || delta.old_file().is_binary() {
            result.is_binary = true;
            return true;
        }

        // Check for old path (rename)
        if let Some(old_path) = delta.old_file().path() {
            let old_str = old_path.to_string_lossy().to_string();
            if old_str != file_path {
                result.old_path = Some(old_str);
            }
        }

        if let Some(hunk_info) = hunk {
            // Find or create hunk
            let existing_hunk = result.hunks.iter_mut()
                .find(|h| h.old_start == hunk_info.old_start() && h.new_start == hunk_info.new_start());

            let current_hunk = if let Some(h) = existing_hunk {
                h
            } else {
                result.hunks.push(DetailedDiffHunk {
                    old_start: hunk_info.old_start(),
                    old_lines: hunk_info.old_lines(),
                    new_start: hunk_info.new_start(),
                    new_lines: hunk_info.new_lines(),
                    lines: vec![],
                });
                result.hunks.last_mut().unwrap()
            };

            let line_type = match line.origin() {
                '+' => "add",
                '-' => "delete",
                _ => "context",
            };

            let content = String::from_utf8_lossy(line.content()).to_string();

            current_hunk.lines.push(DetailedDiffLine {
                line_type: line_type.to_string(),
                content,
                old_line_number: line.old_lineno(),
                new_line_number: line.new_lineno(),
            });
        }

        true
    })?;

    Ok(result)
}

pub fn init_repo(path: &str) -> Result<(), GitError> {
    Repository::init(path)?;
    Ok(())
}
