use crate::git::{self, Commit, FileDiff, GitError, ProjectState, SaveResult, ShipResult, SyncResult};
use crate::watcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::process::{Command, Child, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::{AutoLaunchManager, ManagerExt};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProjectInfo {
    pub path: String,
    pub name: String,
    pub last_opened: i64,
}

pub struct AppState {
    pub current_project: Mutex<Option<String>>,
    pub recent_projects: Mutex<Vec<ProjectInfo>>,
    pub watcher_handle: Mutex<Option<watcher::WatcherHandle>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_project: Mutex::new(None),
            recent_projects: Mutex::new(Vec::new()),
            watcher_handle: Mutex::new(None),
        }
    }
}

pub fn init_state(app: &AppHandle) {
    app.manage(AppState::default());
    
    // Load recent projects from disk
    if let Some(state) = app.try_state::<AppState>() {
        let recent = load_recent_projects();
        *state.recent_projects.lock().unwrap() = recent;
    }
}

fn get_config_dir() -> Option<PathBuf> {
    dirs::config_dir().map(|p| p.join("vibogit"))
}

fn load_recent_projects() -> Vec<ProjectInfo> {
    let config_dir = match get_config_dir() {
        Some(d) => d,
        None => return vec![],
    };

    let recent_file = config_dir.join("recent_projects.json");
    if !recent_file.exists() {
        return vec![];
    }

    match std::fs::read_to_string(&recent_file) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => vec![],
    }
}

fn save_recent_projects(projects: &[ProjectInfo]) {
    let config_dir = match get_config_dir() {
        Some(d) => d,
        None => return,
    };

    let _ = std::fs::create_dir_all(&config_dir);
    let recent_file = config_dir.join("recent_projects.json");

    if let Ok(content) = serde_json::to_string_pretty(projects) {
        let _ = std::fs::write(recent_file, content);
    }
}

// Saved Projects (for sidebar) - separate from recent projects

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SavedProject {
    pub path: String,
    pub name: String,
    pub added_at: i64,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStatus {
    pub path: String,
    pub current_branch: String,
    pub uncommitted_count: i32,
    pub ahead: i32,
    pub behind: i32,
    pub is_clean: bool,
}

fn load_saved_projects() -> Vec<SavedProject> {
    let config_dir = match get_config_dir() {
        Some(d) => d,
        None => return vec![],
    };

    let saved_file = config_dir.join("saved_projects.json");
    if !saved_file.exists() {
        return vec![];
    }

    match std::fs::read_to_string(&saved_file) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => vec![],
    }
}

fn persist_saved_projects(projects: &[SavedProject]) {
    let config_dir = match get_config_dir() {
        Some(d) => d,
        None => return,
    };

    let _ = std::fs::create_dir_all(&config_dir);
    let saved_file = config_dir.join("saved_projects.json");

    if let Ok(content) = serde_json::to_string_pretty(projects) {
        let _ = std::fs::write(saved_file, content);
    }
}

#[tauri::command]
pub async fn get_saved_projects() -> Result<Vec<SavedProject>, String> {
    let projects = load_saved_projects();
    // Filter out non-existent paths
    let valid: Vec<_> = projects
        .into_iter()
        .filter(|p| std::path::Path::new(&p.path).exists())
        .collect();
    Ok(valid)
}

#[tauri::command]
pub async fn add_saved_project(path: String) -> Result<SavedProject, String> {
    // Validate it's a git repo
    let git_dir = std::path::Path::new(&path).join(".git");
    if !git_dir.exists() {
        return Err("Not a git repository".to_string());
    }

    // Get project name from path
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let project = SavedProject {
        path: path.clone(),
        name,
        added_at: chrono::Utc::now().timestamp(),
    };

    // Load existing, add new, save
    let mut projects = load_saved_projects();
    // Remove if already exists (to update timestamp)
    projects.retain(|p| p.path != path);
    projects.push(project.clone());
    persist_saved_projects(&projects);

    Ok(project)
}

#[tauri::command]
pub async fn remove_saved_project(path: String) -> Result<(), String> {
    let mut projects = load_saved_projects();
    projects.retain(|p| p.path != path);
    persist_saved_projects(&projects);
    Ok(())
}

#[tauri::command]
pub async fn reorder_saved_projects(paths: Vec<String>) -> Result<(), String> {
    let projects = load_saved_projects();
    let mut reordered: Vec<SavedProject> = Vec::new();
    
    // Reorder based on the paths array
    for path in &paths {
        if let Some(project) = projects.iter().find(|p| &p.path == path) {
            reordered.push(project.clone());
        }
    }
    
    // Add any projects that weren't in the paths array (shouldn't happen, but safety)
    for project in projects {
        if !paths.contains(&project.path) {
            reordered.push(project);
        }
    }
    
    persist_saved_projects(&reordered);
    Ok(())
}

#[tauri::command]
pub async fn get_all_project_statuses(paths: Vec<String>) -> Result<Vec<ProjectStatus>, String> {
    let mut statuses = Vec::new();
    
    for path in paths {
        let status = match git::get_status(&path) {
            Ok(state) => {
                let uncommitted = state.staged_files.len() + state.changed_files.len() + state.untracked_files.len();
                ProjectStatus {
                    path: path.clone(),
                    current_branch: state.branch,
                    uncommitted_count: uncommitted as i32,
                    ahead: state.ahead as i32,
                    behind: state.behind as i32,
                    is_clean: uncommitted == 0 && state.ahead == 0 && state.behind == 0,
                }
            }
            Err(_) => ProjectStatus {
                path: path.clone(),
                current_branch: "unknown".to_string(),
                uncommitted_count: 0,
                ahead: 0,
                behind: 0,
                is_clean: true,
            },
        };
        statuses.push(status);
    }
    
    Ok(statuses)
}

// Git Commands

#[tauri::command]
pub async fn git_status(
    path: String,
    state: State<'_, AppState>,
) -> Result<ProjectState, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::get_status(&project_path)
}

#[tauri::command]
pub async fn git_save(
    path: String,
    message: Option<String>,
    state: State<'_, AppState>,
) -> Result<SaveResult, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::save(&project_path, message)
}

#[tauri::command]
pub async fn git_ship(
    path: String,
    state: State<'_, AppState>,
) -> Result<ShipResult, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::ship(&project_path)
}

#[tauri::command]
pub async fn git_sync(
    path: String,
    state: State<'_, AppState>,
) -> Result<SyncResult, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::sync(&project_path)
}

#[tauri::command]
pub async fn git_log(
    path: String,
    limit: Option<usize>,
    state: State<'_, AppState>,
) -> Result<Vec<Commit>, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::get_log(&project_path, limit)
}

#[tauri::command]
pub async fn git_diff(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<FileDiff>, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::get_diff(&project_path)
}

// Project Commands

#[tauri::command]
pub async fn set_project(
    path: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<ProjectInfo, String> {
    // Validate it's a git repo
    git::get_status(&path).map_err(|e| e.to_string())?;

    // Stop existing watcher
    if let Some(handle) = state.watcher_handle.lock().unwrap().take() {
        handle.stop();
    }

    // Start new watcher
    let watcher_handle = watcher::start_watcher(&path, app.clone())
        .map_err(|e| e.to_string())?;
    *state.watcher_handle.lock().unwrap() = Some(watcher_handle);

    // Update current project
    *state.current_project.lock().unwrap() = Some(path.clone());

    // Get project name from path
    let name = std::path::Path::new(&path)
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_else(|| path.clone());

    let project = ProjectInfo {
        path: path.clone(),
        name,
        last_opened: chrono::Utc::now().timestamp(),
    };

    // Update recent projects
    let mut recent = state.recent_projects.lock().unwrap();
    recent.retain(|p| p.path != path);
    recent.insert(0, project.clone());
    if recent.len() > 10 {
        recent.truncate(10);
    }
    save_recent_projects(&recent);

    // Update tray
    crate::tray::update_tray_menu(&app, Some(&project));

    Ok(project)
}

#[tauri::command]
pub async fn list_recent_projects(
    state: State<'_, AppState>,
) -> Result<Vec<ProjectInfo>, String> {
    let recent = state.recent_projects.lock().unwrap().clone();
    
    // Filter out non-existent paths
    let valid: Vec<_> = recent
        .into_iter()
        .filter(|p| std::path::Path::new(&p.path).exists())
        .collect();

    Ok(valid)
}

#[tauri::command]
pub async fn is_git_repo(path: String) -> Result<bool, String> {
    let git_dir = std::path::Path::new(&path).join(".git");
    Ok(git_dir.exists())
}

#[tauri::command]
pub async fn add_project_folder(
    app: AppHandle,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    use std::sync::mpsc;

    let (tx, rx) = mpsc::channel();

    app.dialog()
        .file()
        .set_title("Select a Git Repository")
        .pick_folder(move |folder| {
            let _ = tx.send(folder.map(|p| p.to_string()));
        });

    match rx.recv() {
        Ok(Some(path)) => Ok(Some(path)),
        Ok(None) => Ok(None),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub async fn get_current_project(
    state: State<'_, AppState>,
) -> Result<Option<ProjectInfo>, String> {
    let path = state.current_project.lock().unwrap().clone();
    
    match path {
        Some(p) => {
            let name = std::path::Path::new(&p)
                .file_name()
                .map(|s| s.to_string_lossy().to_string())
                .unwrap_or_else(|| p.clone());

            Ok(Some(ProjectInfo {
                path: p,
                name,
                last_opened: chrono::Utc::now().timestamp(),
            }))
        }
        None => Ok(None),
    }
}

// Launcher Commands

#[tauri::command]
pub async fn open_in_browser(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_in_editor(path: String) -> Result<(), String> {
    // Try common editors in order of preference
    let editors = ["cursor", "code", "subl", "atom", "mate"];

    for editor in editors {
        if let Ok(status) = std::process::Command::new("which")
            .arg(editor)
            .output()
        {
            if status.status.success() {
                return std::process::Command::new(editor)
                    .arg(&path)
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string());
            }
        }
    }

    // Fallback: try to open with default app
    open::that(&path).map_err(|e| format!("No editor found: {}", e))
}

#[tauri::command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // Check for iTerm first
        let iterm_script = format!(
            r#"tell application "iTerm"
                create window with default profile
                tell current session of current window
                    write text "cd '{}'"
                end tell
            end tell"#,
            path
        );

        // Try iTerm
        let result = std::process::Command::new("osascript")
            .args(["-e", &iterm_script])
            .output();

        if result.is_ok() && result.unwrap().status.success() {
            return Ok(());
        }

        // Fallback to Terminal.app
        let terminal_script = format!(
            r#"tell application "Terminal"
                activate
                do script "cd '{}'"
            end tell"#,
            path
        );

        std::process::Command::new("osascript")
            .args(["-e", &terminal_script])
            .output()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Terminal opening only supported on macOS".to_string())
    }
}

#[tauri::command]
pub async fn open_in_finder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        open::that(&path).map_err(|e| e.to_string())
    }
}

// Autostart Commands

#[tauri::command]
pub async fn is_autostart_enabled(
    app: AppHandle,
) -> Result<bool, String> {
    let autostart = app.autolaunch();
    autostart.is_enabled().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn set_autostart(
    enabled: bool,
    app: AppHandle,
) -> Result<(), String> {
    let autostart = app.autolaunch();
    
    if enabled {
        autostart.enable().map_err(|e: tauri_plugin_autostart::Error| e.to_string())
    } else {
        autostart.disable().map_err(|e: tauri_plugin_autostart::Error| e.to_string())
    }
}

// Config Commands

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub computer_name: String,
    pub ai_provider: String,
    pub ai_api_key: String,
    pub editor: String,
    pub custom_editor_command: String,
    pub terminal: String,
    pub theme: String,
    pub image_base_path: String,
    pub show_hidden_files: bool,
    pub recent_tabs: Vec<ConfigTab>,
    pub active_tab_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ConfigTab {
    pub id: String,
    pub repo_path: String,
    pub name: String,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            computer_name: String::new(),
            ai_provider: "anthropic".to_string(),
            ai_api_key: String::new(),
            editor: "cursor".to_string(),
            custom_editor_command: String::new(),
            terminal: "Terminal".to_string(),
            theme: "dark".to_string(),
            image_base_path: String::new(),
            show_hidden_files: false,
            recent_tabs: vec![],
            active_tab_id: None,
        }
    }
}

fn get_app_config_path() -> Option<PathBuf> {
    get_config_dir().map(|p| p.join("config.json"))
}

fn load_app_config() -> AppConfig {
    if let Some(path) = get_app_config_path() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str(&content) {
                return config;
            }
        }
    }
    AppConfig::default()
}

fn save_app_config(config: &AppConfig) {
    if let Some(path) = get_app_config_path() {
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(content) = serde_json::to_string_pretty(config) {
            let _ = std::fs::write(path, content);
        }
    }
}

#[tauri::command]
pub async fn get_config() -> Result<AppConfig, String> {
    Ok(load_app_config())
}

#[tauri::command]
pub async fn set_config(config: AppConfig) -> Result<AppConfig, String> {
    save_app_config(&config);
    Ok(config)
}

// Notification Commands

#[tauri::command]
pub async fn send_notification(
    title: String,
    body: String,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    app.notification()
        .builder()
        .title(&title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn notify_save_success(
    files_count: usize,
    commit_sha: String,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    let title = "Changes Saved ⚡";
    let body = format!(
        "{} file{} committed ({})",
        files_count,
        if files_count == 1 { "" } else { "s" },
        &commit_sha[..7.min(commit_sha.len())]
    );
    
    app.notification()
        .builder()
        .title(title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn notify_ship_success(
    commits_count: usize,
    branch: String,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    let title = "Changes Shipped! 🚀";
    let body = format!(
        "{} commit{} pushed to {}",
        commits_count,
        if commits_count == 1 { "" } else { "s" },
        branch
    );
    
    app.notification()
        .builder()
        .title(title)
        .body(&body)
        .show()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

#[tauri::command]
pub async fn notify_error(
    title: String,
    message: String,
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_notification::NotificationExt;
    
    app.notification()
        .builder()
        .title(&title)
        .body(&message)
        .show()
        .map_err(|e| e.to_string())?;
    
    Ok(())
}

// Git Extended Commands

#[tauri::command]
pub async fn git_stage(
    path: String,
    files: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::stage(&project_path, &files)
}

#[tauri::command]
pub async fn git_unstage(
    path: String,
    files: Vec<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::unstage(&project_path, &files)
}

#[tauri::command]
pub async fn git_checkout(
    path: String,
    branch: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::checkout(&project_path, &branch)
}

#[tauri::command]
pub async fn git_create_branch(
    path: String,
    name: String,
    checkout: Option<bool>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::create_branch(&project_path, &name, checkout.unwrap_or(false))
}

#[tauri::command]
pub async fn git_branches(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<git::Branch>, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::get_branches(&project_path)
}

#[tauri::command]
pub async fn git_remotes(
    path: String,
    state: State<'_, AppState>,
) -> Result<Vec<git::Remote>, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::get_remotes(&project_path)
}

#[tauri::command]
pub async fn git_stash_save(
    path: String,
    message: Option<String>,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::stash_save(&project_path, message)
}

#[tauri::command]
pub async fn git_stash_pop(
    path: String,
    state: State<'_, AppState>,
) -> Result<(), GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::stash_pop(&project_path)
}

#[tauri::command]
pub async fn git_file_diff(
    path: String,
    file: String,
    staged: Option<bool>,
    state: State<'_, AppState>,
) -> Result<git::DetailedFileDiff, GitError> {
    let project_path = if path.is_empty() {
        state
            .current_project
            .lock()
            .unwrap()
            .clone()
            .ok_or_else(|| GitError::NotARepository("No project selected".to_string()))?
    } else {
        path
    };

    git::get_file_diff(&project_path, &file, staged.unwrap_or(false))
}

#[tauri::command]
pub async fn git_init(path: String) -> Result<(), GitError> {
    git::init_repo(&path)
}

// File Operations

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileNode {
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub file_type: String,
    pub children: Option<Vec<FileNode>>,
}

#[tauri::command]
pub async fn list_files(
    path: String,
    show_hidden: Option<bool>,
) -> Result<Vec<FileNode>, String> {
    let show_hidden = show_hidden.unwrap_or(false);
    build_file_tree(&path, "", show_hidden, 3)
}

fn build_file_tree(base: &str, relative: &str, show_hidden: bool, depth: usize) -> Result<Vec<FileNode>, String> {
    if depth == 0 {
        return Ok(vec![]);
    }

    let full_path = if relative.is_empty() {
        PathBuf::from(base)
    } else {
        PathBuf::from(base).join(relative)
    };

    let entries = std::fs::read_dir(&full_path).map_err(|e| e.to_string())?;
    let mut nodes = Vec::new();

    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        
        // Skip hidden files unless show_hidden is true
        if !show_hidden && name.starts_with('.') {
            continue;
        }
        
        // Skip common ignored directories
        if matches!(name.as_str(), "node_modules" | ".git" | "target" | ".next" | "dist" | ".turbo") {
            continue;
        }

        let entry_path = if relative.is_empty() {
            name.clone()
        } else {
            format!("{}/{}", relative, name)
        };

        let metadata = entry.metadata().map_err(|e| e.to_string())?;
        
        if metadata.is_dir() {
            let children = build_file_tree(base, &entry_path, show_hidden, depth - 1)?;
            nodes.push(FileNode {
                name,
                path: entry_path,
                file_type: "directory".to_string(),
                children: Some(children),
            });
        } else {
            nodes.push(FileNode {
                name,
                path: entry_path,
                file_type: "file".to_string(),
                children: None,
            });
        }
    }

    // Sort: directories first, then files, alphabetically
    nodes.sort_by(|a, b| {
        match (&a.file_type.as_str(), &b.file_type.as_str()) {
            (&"directory", &"file") => std::cmp::Ordering::Less,
            (&"file", &"directory") => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(nodes)
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReadFileResult {
    pub content: String,
    pub is_binary: bool,
}

#[tauri::command]
pub async fn read_file(
    repo_path: String,
    file_path: String,
) -> Result<ReadFileResult, String> {
    let full_path = PathBuf::from(&repo_path).join(&file_path);
    
    // Check if file exists
    if !full_path.exists() {
        return Err(format!("File not found: {}", file_path));
    }

    // Read file bytes
    let bytes = std::fs::read(&full_path).map_err(|e| e.to_string())?;
    
    // Check if binary (contains null bytes or high ratio of non-printable chars)
    let is_binary = bytes.iter().take(8000).any(|&b| b == 0) ||
        bytes.iter().take(8000).filter(|&&b| b < 32 && b != 9 && b != 10 && b != 13).count() > bytes.len().min(8000) / 10;
    
    if is_binary {
        return Ok(ReadFileResult {
            content: String::new(),
            is_binary: true,
        });
    }

    let content = String::from_utf8_lossy(&bytes).to_string();
    Ok(ReadFileResult {
        content,
        is_binary: false,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FaviconResult {
    pub favicon: Option<String>,
    pub mime_type: Option<String>,
}

#[tauri::command]
pub async fn get_favicon(path: String) -> Result<FaviconResult, String> {
    // Try to find favicon in common locations
    let favicon_paths = [
        "public/favicon.ico",
        "public/favicon.png",
        "static/favicon.ico",
        "static/favicon.png",
        "src/favicon.ico",
        "favicon.ico",
    ];

    let base = PathBuf::from(&path);
    
    for favicon_path in &favicon_paths {
        let full_path = base.join(favicon_path);
        if full_path.exists() {
            if let Ok(bytes) = std::fs::read(&full_path) {
                let mime_type = if favicon_path.ends_with(".png") {
                    "image/png"
                } else {
                    "image/x-icon"
                };
                
                let base64 = base64_encode(&bytes);
                return Ok(FaviconResult {
                    favicon: Some(base64),
                    mime_type: Some(mime_type.to_string()),
                });
            }
        }
    }

    Ok(FaviconResult {
        favicon: None,
        mime_type: None,
    })
}

fn base64_encode(data: &[u8]) -> String {
    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut result = String::new();
    
    for chunk in data.chunks(3) {
        let b0 = chunk[0] as usize;
        let b1 = chunk.get(1).copied().unwrap_or(0) as usize;
        let b2 = chunk.get(2).copied().unwrap_or(0) as usize;
        
        result.push(ALPHABET[b0 >> 2] as char);
        result.push(ALPHABET[((b0 & 0x03) << 4) | (b1 >> 4)] as char);
        
        if chunk.len() > 1 {
            result.push(ALPHABET[((b1 & 0x0f) << 2) | (b2 >> 6)] as char);
        } else {
            result.push('=');
        }
        
        if chunk.len() > 2 {
            result.push(ALPHABET[b2 & 0x3f] as char);
        } else {
            result.push('=');
        }
    }
    
    result
}

// Dev Server Commands

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub port: Option<u16>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerState {
    pub running: bool,
    pub port: Option<u16>,
    pub logs: Vec<String>,
}

pub struct DevServerProcess {
    pub child: Option<Child>,
    pub port: Option<u16>,
    pub logs: Arc<Mutex<Vec<String>>>,
}

pub struct DevServerManager {
    pub servers: Mutex<HashMap<String, DevServerProcess>>,
}

impl Default for DevServerManager {
    fn default() -> Self {
        Self {
            servers: Mutex::new(HashMap::new()),
        }
    }
}

#[tauri::command]
pub async fn dev_server_detect(path: String) -> Result<Option<DevServerConfig>, String> {
    let package_json = PathBuf::from(&path).join("package.json");
    
    if !package_json.exists() {
        return Ok(None);
    }

    let content = std::fs::read_to_string(&package_json).map_err(|e| e.to_string())?;
    let json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let package_manager = json
        .get("packageManager")
        .and_then(|pm| pm.as_str())
        .map(|pm| pm.to_lowercase());

    // Look for dev script
    if let Some(scripts) = json.get("scripts").and_then(|s| s.as_object()) {
        if let Some(dev_script) = scripts.get("dev").and_then(|s| s.as_str()) {
            // Parse the dev script
            let parts: Vec<&str> = dev_script.split_whitespace().collect();
            if !parts.is_empty() {
                // Try to detect port from script
                let port = parts.iter()
                    .position(|&p| p == "-p" || p == "--port")
                    .and_then(|i| parts.get(i + 1))
                    .and_then(|p| p.parse::<u16>().ok())
                    .or_else(|| {
                        // Check for common patterns like "next dev" -> 3000
                        if dev_script.contains("next") { Some(3000) }
                        else if dev_script.contains("vite") { Some(5173) }
                        else if dev_script.contains("remix") { Some(3000) }
                        else { Some(3000) }
                    });

                let command = if package_manager.as_deref().unwrap_or("").starts_with("pnpm") {
                    "pnpm"
                } else if package_manager.as_deref().unwrap_or("").starts_with("npm") {
                    "npm"
                } else if package_manager.as_deref().unwrap_or("").starts_with("yarn") {
                    "yarn"
                } else {
                    "bun"
                };

                let args = if command == "yarn" {
                    vec!["dev".to_string()]
                } else {
                    vec!["run".to_string(), "dev".to_string()]
                };

                return Ok(Some(DevServerConfig {
                    command: command.to_string(),
                    args,
                    port,
                }));
            }
        }
    }

    Ok(None)
}

#[tauri::command]
pub async fn dev_server_start(
    path: String,
    config: DevServerConfig,
    app: AppHandle,
) -> Result<(), String> {
    let manager = app.try_state::<DevServerManager>()
        .ok_or("DevServerManager not initialized")?;

    // Kill any existing server for this path
    {
        let mut servers = manager.servers.lock().unwrap();
        if let Some(server) = servers.get_mut(&path) {
            if let Some(ref mut child) = server.child {
                let _ = child.kill();
            }
        }
    }

    let fallback_command = if config.command == "bun" { "npm" } else { "bun" };
    let fallback_args = if fallback_command == "yarn" {
        vec!["dev".to_string()]
    } else {
        vec!["run".to_string(), "dev".to_string()]
    };

    // Start new server
    let mut command = Command::new(&config.command);
    command
        .args(&config.args)
        .current_dir(&path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set PORT env var so Next.js/Vite/etc use the correct port
    if let Some(port) = config.port {
        command.env("PORT", port.to_string());
    }

    #[cfg(target_os = "macos")]
    {
        let default_path = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin";
        let merged_path = match std::env::var("PATH") {
            Ok(path) => format!("{}:{}", path, default_path),
            Err(_) => default_path.to_string(),
        };
        command.env("PATH", merged_path);
    }

    let mut child = match command.spawn() {
        Ok(child) => child,
        Err(err) => {
            let mut fallback = Command::new(fallback_command);
            fallback
                .args(&fallback_args)
                .current_dir(&path)
                .stdout(Stdio::piped())
                .stderr(Stdio::piped());

            // Set PORT env var for fallback too
            if let Some(port) = config.port {
                fallback.env("PORT", port.to_string());
            }

            #[cfg(target_os = "macos")]
            {
                let default_path = "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin";
                let merged_path = match std::env::var("PATH") {
                    Ok(path) => format!("{}:{}", path, default_path),
                    Err(_) => default_path.to_string(),
                };
                fallback.env("PATH", merged_path);
            }

            fallback.spawn().map_err(|fallback_err| {
                format!(
                    "Failed to start dev server with '{}' ({err}). Fallback '{}' failed: {fallback_err}",
                    config.command, fallback_command
                )
            })?
        }
    };

    // Create shared log storage
    let started_command = format!("{} {}", config.command, config.args.join(" "));
    let logs: Arc<Mutex<Vec<String>>> = Arc::new(Mutex::new(vec![
        format!("[{}] > {}", chrono::Local::now().format("%H:%M:%S"), started_command)
    ]));

    // Helper to add log line with timestamp, capped at 200 lines
    fn add_log(logs: &Arc<Mutex<Vec<String>>>, line: String) {
        if let Ok(mut logs) = logs.lock() {
            let timestamped = format!("[{}] {}", chrono::Local::now().format("%H:%M:%S"), line);
            logs.push(timestamped);
            if logs.len() > 200 {
                logs.remove(0);
            }
        }
    }

    // Spawn thread to capture stdout
    if let Some(stdout) = child.stdout.take() {
        let logs_clone = Arc::clone(&logs);
        thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
                add_log(&logs_clone, line);
            }
        });
    }

    // Spawn thread to capture stderr
    if let Some(stderr) = child.stderr.take() {
        let logs_clone = Arc::clone(&logs);
        thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().map_while(Result::ok) {
                add_log(&logs_clone, line);
            }
        });
    }

    let mut servers = manager.servers.lock().unwrap();
    servers.insert(path, DevServerProcess {
        child: Some(child),
        port: config.port,
        logs,
    });

    Ok(())
}

#[tauri::command]
pub async fn dev_server_stop(
    path: String,
    app: AppHandle,
) -> Result<(), String> {
    let manager = app.try_state::<DevServerManager>()
        .ok_or("DevServerManager not initialized")?;

    let mut servers = manager.servers.lock().unwrap();
    if let Some(server) = servers.get_mut(&path) {
        if let Some(ref mut child) = server.child {
            let _ = child.kill();
        }
        server.child = None;
        if let Ok(mut logs) = server.logs.lock() {
            logs.push(format!("[{}] Server stopped", chrono::Local::now().format("%H:%M:%S")));
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn dev_server_state(
    path: String,
    app: AppHandle,
) -> Result<DevServerState, String> {
    let manager = app.try_state::<DevServerManager>()
        .ok_or("DevServerManager not initialized")?;

    let servers = manager.servers.lock().unwrap();
    
    if let Some(server) = servers.get(&path) {
        let process_alive = server.child.as_ref()
            .map(|c| {
                // Check if process is still running
                let mut cmd = Command::new("kill");
                cmd.args(["-0", &c.id().to_string()]);
                cmd.output().map(|o| o.status.success()).unwrap_or(false)
            })
            .unwrap_or(false);

        // Also check if the port is actually listening (TCP connect test)
        let port_listening = server.port
            .map(|p| {
                use std::net::TcpStream;
                use std::time::Duration;
                TcpStream::connect_timeout(
                    &format!("127.0.0.1:{}", p).parse().unwrap(),
                    Duration::from_millis(500)
                ).is_ok()
            })
            .unwrap_or(false);

        // Only report running if BOTH process is alive AND port is listening
        let running = process_alive && port_listening;

        // Get logs from Arc<Mutex<Vec<String>>>
        let logs = server.logs.lock()
            .map(|l| l.clone())
            .unwrap_or_default();

        Ok(DevServerState {
            running,
            port: server.port,
            logs,
        })
    } else {
        Ok(DevServerState {
            running: false,
            port: None,
            logs: vec![],
        })
    }
}

#[tauri::command]
pub async fn kill_port(port: u16) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("lsof")
            .args(["-ti", &format!(":{}", port)])
            .output()
            .map_err(|e| e.to_string())?;

        if output.status.success() {
            let pids = String::from_utf8_lossy(&output.stdout);
            for pid in pids.lines() {
                if !pid.is_empty() {
                    let _ = Command::new("kill")
                        .args(["-9", pid.trim()])
                        .output();
                }
            }
            // Give OS time to release the port
            std::thread::sleep(std::time::Duration::from_millis(500));
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn cleanup_dev_locks(path: String) -> Result<(), String> {
    // Remove Next.js dev lock file
    let next_lock = PathBuf::from(&path).join(".next/dev/lock");
    if next_lock.exists() {
        let _ = std::fs::remove_file(&next_lock);
    }
    // Remove Vite lock file
    let vite_lock = PathBuf::from(&path).join("node_modules/.vite/.lock");
    if vite_lock.exists() {
        let _ = std::fs::remove_file(&vite_lock);
    }
    Ok(())
}

// Agents Config Commands

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentsConfig {
    pub port: Option<u16>,
    pub dev_command: Option<String>,
    pub dev_args: Option<Vec<String>>,
    pub found: bool,
    pub file_path: Option<String>,
    pub is_monorepo: bool,
}

#[tauri::command]
pub async fn read_agents_config(repo_path: String) -> Result<AgentsConfig, String> {
    let agents_paths = ["AGENTS.md", "agents.md", ".agents.md"];
    let base = PathBuf::from(&repo_path);

    // Detect monorepo by checking for common config files
    let is_monorepo = base.join("turbo.json").exists()
        || base.join("nx.json").exists()
        || base.join("lerna.json").exists()
        || (base.join("pnpm-workspace.yaml").exists() && base.join("packages").exists());

    for agents_path in &agents_paths {
        let full_path = base.join(agents_path);
        if full_path.exists() {
            let content = std::fs::read_to_string(&full_path).map_err(|e| e.to_string())?;
            
            // Parse for port - check standard format first "- Port: 7777"
            // Then fall back to other formats
            let port = content.lines()
                .find(|l| {
                    let lower = l.to_lowercase();
                    // Standard format: "- Port: 7777" under "## Development Server"
                    lower.trim().starts_with("- port:") ||
                    lower.contains("dev server port") || 
                    (lower.contains("port") && !lower.contains("server port"))
                })
                .and_then(|l| {
                    // Extract number from line like "- Port: 7777" or "- Dev server port: 7777"
                    l.chars()
                        .filter(|c| c.is_ascii_digit())
                        .collect::<String>()
                        .parse::<u16>()
                        .ok()
                });

            // Parse for command (look for "Command": `bun run dev -- -p 7777`)
            let (dev_command, dev_args) = content.lines()
                .find(|l| l.to_lowercase().contains("command") && l.contains('`'))
                .and_then(|l| {
                    // Extract content between backticks
                    let start = l.find('`')?;
                    let end = l.rfind('`')?;
                    if end > start + 1 {
                        let cmd_str = &l[start + 1..end];
                        let parts: Vec<&str> = cmd_str.split_whitespace().collect();
                        if !parts.is_empty() {
                            let command = parts[0].to_string();
                            let args: Vec<String> = parts[1..].iter().map(|s| s.to_string()).collect();
                            return Some((Some(command), Some(args)));
                        }
                    }
                    None
                })
                .unwrap_or((None, None));

            return Ok(AgentsConfig {
                port,
                dev_command,
                dev_args,
                found: true,
                file_path: Some(full_path.to_string_lossy().to_string()),
                is_monorepo,
            });
        }
    }

    Ok(AgentsConfig {
        port: None,
        dev_command: None,
        dev_args: None,
        found: false,
        file_path: None,
        is_monorepo,
    })
}

#[tauri::command]
pub async fn write_agents_config(
    repo_path: String,
    port: u16,
) -> Result<(), String> {
    let agents_path = PathBuf::from(&repo_path).join("AGENTS.md");
    
    let content = if agents_path.exists() {
        let existing = std::fs::read_to_string(&agents_path).map_err(|e| e.to_string())?;
        
        // Check if "## Development Server" section exists
        if existing.contains("## Development Server") {
            // Update existing port in Development Server section
            let mut lines: Vec<String> = existing.lines().map(|s| s.to_string()).collect();
            let mut in_dev_section = false;
            let mut port_updated = false;
            
            for line in &mut lines {
                if line.starts_with("## Development Server") {
                    in_dev_section = true;
                } else if line.starts_with("## ") {
                    in_dev_section = false;
                }
                
                if in_dev_section && line.trim().to_lowercase().starts_with("- port:") {
                    *line = format!("- Port: {}", port);
                    port_updated = true;
                }
            }
            
            // If no port line found in section, add it after the header
            if !port_updated {
                let mut new_lines = Vec::new();
                for line in lines {
                    new_lines.push(line.clone());
                    if line.starts_with("## Development Server") {
                        new_lines.push(format!("- Port: {}", port));
                    }
                }
                new_lines.join("\n")
            } else {
                lines.join("\n")
            }
        } else {
            // Append new Development Server section
            format!("{}\n\n## Development Server\n- Port: {}\n", existing.trim_end(), port)
        }
    } else {
        // Create new AGENTS.md with standard format
        format!("# Agent Configuration\n\n## Development Server\n- Port: {}\n", port)
    };

    std::fs::write(&agents_path, content).map_err(|e| e.to_string())?;
    Ok(())
}

// Enhanced Launcher Commands

#[tauri::command]
pub async fn open_editor_with_app(
    path: String,
    app_name: Option<String>,
    editor_command: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        if let Some(app) = app_name {
            return Command::new("open")
                .args(["-a", &app, &path])
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string());
        }
        
        if let Some(cmd) = editor_command {
            return Command::new(&cmd)
                .arg(&path)
                .spawn()
                .map(|_| ())
                .map_err(|e| e.to_string());
        }
    }
    
    // Fallback to existing open_in_editor logic
    open::that(&path).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn open_terminal_with_app(
    path: String,
    terminal: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let terminal_app = terminal.unwrap_or_else(|| "Terminal".to_string());
        
        let script = match terminal_app.as_str() {
            "iTerm" => format!(
                r#"tell application "iTerm"
                    create window with default profile
                    tell current session of current window
                        write text "cd '{}'"
                    end tell
                end tell"#,
                path
            ),
            "Ghostty" | "Warp" | "kitty" => format!(
                r#"tell application "{}"
                    activate
                end tell
                delay 0.5
                tell application "System Events"
                    keystroke "cd '{}'" & return
                end tell"#,
                terminal_app, path
            ),
            _ => format!(
                r#"tell application "Terminal"
                    activate
                    do script "cd '{}'"
                end tell"#,
                path
            ),
        };

        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Terminal opening only supported on macOS".to_string())
    }
}

#[tauri::command]
pub async fn send_to_terminal(
    text: String,
    terminal: Option<String>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let terminal_app = terminal.unwrap_or_else(|| "Terminal".to_string());
        
        let script = match terminal_app.as_str() {
            "iTerm" => format!(
                r#"tell application "iTerm"
                    tell current session of current window
                        write text "{}"
                    end tell
                end tell"#,
                text.replace("\"", "\\\"")
            ),
            _ => format!(
                r#"tell application "{}"
                    activate
                end tell
                delay 0.2
                tell application "System Events"
                    keystroke "{}"
                    key code 36
                end tell"#,
                terminal_app,
                text.replace("\"", "\\\"")
            ),
        };

        Command::new("osascript")
            .args(["-e", &script])
            .output()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Send to terminal only supported on macOS".to_string())
    }
}

// Skills Commands

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: String,
}

#[tauri::command]
pub async fn list_skills() -> Result<Vec<Skill>, String> {
    // Return empty skills list for now - skills are typically handled by the daemon
    Ok(vec![])
}

// Update Commands

#[derive(Debug, Serialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: Option<String>,
    pub body: Option<String>,
}

#[tauri::command]
pub async fn check_for_updates(
    app: AppHandle,
) -> Result<UpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;
    
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            version: Some(update.version.clone()),
            body: update.body.clone(),
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            version: None,
            body: None,
        }),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub async fn install_update(
    app: AppHandle,
) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    
    let updater = app.updater().map_err(|e| e.to_string())?;
    
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        update.download_and_install(|_, _| {}, || {}).await.map_err(|e| e.to_string())?;
    }
    
    Ok(())
}
