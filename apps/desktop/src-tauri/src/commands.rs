use crate::git::{self, Commit, FileDiff, GitError, ProjectState, SaveResult, ShipResult, SyncResult};
use crate::watcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::process::{Command, Child, Stdio};
use std::io::{BufRead, BufReader};
use std::thread;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_autostart::ManagerExt;

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
pub async fn git_fetch(
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

    git::fetch(&project_path)
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
                activate
                if (count of windows) = 0 then
                    create window with default profile
                    tell current session of current window
                        write text "cd '{}'"
                    end tell
                else
                    tell current window
                        create tab with default profile
                        tell current session
                            write text "cd '{}'"
                        end tell
                    end tell
                end if
            end tell"#,
            path, path
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
            end tell
            delay 0.3
            tell application "System Events" to keystroke "t" using command down
            delay 0.3
            tell application "Terminal"
                do script "cd '{}'" in front window
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
    pub clean_shot_mode: bool,
    #[serde(default)]
    pub auto_execute_prompt: bool,
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
            clean_shot_mode: false,
            auto_execute_prompt: false,
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
    const MAX_FILE_SIZE: u64 = 512 * 1024; // 512KB

    let favicon_paths = [
        // Favicons (highest priority)
        "public/favicon.ico",
        "public/favicon.png",
        "static/favicon.ico",
        "static/favicon.png",
        "src/favicon.ico",
        "favicon.ico",
        // Logo files
        "logo.png",
        "logo.svg",
        "icon.png",
        "public/logo.png",
        "public/logo.svg",
        "public/icon.png",
        "assets/logo.png",
        "assets/icon.png",
    ];

    let base = PathBuf::from(&path);
    
    for favicon_path in &favicon_paths {
        let full_path = base.join(favicon_path);
        if full_path.exists() {
            if let Ok(meta) = std::fs::metadata(&full_path) {
                if meta.len() > MAX_FILE_SIZE {
                    continue;
                }
            }
            if let Ok(bytes) = std::fs::read(&full_path) {
                let mime_type = if favicon_path.ends_with(".png") {
                    "image/png"
                } else if favicon_path.ends_with(".svg") {
                    "image/svg+xml"
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

const DIAGNOSTIC_PREFIX: &str = "DEV_SERVER_DIAGNOSTIC::";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum DevServerReasonCode {
    MonorepoWrongCwd,
    PortMismatch,
    StartupTimeout,
    CommandFailed,
    ProtocolMismatch,
    NotPreviewable,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerDiagnostic {
    pub reason_code: DevServerReasonCode,
    pub message: String,
    pub expected_port: Option<u16>,
    pub observed_port: Option<u16>,
    pub command: Option<String>,
    pub cwd: Option<String>,
    pub suggested_cwd: Option<String>,
    pub url_attempts: Vec<String>,
    pub preferred_url: Option<String>,
    pub logs_tail: Vec<String>,
}

fn diagnostic_error(diagnostic: DevServerDiagnostic) -> String {
    match serde_json::to_string(&diagnostic) {
        Ok(serialized) => format!("{}{}", DIAGNOSTIC_PREFIX, serialized),
        Err(_) => diagnostic.message,
    }
}

fn parse_command_line(command: &str) -> Option<(String, Vec<String>)> {
    let parts: Vec<&str> = command.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }
    Some((
        parts[0].to_string(),
        parts[1..].iter().map(|s| s.to_string()).collect(),
    ))
}

fn default_dev_args_for_manager(manager: &str) -> Vec<String> {
    if manager == "yarn" {
        vec!["dev".to_string()]
    } else {
        vec!["run".to_string(), "dev".to_string()]
    }
}

fn normalize_package_manager(raw: &str) -> Option<String> {
    let pm = raw.to_lowercase();
    if pm.starts_with("pnpm") {
        Some("pnpm".to_string())
    } else if pm.starts_with("npm") {
        Some("npm".to_string())
    } else if pm.starts_with("yarn") {
        Some("yarn".to_string())
    } else if pm.starts_with("bun") {
        Some("bun".to_string())
    } else {
        None
    }
}

fn detect_port_from_text(line: &str) -> Option<u16> {
    let mut current = String::new();
    for c in line.chars() {
        if c.is_ascii_digit() {
            current.push(c);
        } else {
            if current.len() >= 2 {
                if let Ok(port) = current.parse::<u16>() {
                    if port > 0 {
                        return Some(port);
                    }
                }
            }
            current.clear();
        }
    }

    if current.len() >= 2 {
        if let Ok(port) = current.parse::<u16>() {
            if port > 0 {
                return Some(port);
            }
        }
    }

    None
}

fn detect_port_from_logs(logs: &[String]) -> Option<u16> {
    logs.iter().rev().find_map(|line| {
        if line.contains("localhost:")
            || line.contains("127.0.0.1:")
            || line.to_lowercase().contains("port")
        {
            detect_port_from_text(line)
        } else {
            None
        }
    })
}

fn detect_preferred_url_from_logs(logs: &[String], fallback_port: Option<u16>) -> Option<String> {
    for line in logs.iter().rev() {
        if let Some(idx) = line.find("http://") {
            let candidate = line[idx..].split_whitespace().next().unwrap_or_default();
            if !candidate.is_empty() {
                return Some(candidate.trim_end_matches([')', '.', ',']).to_string());
            }
        }
        if let Some(idx) = line.find("https://") {
            let candidate = line[idx..].split_whitespace().next().unwrap_or_default();
            if !candidate.is_empty() {
                return Some(candidate.trim_end_matches([')', '.', ',']).to_string());
            }
        }
    }

    fallback_port.map(|port| format!("http://localhost:{}", port))
}

fn probe_port(host: &str, port: u16) -> bool {
    use std::net::{TcpStream, ToSocketAddrs};
    use std::time::Duration;

    let endpoint = if host.contains(':') {
        format!("[{}]:{}", host, port)
    } else {
        format!("{}:{}", host, port)
    };

    if let Ok(addrs) = endpoint.to_socket_addrs() {
        for addr in addrs {
            if TcpStream::connect_timeout(&addr, Duration::from_millis(350)).is_ok() {
                return true;
            }
        }
    }

    false
}

fn collect_url_attempts(port: Option<u16>) -> Vec<String> {
    let mut attempts = Vec::new();
    if let Some(p) = port {
        attempts.push(format!("http://localhost:{}", p));
        attempts.push(format!("http://127.0.0.1:{}", p));
        attempts.push(format!("http://[::1]:{}", p));
        attempts.push(format!("https://localhost:{}", p));
        attempts.push(format!("https://127.0.0.1:{}", p));
        attempts.push(format!("https://[::1]:{}", p));
    }
    attempts
}

fn logs_tail(logs: &[String], limit: usize) -> Vec<String> {
    let start = logs.len().saturating_sub(limit);
    logs[start..].to_vec()
}

fn detect_package_manager(json: &serde_json::Value) -> Option<String> {
    json.get("packageManager")
        .and_then(|pm| pm.as_str())
        .and_then(normalize_package_manager)
}

fn infer_package_manager_for_path(path: &Path) -> Option<String> {
    let mut current = Some(path.to_path_buf());

    while let Some(dir) = current {
        let package_json = dir.join("package.json");
        if package_json.exists() {
            if let Ok(content) = std::fs::read_to_string(&package_json) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(manager) = detect_package_manager(&json) {
                        return Some(manager);
                    }
                }
            }
        }

        if dir.join("bun.lockb").exists() || dir.join("bun.lock").exists() {
            return Some("bun".to_string());
        }
        if dir.join("pnpm-lock.yaml").exists() || dir.join("pnpm-workspace.yaml").exists() {
            return Some("pnpm".to_string());
        }
        if dir.join("yarn.lock").exists() {
            return Some("yarn".to_string());
        }
        if dir.join("package-lock.json").exists() || dir.join("npm-shrinkwrap.json").exists() {
            return Some("npm".to_string());
        }

        current = dir.parent().map(|parent| parent.to_path_buf());
    }

    None
}

fn script_has_web_hint(script: &str, json: &serde_json::Value) -> bool {
    let script_lower = script.to_lowercase();
    if ["next", "vite", "webpack", "nuxt", "astro", "react-scripts", "svelte"].iter().any(|hint| script_lower.contains(hint)) {
        return true;
    }

    let dependency_sections = ["dependencies", "devDependencies", "peerDependencies"];
    dependency_sections.iter().any(|key| {
        json.get(*key)
            .and_then(|v| v.as_object())
            .map(|deps| {
                ["next", "react", "react-dom", "vite", "@vitejs/plugin-react", "svelte", "vue", "nuxt", "astro"].iter().any(|dep| deps.contains_key(*dep))
            })
            .unwrap_or(false)
    })
}

fn discover_workspace_package_json(base: &Path) -> Vec<PathBuf> {
    let mut matches = Vec::new();

    let root_pkg = base.join("package.json");
    if root_pkg.exists() {
        matches.push(root_pkg);
    }

    for top in ["apps", "packages"] {
        let top_path = base.join(top);
        if !top_path.exists() {
            continue;
        }

        if let Ok(entries) = std::fs::read_dir(&top_path) {
            for entry in entries.flatten() {
                let path = entry.path();
                if !path.is_dir() {
                    continue;
                }

                let package_json = path.join("package.json");
                if package_json.exists() {
                    matches.push(package_json);
                }

                if let Ok(inner_entries) = std::fs::read_dir(&path) {
                    for inner in inner_entries.flatten() {
                        let inner_path = inner.path();
                        if !inner_path.is_dir() {
                            continue;
                        }
                        let inner_pkg = inner_path.join("package.json");
                        if inner_pkg.exists() {
                            matches.push(inner_pkg);
                        }
                    }
                }
            }
        }
    }

    matches
}

fn infer_suitability(base: &Path) -> (bool, Option<String>, Vec<String>) {
    let package_files = discover_workspace_package_json(base);
    let mut suggested_dirs: Vec<String> = Vec::new();
    let mut any_dev_script = false;
    let mut any_web_dev_script = false;

    for package_path in package_files {
        if let Ok(content) = std::fs::read_to_string(&package_path) {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                let dev_script = json
                    .get("scripts")
                    .and_then(|s| s.as_object())
                    .and_then(|scripts| scripts.get("dev"))
                    .and_then(|v| v.as_str());

                if let Some(script) = dev_script {
                    any_dev_script = true;
                    let rel = package_path
                        .parent()
                        .and_then(|dir| dir.strip_prefix(base).ok())
                        .map(|p| p.to_string_lossy().to_string())
                        .unwrap_or_else(|| ".".to_string());

                    suggested_dirs.push(rel.clone());

                    if script_has_web_hint(script, &json) {
                        any_web_dev_script = true;
                    }
                }
            }
        }
    }

    suggested_dirs.sort();
    suggested_dirs.dedup();

    if any_web_dev_script {
        return (true, None, suggested_dirs);
    }

    if any_dev_script {
        return (
            false,
            Some("Dev scripts were found, but they do not look like a localhost web preview app.".to_string()),
            suggested_dirs,
        );
    }

    if base.join("Cargo.toml").exists() && !base.join("package.json").exists() {
        return (
            false,
            Some("This project appears to be native/backend-only and may not support localhost preview.".to_string()),
            suggested_dirs,
        );
    }

    (
        false,
        Some("No dev server script detected for a local web preview.".to_string()),
        suggested_dirs,
    )
}

fn extract_backtick_content(line: &str) -> Option<String> {
    let start = line.find('`')?;
    let end = line[start + 1..].find('`').map(|idx| start + 1 + idx)?;
    if end > start + 1 {
        Some(line[start + 1..end].trim().to_string())
    } else {
        None
    }
}

fn extract_working_dir(line: &str) -> Option<String> {
    let lower = line.to_lowercase();
    let from_idx = lower.find("(from")?;
    let raw = line[from_idx + 5..]
        .trim()
        .trim_start_matches(':')
        .trim_start();

    let end = raw.find(')').unwrap_or(raw.len());
    let mut value = raw[..end].trim().to_string();

    if value.starts_with('`') && value.ends_with('`') && value.len() >= 2 {
        value = value[1..value.len() - 1].to_string();
    }

    if value.is_empty() {
        None
    } else {
        Some(value)
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub port: Option<u16>,
    pub working_dir: Option<String>,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerState {
    pub running: bool,
    pub port: Option<u16>,
    pub logs: Vec<String>,
    pub diagnostic: Option<DevServerDiagnostic>,
}

pub struct DevServerProcess {
    pub child: Option<Child>,
    pub port: Option<u16>,
    pub logs: Arc<Mutex<Vec<String>>>,
    pub command_line: String,
    pub working_dir: String,
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
    let package_manager = infer_package_manager_for_path(Path::new(&path))
        .or_else(|| detect_package_manager(&json));

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

                let manager = package_manager.ok_or_else(|| {
                    diagnostic_error(DevServerDiagnostic {
                        reason_code: DevServerReasonCode::CommandFailed,
                        message: "Dev script found, but package manager could not be inferred from lockfiles or package metadata.".to_string(),
                        expected_port: port,
                        observed_port: None,
                        command: Some(dev_script.to_string()),
                        cwd: Some(path.clone()),
                        suggested_cwd: None,
                        url_attempts: collect_url_attempts(port),
                        preferred_url: None,
                        logs_tail: vec![],
                    })
                })?;

                let args = default_dev_args_for_manager(&manager);

                return Ok(Some(DevServerConfig {
                    command: manager,
                    args,
                    port,
                    working_dir: None,
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

    let launch_dir = if let Some(working_dir) = &config.working_dir {
        let candidate = PathBuf::from(working_dir);
        let resolved = if candidate.is_absolute() {
            candidate
        } else {
            PathBuf::from(&path).join(candidate)
        };

        if !resolved.exists() || !resolved.is_dir() {
            return Err(diagnostic_error(DevServerDiagnostic {
                reason_code: DevServerReasonCode::MonorepoWrongCwd,
                message: format!("Working directory '{}' was not found.", resolved.display()),
                expected_port: config.port,
                observed_port: None,
                command: Some(format!("{} {}", config.command, config.args.join(" "))),
                cwd: Some(path.clone()),
                suggested_cwd: Some(working_dir.clone()),
                url_attempts: collect_url_attempts(config.port),
                preferred_url: None,
                logs_tail: vec![],
            }));
        }

        resolved
    } else {
        PathBuf::from(&path)
    };

    let command_name = if config.command.trim().is_empty() {
        infer_package_manager_for_path(&launch_dir).ok_or_else(|| {
            diagnostic_error(DevServerDiagnostic {
                reason_code: DevServerReasonCode::CommandFailed,
                message: "Dev command not provided and package manager could not be inferred from lockfiles or package metadata.".to_string(),
                expected_port: config.port,
                observed_port: None,
                command: None,
                cwd: Some(launch_dir.to_string_lossy().to_string()),
                suggested_cwd: config.working_dir.clone(),
                url_attempts: collect_url_attempts(config.port),
                preferred_url: None,
                logs_tail: vec![],
            })
        })?
    } else {
        config.command.clone()
    };

    let command_args = if config.args.is_empty() {
        default_dev_args_for_manager(&command_name)
    } else {
        config.args.clone()
    };

    // Start new server
    let mut command = Command::new(&command_name);
    command
        .args(&command_args)
        .current_dir(&launch_dir)
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

    let mut child = command.spawn().map_err(|err| {
        diagnostic_error(DevServerDiagnostic {
            reason_code: DevServerReasonCode::CommandFailed,
            message: format!(
                "Failed to start dev server with '{}': {err}",
                command_name
            ),
            expected_port: config.port,
            observed_port: None,
            command: Some(format!("{} {}", command_name, command_args.join(" "))),
            cwd: Some(launch_dir.to_string_lossy().to_string()),
            suggested_cwd: config.working_dir.clone(),
            url_attempts: collect_url_attempts(config.port),
            preferred_url: None,
            logs_tail: vec![],
        })
    })?;

    // Create shared log storage
    let started_command = format!("{} {}", command_name, command_args.join(" "));
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
        command_line: started_command,
        working_dir: launch_dir.to_string_lossy().to_string(),
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
                let mut cmd = Command::new("kill");
                cmd.args(["-0", &c.id().to_string()]);
                cmd.output().map(|o| o.status.success()).unwrap_or(false)
            })
            .unwrap_or(false);

        let logs = server.logs.lock()
            .map(|l| l.clone())
            .unwrap_or_default();

        let expected_port = server.port;
        let observed_port = detect_port_from_logs(&logs);

        let expected_listening = expected_port.map(|port| {
            probe_port("localhost", port) || probe_port("127.0.0.1", port) || probe_port("::1", port)
        }).unwrap_or(false);

        let observed_listening = observed_port
            .filter(|port| Some(*port) != expected_port)
            .map(|port| probe_port("localhost", port) || probe_port("127.0.0.1", port) || probe_port("::1", port))
            .unwrap_or(false);

        let active_port = if expected_listening {
            expected_port
        } else if observed_listening {
            observed_port
        } else {
            None
        };

        let mut diagnostic: Option<DevServerDiagnostic> = None;

        if process_alive {
            if !expected_listening {
                if let (Some(expected), Some(observed)) = (expected_port, observed_port) {
                    if expected != observed && observed_listening {
                        diagnostic = Some(DevServerDiagnostic {
                            reason_code: DevServerReasonCode::PortMismatch,
                            message: format!("Expected port {}, but app appears to be listening on {}.", expected, observed),
                            expected_port: Some(expected),
                            observed_port: Some(observed),
                            command: Some(server.command_line.clone()),
                            cwd: Some(server.working_dir.clone()),
                            suggested_cwd: None,
                            url_attempts: collect_url_attempts(Some(expected)),
                            preferred_url: detect_preferred_url_from_logs(&logs, Some(observed)),
                            logs_tail: logs_tail(&logs, 40),
                        });
                    }
                }

                if diagnostic.is_none() {
                    let lower_logs = logs.join("\n").to_lowercase();
                    let reason_code = if lower_logs.contains("https://") {
                        DevServerReasonCode::ProtocolMismatch
                    } else {
                        DevServerReasonCode::StartupTimeout
                    };

                    diagnostic = Some(DevServerDiagnostic {
                        reason_code,
                        message: "Process is running but localhost preview is not reachable yet.".to_string(),
                        expected_port,
                        observed_port,
                        command: Some(server.command_line.clone()),
                        cwd: Some(server.working_dir.clone()),
                        suggested_cwd: None,
                        url_attempts: collect_url_attempts(expected_port.or(observed_port)),
                        preferred_url: detect_preferred_url_from_logs(&logs, observed_port.or(expected_port)),
                        logs_tail: logs_tail(&logs, 40),
                    });
                }
            }
        } else if !logs.is_empty() {
            let lower_logs = logs.join("\n").to_lowercase();
            if lower_logs.contains("not found")
                || lower_logs.contains("enoent")
                || lower_logs.contains("failed")
                || lower_logs.contains("error")
            {
                diagnostic = Some(DevServerDiagnostic {
                    reason_code: DevServerReasonCode::CommandFailed,
                    message: "Dev command exited before the preview became reachable.".to_string(),
                    expected_port,
                    observed_port,
                    command: Some(server.command_line.clone()),
                    cwd: Some(server.working_dir.clone()),
                    suggested_cwd: None,
                    url_attempts: collect_url_attempts(expected_port.or(observed_port)),
                    preferred_url: detect_preferred_url_from_logs(&logs, observed_port.or(expected_port)),
                    logs_tail: logs_tail(&logs, 40),
                });
            }
        }

        let running = process_alive && active_port.is_some();

        Ok(DevServerState {
            running,
            port: active_port.or(expected_port),
            logs,
            diagnostic,
        })
    } else {
        Ok(DevServerState {
            running: false,
            port: None,
            logs: vec![],
            diagnostic: None,
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
    pub working_dir: Option<String>,
    pub suggested_working_dirs: Vec<String>,
    pub found: bool,
    pub file_path: Option<String>,
    pub is_monorepo: bool,
    pub preview_suitable: bool,
    pub suitability_reason: Option<String>,
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

    let (preview_suitable, suitability_reason, mut suggested_working_dirs) = infer_suitability(&base);

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

            let command_line = content.lines()
                .find_map(|line| {
                    let lower = line.to_lowercase();
                    if (lower.contains("command") || lower.contains("run dev")) && line.contains('`') {
                        extract_backtick_content(line)
                    } else {
                        None
                    }
                });

            let working_dir = content.lines()
                .find_map(extract_working_dir);

            let resolved_work_dir = working_dir
                .as_ref()
                .map(|dir| {
                    let candidate = PathBuf::from(dir);
                    if candidate.is_absolute() {
                        candidate
                    } else {
                        base.join(candidate)
                    }
                })
                .filter(|candidate| candidate.exists() && candidate.is_dir());

            let inferred_manager = resolved_work_dir
                .as_deref()
                .and_then(infer_package_manager_for_path)
                .or_else(|| infer_package_manager_for_path(&base));

            let (dev_command, dev_args) = command_line
                .as_deref()
                .and_then(parse_command_line)
                .map(|(command, args)| (Some(command), Some(args)))
                .or_else(|| {
                    inferred_manager
                        .as_ref()
                        .map(|manager| (Some(manager.clone()), Some(default_dev_args_for_manager(manager))))
                })
                .unwrap_or((None, None));

            if let Some(dir) = &working_dir {
                if !suggested_working_dirs.contains(dir) {
                    suggested_working_dirs.push(dir.clone());
                }
            }
            suggested_working_dirs.sort();
            suggested_working_dirs.dedup();

            return Ok(AgentsConfig {
                port,
                dev_command,
                dev_args,
                working_dir,
                suggested_working_dirs,
                found: true,
                file_path: Some(full_path.to_string_lossy().to_string()),
                is_monorepo,
                preview_suitable,
                suitability_reason,
            });
        }
    }

    Ok(AgentsConfig {
        port: None,
        dev_command: None,
        dev_args: None,
        working_dir: None,
        suggested_working_dirs,
        found: false,
        file_path: None,
        is_monorepo,
        preview_suitable,
        suitability_reason,
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
                    activate
                    if (count of windows) = 0 then
                        create window with default profile
                        tell current session of current window
                            write text "cd '{}'"
                        end tell
                    else
                        tell current window
                            create tab with default profile
                            tell current session
                                write text "cd '{}'"
                            end tell
                        end tell
                    end if
                end tell"#,
                path, path
            ),
            "Ghostty" => {
                return Command::new("open")
                    .args(["-a", "Ghostty", &path])
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string());
            },
            "Warp" => {
                return Command::new("open")
                    .args(["-a", "Warp", &path])
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string());
            },
            "kitty" => {
                return Command::new("open")
                    .args(["-a", "kitty", &path])
                    .spawn()
                    .map(|_| ())
                    .map_err(|e| e.to_string());
            },
            _ => format!(
                r#"tell application "Terminal"
                    activate
                end tell
                delay 0.3
                tell application "System Events" to keystroke "t" using command down
                delay 0.3
                tell application "Terminal"
                    do script "cd '{}'" in front window
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
    auto_execute: Option<bool>,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let terminal_app = terminal.unwrap_or_else(|| "Terminal".to_string());
        let should_execute = auto_execute.unwrap_or(false);
        
        match terminal_app.as_str() {
            "iTerm" => {
                let newline_flag = if should_execute { "" } else { " without newline" };
                let script = format!(
                    r#"tell application "iTerm"
                        activate
                        tell current session of current window
                            write text "{}"{}
                        end tell
                    end tell"#,
                    text.replace("\"", "\\\""),
                    newline_flag
                );
                Command::new("osascript")
                    .args(["-e", &script])
                    .output()
                    .map(|_| ())
                    .map_err(|e| e.to_string())
            },
            _ => {
                // Check and prompt for Accessibility permission (required for CGEvent keystroke).
                // Uses CoreFoundation directly to avoid objc macro issues.
                {
                    extern "C" {
                        fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
                        fn CFStringCreateWithCString(allocator: *const std::ffi::c_void, cStr: *const i8, encoding: u32) -> *const std::ffi::c_void;
                        fn CFDictionaryCreate(
                            allocator: *const std::ffi::c_void,
                            keys: *const *const std::ffi::c_void,
                            values: *const *const std::ffi::c_void,
                            numValues: i64,
                            keyCallBacks: *const std::ffi::c_void,
                            valueCallBacks: *const std::ffi::c_void,
                        ) -> *const std::ffi::c_void;
                        static kCFTypeDictionaryKeyCallBacks: std::ffi::c_void;
                        static kCFTypeDictionaryValueCallBacks: std::ffi::c_void;
                        static kCFBooleanTrue: *const std::ffi::c_void;
                    }

                    let trusted = unsafe {
                        let key = CFStringCreateWithCString(
                            std::ptr::null(),
                            b"AXTrustedCheckOptionPrompt\0".as_ptr() as *const i8,
                            0x08000100, // kCFStringEncodingUTF8
                        );
                        let keys = [key];
                        let values = [kCFBooleanTrue];
                        let options = CFDictionaryCreate(
                            std::ptr::null(),
                            keys.as_ptr(),
                            values.as_ptr(),
                            1,
                            &kCFTypeDictionaryKeyCallBacks as *const _,
                            &kCFTypeDictionaryValueCallBacks as *const _,
                        );
                        AXIsProcessTrustedWithOptions(options)
                    };

                    if !trusted {
                        return Err("ViboGit needs Accessibility permission to paste into terminals. Please enable it in System Settings > Privacy & Security > Accessibility, then try again.".to_string());
                    }
                }

                // Copy text to clipboard via pbcopy
                let mut pbcopy = Command::new("pbcopy")
                    .stdin(std::process::Stdio::piped())
                    .spawn()
                    .map_err(|e| e.to_string())?;
                if let Some(mut stdin) = pbcopy.stdin.take() {
                    use std::io::Write;
                    stdin.write_all(text.as_bytes()).map_err(|e| e.to_string())?;
                }
                pbcopy.wait().map_err(|e| e.to_string())?;

                // Small delay to ensure clipboard is committed
                std::thread::sleep(std::time::Duration::from_millis(100));

                // Activate the terminal app via AppleScript (this only needs Apple Events, not Accessibility)
                let activate_script = format!(
                    r#"tell application "{}" to activate"#,
                    terminal_app
                );
                Command::new("osascript")
                    .args(["-e", &activate_script])
                    .output()
                    .map_err(|e| e.to_string())?;

                // Wait for terminal to come to foreground
                std::thread::sleep(std::time::Duration::from_millis(500));

                // Use CGEvent to send Cmd+V (requires Accessibility permission)
                use core_graphics::event::{CGEvent, CGEventFlags, CGKeyCode};
                use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

                let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
                    .map_err(|_| "Failed to create CGEventSource".to_string())?;

                // Key code 9 = 'v'
                let key_v: CGKeyCode = 9;

                let key_down = CGEvent::new_keyboard_event(source.clone(), key_v, true)
                    .map_err(|_| "Failed to create key down event".to_string())?;
                key_down.set_flags(CGEventFlags::CGEventFlagCommand);
                key_down.post(core_graphics::event::CGEventTapLocation::HID);

                std::thread::sleep(std::time::Duration::from_millis(50));

                let key_up = CGEvent::new_keyboard_event(source.clone(), key_v, false)
                    .map_err(|_| "Failed to create key up event".to_string())?;
                key_up.set_flags(CGEventFlags::CGEventFlagCommand);
                key_up.post(core_graphics::event::CGEventTapLocation::HID);

                if should_execute {
                    std::thread::sleep(std::time::Duration::from_millis(150));
                    // Key code 36 = Return
                    let return_down = CGEvent::new_keyboard_event(source.clone(), 36, true)
                        .map_err(|_| "Failed to create return key event".to_string())?;
                    return_down.post(core_graphics::event::CGEventTapLocation::HID);

                    std::thread::sleep(std::time::Duration::from_millis(50));

                    let return_up = CGEvent::new_keyboard_event(source, 36, false)
                        .map_err(|_| "Failed to create return key up event".to_string())?;
                    return_up.post(core_graphics::event::CGEventTapLocation::HID);
                }

                Ok(())
            }
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Send to terminal only supported on macOS".to_string())
    }
}

// Skills Commands

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Skill {
    pub name: String,
    pub description: String,
    pub path: String,
}

fn get_skills_directories() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    
    // 1. FACTORY_SKILLS_PATH env var
    if let Ok(p) = std::env::var("FACTORY_SKILLS_PATH") {
        paths.push(PathBuf::from(p));
    }
    
    // 2. FACTORY_HOME/skills env var
    if let Ok(home) = std::env::var("FACTORY_HOME") {
        paths.push(PathBuf::from(home).join("skills"));
    }
    
    // 3. ~/.factory/skills/
    if let Some(home) = dirs::home_dir() {
        paths.push(home.join(".factory").join("skills"));
    }
    
    paths
}

fn parse_skill_frontmatter(content: &str) -> (Option<String>, Option<String>) {
    // Check if content starts with frontmatter delimiter
    if !content.starts_with("---") {
        return (None, None);
    }
    
    // Find the end of frontmatter
    let rest = &content[3..];
    let end_idx = rest.find("\n---");
    if end_idx.is_none() {
        return (None, None);
    }
    
    let frontmatter = &rest[..end_idx.unwrap()];
    
    // Parse name field
    let name = frontmatter.lines()
        .find(|l| l.trim().starts_with("name:"))
        .map(|l| {
            l.trim()
                .trim_start_matches("name:")
                .trim()
                .trim_matches(|c| c == '"' || c == '\'')
                .to_string()
        });
    
    // Parse description field
    let description = frontmatter.lines()
        .find(|l| l.trim().starts_with("description:"))
        .map(|l| {
            l.trim()
                .trim_start_matches("description:")
                .trim()
                .trim_matches(|c| c == '"' || c == '\'')
                .to_string()
        });
    
    (name, description)
}

fn scan_skills_directory(path: &PathBuf) -> Vec<Skill> {
    let mut skills = Vec::new();
    
    // Return empty if directory doesn't exist
    if !path.exists() {
        return skills;
    }
    
    // Read directory entries
    let entries = match std::fs::read_dir(path) {
        Ok(e) => e,
        Err(_) => return skills,
    };
    
    for entry in entries.flatten() {
        // Skip non-directories and hidden directories
        let entry_path = entry.path();
        if !entry_path.is_dir() {
            continue;
        }
        
        let dir_name = match entry.file_name().to_str() {
            Some(n) => n.to_string(),
            None => continue,
        };
        
        if dir_name.starts_with('.') {
            continue;
        }
        
        // Check for SKILL.md
        let skill_file = entry_path.join("SKILL.md");
        if !skill_file.exists() {
            continue;
        }
        
        // Read and parse SKILL.md
        let content = match std::fs::read_to_string(&skill_file) {
            Ok(c) => c,
            Err(_) => continue,
        };
        
        let (name, description) = parse_skill_frontmatter(&content);
        
        skills.push(Skill {
            name: name.unwrap_or(dir_name),
            description: description.unwrap_or_default(),
            path: entry_path.to_string_lossy().to_string(),
        });
    }
    
    skills
}

#[tauri::command]
pub async fn list_skills() -> Result<Vec<Skill>, String> {
    let mut all_skills: Vec<Skill> = Vec::new();
    let mut seen_paths = std::collections::HashSet::new();
    
    // Scan all skill directories
    for dir in get_skills_directories() {
        for skill in scan_skills_directory(&dir) {
            // Deduplicate by path
            if seen_paths.insert(skill.path.clone()) {
                all_skills.push(skill);
            }
        }
    }
    
    // Sort alphabetically by name
    all_skills.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    
    Ok(all_skills)
}

// AI Commands

#[derive(Debug, Serialize, Deserialize)]
pub struct AiCommitRequest {
    pub diff: String,
    pub provider: String,
    pub api_key: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AiCommitResponse {
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiPrResponse {
    pub title: String,
    pub description: String,
}

#[tauri::command]
pub async fn ai_generate_commit(
    diff: String,
    provider: String,
    api_key: String,
) -> Result<AiCommitResponse, String> {
    let prompt = format!(
        "Write a git commit message for this diff.\n\
        Use conventional commit format (type: description).\n\
        Output ONLY the commit message - no markdown, no code blocks, no backticks, no quotes.\n\
        First line should be under 72 characters.\n\
        If the diff is summarized, rely on the stats and file list.\n\n\
        {}",
        if diff.len() > 10000 { &diff[..10000] } else { &diff }
    );

    let client = reqwest::Client::new();
    
    let response_text = match provider.as_str() {
        "anthropic" => {
            let body = serde_json::json!({
                "model": "claude-3-5-haiku-latest",
                "max_tokens": 500,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            });
            
            let res = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;
            
            let json: serde_json::Value = res.json().await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            json["content"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        "openai" => {
            let body = serde_json::json!({
                "model": "gpt-4o-mini",
                "max_tokens": 500,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            });
            
            let res = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;
            
            let json: serde_json::Value = res.json().await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            json["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        "gemini" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={}",
                api_key
            );
            
            let body = serde_json::json!({
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "maxOutputTokens": 500
                }
            });
            
            let res = client
                .post(&url)
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;
            
            let json: serde_json::Value = res.json().await
                .map_err(|e| format!("Failed to parse response: {}", e))?;
            
            json["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    // Clean up the response
    let mut message = response_text.trim().to_string();
    
    // Remove markdown code blocks
    if message.starts_with("```") {
        message = message
            .trim_start_matches(|c: char| c == '`' || c.is_alphabetic() || c == '\n')
            .trim_end_matches('`')
            .trim()
            .to_string();
    }
    
    // Remove surrounding quotes
    if (message.starts_with('"') && message.ends_with('"'))
        || (message.starts_with('`') && message.ends_with('`'))
    {
        message = message[1..message.len() - 1].trim().to_string();
    }

    Ok(AiCommitResponse { message })
}

#[tauri::command]
pub async fn ai_generate_pr(
    commits: Vec<String>,
    diff: String,
    base_branch: String,
    head_branch: String,
    provider: String,
    api_key: String,
) -> Result<AiPrResponse, String> {
    let commits_text = if commits.is_empty() {
        String::from("- No recent commits available")
    } else {
        commits.join("\n")
    };

    let prompt = format!(
        "Generate a pull request title and description for the following changes.\n\n\
        Branch: {} → {}\n\n\
        Commits:\n{}\n\n\
        Diff summary (truncated):\n{}\n\n\
        Output format (JSON):\n{{\n  \"title\": \"Short descriptive title (max 72 chars)\",\n  \"description\": \"Markdown description with ## Summary and ## Changes sections\"\n}}\n\n\
        Output ONLY valid JSON, no markdown code blocks.",
        head_branch,
        base_branch,
        commits_text,
        if diff.len() > 5000 { &diff[..5000] } else { &diff }
    );

    let client = reqwest::Client::new();

    let response_text = match provider.as_str() {
        "anthropic" => {
            let body = serde_json::json!({
                "model": "claude-3-5-haiku-latest",
                "max_tokens": 1000,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            });

            let res = client
                .post("https://api.anthropic.com/v1/messages")
                .header("x-api-key", &api_key)
                .header("anthropic-version", "2023-06-01")
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;

            let json: serde_json::Value = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            json["content"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        "openai" => {
            let body = serde_json::json!({
                "model": "gpt-4o-mini",
                "max_tokens": 1000,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            });

            let res = client
                .post("https://api.openai.com/v1/chat/completions")
                .header("Authorization", format!("Bearer {}", api_key))
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;

            let json: serde_json::Value = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            json["choices"][0]["message"]["content"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        "gemini" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key={}",
                api_key
            );

            let body = serde_json::json!({
                "contents": [{
                    "parts": [{"text": prompt}]
                }],
                "generationConfig": {
                    "maxOutputTokens": 1000
                }
            });

            let res = client
                .post(&url)
                .header("content-type", "application/json")
                .json(&body)
                .send()
                .await
                .map_err(|e| format!("Request failed: {}", e))?;

            let json: serde_json::Value = res
                .json()
                .await
                .map_err(|e| format!("Failed to parse response: {}", e))?;

            json["candidates"][0]["content"]["parts"][0]["text"]
                .as_str()
                .unwrap_or("")
                .to_string()
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    let cleaned = response_text
        .replace("```json", "")
        .replace("```", "")
        .trim()
        .to_string();

    let fallback_title = format!("Merge {} into {}", head_branch, base_branch);

    let parsed = serde_json::from_str::<serde_json::Value>(&cleaned)
        .unwrap_or_else(|_| serde_json::json!({
            "title": fallback_title,
            "description": cleaned,
        }));

    let title = parsed
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("Generated PR")
        .to_string();

    let description = parsed
        .get("description")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    Ok(AiPrResponse { title, description })
}

// Clipboard Image Commands

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveClipboardImageResponse {
    pub path: String,
}

#[tauri::command]
pub async fn save_clipboard_image(folder: String) -> Result<SaveClipboardImageResponse, String> {
    use arboard::Clipboard;
    use std::io::Write;

    let folder_path = if folder.is_empty() {
        dirs::desktop_dir().unwrap_or_else(|| PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("Desktop"))
    } else {
        let expanded = if folder.starts_with("~/") {
            PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(&folder[2..])
        } else {
            PathBuf::from(&folder)
        };
        expanded
    };

    if !folder_path.exists() {
        std::fs::create_dir_all(&folder_path).map_err(|e| format!("Failed to create folder: {}", e))?;
    }

    let mut clipboard = Clipboard::new().map_err(|e| format!("Failed to access clipboard: {}", e))?;
    let image = clipboard.get_image().map_err(|e| format!("No image in clipboard: {}", e))?;

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let filename = format!("vibogit-paste-{}.png", timestamp);
    let file_path = folder_path.join(&filename);

    // Write raw RGBA data as PNG
    let width = image.width as u32;
    let height = image.height as u32;
    let mut png_data = Vec::new();
    {
        let mut encoder = png::Encoder::new(&mut png_data, width, height);
        encoder.set_color(png::ColorType::Rgba);
        encoder.set_depth(png::BitDepth::Eight);
        let mut writer = encoder.write_header().map_err(|e| format!("PNG encode error: {}", e))?;
        writer.write_image_data(&image.bytes).map_err(|e| format!("PNG write error: {}", e))?;
    }

    let mut file = std::fs::File::create(&file_path).map_err(|e| format!("Failed to create file: {}", e))?;
    file.write_all(&png_data).map_err(|e| format!("Failed to write file: {}", e))?;

    Ok(SaveClipboardImageResponse {
        path: file_path.to_string_lossy().to_string(),
    })
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FindRecentImageResponse {
    pub path: Option<String>,
}

#[tauri::command]
pub async fn find_recent_image(folder: String, within_secs: u64) -> Result<FindRecentImageResponse, String> {
    let folder_path = if folder.is_empty() {
        dirs::desktop_dir().unwrap_or_else(|| PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("Desktop"))
    } else {
        let expanded = if folder.starts_with("~/") {
            PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(&folder[2..])
        } else {
            PathBuf::from(&folder)
        };
        expanded
    };

    if !folder_path.exists() {
        return Ok(FindRecentImageResponse { path: None });
    }

    let image_extensions = ["png", "jpg", "jpeg", "gif", "webp"];
    let now = std::time::SystemTime::now();
    let cutoff = std::time::Duration::from_secs(within_secs);

    let mut newest: Option<(PathBuf, std::time::SystemTime)> = None;

    let entries = std::fs::read_dir(&folder_path).map_err(|e| format!("Failed to read folder: {}", e))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase();
        if !image_extensions.contains(&ext.as_str()) {
            continue;
        }
        if let Ok(metadata) = path.metadata() {
            if let Ok(modified) = metadata.modified() {
                if let Ok(elapsed) = now.duration_since(modified) {
                    if elapsed <= cutoff {
                        match &newest {
                            Some((_, prev_time)) => {
                                if modified > *prev_time {
                                    newest = Some((path, modified));
                                }
                            }
                            None => {
                                newest = Some((path, modified));
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(FindRecentImageResponse {
        path: newest.map(|(p, _)| p.to_string_lossy().to_string()),
    })
}

#[tauri::command]
pub async fn read_image_as_data_url(path: String) -> Result<String, String> {
    use base64::Engine;

    let file_path = PathBuf::from(&path);
    if !file_path.exists() {
        return Err(format!("File not found: {}", path));
    }

    let bytes = std::fs::read(&file_path).map_err(|e| format!("Failed to read file: {}", e))?;
    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("png")
        .to_lowercase();
    let mime = match ext.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        _ => "image/png",
    };

    let b64 = base64::engine::general_purpose::STANDARD.encode(&bytes);
    Ok(format!("data:{};base64,{}", mime, b64))
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CopyImageResponse {
    pub path: String,
}

#[tauri::command]
pub async fn copy_image_to_folder(source_path: String, dest_folder: String) -> Result<CopyImageResponse, String> {
    let source = PathBuf::from(&source_path);
    if !source.exists() {
        return Err(format!("Source file not found: {}", source_path));
    }

    let dest_dir = if dest_folder.is_empty() {
        dirs::desktop_dir().unwrap_or_else(|| PathBuf::from(std::env::var("HOME").unwrap_or_default()).join("Desktop"))
    } else {
        let expanded = if dest_folder.starts_with("~/") {
            PathBuf::from(std::env::var("HOME").unwrap_or_default()).join(&dest_folder[2..])
        } else {
            PathBuf::from(&dest_folder)
        };
        expanded
    };

    if !dest_dir.exists() {
        std::fs::create_dir_all(&dest_dir).map_err(|e| format!("Failed to create folder: {}", e))?;
    }

    let filename = source.file_name().unwrap_or_default().to_string_lossy().to_string();
    let stem = source.file_stem().unwrap_or_default().to_string_lossy().to_string();
    let ext = source.extension().and_then(|e| e.to_str()).unwrap_or("png");

    let mut dest_path = dest_dir.join(&filename);

    // Auto-rename with timestamp if file exists
    if dest_path.exists() {
        let timestamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let new_filename = format!("{}-{}.{}", stem, timestamp, ext);
        dest_path = dest_dir.join(new_filename);
    }

    std::fs::copy(&source, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(CopyImageResponse {
        path: dest_path.to_string_lossy().to_string(),
    })
}
