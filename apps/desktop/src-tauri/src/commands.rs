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

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerConfig {
    pub command: String,
    pub args: Vec<String>,
    pub port: Option<u16>,
    pub explicit_port: Option<u16>,
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

fn parse_explicit_port_from_dev_script(dev_script: &str) -> Option<u16> {
    let parts: Vec<&str> = dev_script.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    for (index, part) in parts.iter().enumerate() {
        if *part == "-p" || *part == "--port" {
            if let Some(next) = parts.get(index + 1) {
                if let Ok(port) = next.parse::<u16>() {
                    return Some(port);
                }
            }
            continue;
        }

        if let Some(value) = part.strip_prefix("--port=") {
            if let Ok(port) = value.parse::<u16>() {
                return Some(port);
            }
            continue;
        }

        if let Some(value) = part.strip_prefix("-p") {
            if !value.is_empty() {
                if let Ok(port) = value.parse::<u16>() {
                    return Some(port);
                }
            }
        }
    }

    None
}

fn infer_default_dev_port(dev_script: &str) -> Option<u16> {
    if dev_script.contains("next") {
        Some(3000)
    } else if dev_script.contains("vite") {
        Some(5173)
    } else if dev_script.contains("remix") {
        Some(3000)
    } else {
        Some(3000)
    }
}

fn update_explicit_port_in_dev_script(dev_script: &str, port: u16) -> Result<String, String> {
    let mut parts: Vec<String> = dev_script
        .split_whitespace()
        .map(|part| part.to_string())
        .collect();

    if parts.is_empty() {
        return Err("Dev script is empty".to_string());
    }

    for index in 0..parts.len() {
        if parts[index] == "-p" || parts[index] == "--port" {
            if index + 1 >= parts.len() {
                return Err("Dev script has a port flag without a value".to_string());
            }
            parts[index + 1] = port.to_string();
            return Ok(parts.join(" "));
        }

        if parts[index].starts_with("--port=") {
            parts[index] = format!("--port={}", port);
            return Ok(parts.join(" "));
        }

        if let Some(value) = parts[index].strip_prefix("-p") {
            if !value.is_empty() && value.chars().all(|char| char.is_ascii_digit()) {
                parts[index] = format!("-p{}", port);
                return Ok(parts.join(" "));
            }
        }
    }

    Err("Dev script does not define an explicit port flag".to_string())
}

fn resolve_agents_file_path(repo_path: &str) -> PathBuf {
    let base = PathBuf::from(repo_path);
    let agents_paths = ["AGENTS.md", "agents.md", ".agents.md"];

    for file_name in &agents_paths {
        let full_path = base.join(file_name);
        if full_path.exists() {
            return full_path;
        }
    }

    base.join("AGENTS.md")
}

#[cfg(test)]
mod dev_script_port_tests {
    use super::{parse_explicit_port_from_dev_script, update_explicit_port_in_dev_script};

    #[test]
    fn parses_space_separated_short_flag() {
        assert_eq!(parse_explicit_port_from_dev_script("next dev -p 7842"), Some(7842));
    }

    #[test]
    fn parses_space_separated_long_flag() {
        assert_eq!(parse_explicit_port_from_dev_script("next dev --port 7842"), Some(7842));
    }

    #[test]
    fn parses_equals_long_flag() {
        assert_eq!(parse_explicit_port_from_dev_script("next dev --port=7842"), Some(7842));
    }

    #[test]
    fn parses_compact_short_flag() {
        assert_eq!(parse_explicit_port_from_dev_script("next dev -p7842"), Some(7842));
    }

    #[test]
    fn returns_none_when_not_explicit() {
        assert_eq!(parse_explicit_port_from_dev_script("next dev"), None);
    }

    #[test]
    fn updates_short_flag_value() {
        let updated = update_explicit_port_in_dev_script("next dev -p 3000", 7842)
            .expect("script should be updated");
        assert_eq!(updated, "next dev -p 7842");
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
                let explicit_port = parse_explicit_port_from_dev_script(dev_script);
                let port = explicit_port.or_else(|| infer_default_dev_port(dev_script));

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
                    explicit_port,
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
            
            // Parse port from explicit labels only to avoid false matches like "supporting".
            let port = content.lines().find_map(|line| {
                let trimmed = line.trim();
                let lower = trimmed.to_ascii_lowercase();
                let has_port_label = lower.starts_with("- port:")
                    || lower.starts_with("port:")
                    || lower.starts_with("- dev server port:")
                    || lower.starts_with("dev server port:");

                if !has_port_label {
                    return None;
                }

                let (_, value) = trimmed.split_once(':')?;
                let mut digits = String::new();
                let mut started = false;
                for ch in value.chars() {
                    if ch.is_ascii_digit() {
                        digits.push(ch);
                        started = true;
                    } else if started {
                        break;
                    }
                }

                if digits.is_empty() {
                    None
                } else {
                    digits.parse::<u16>().ok()
                }
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
    let agents_path = resolve_agents_file_path(&repo_path);
    
    let content = if agents_path.exists() {
        let existing = std::fs::read_to_string(&agents_path).map_err(|e| e.to_string())?;
        
        // Check if "## Development Server" section exists
        if existing.contains("## Development Server") {
            // Update existing port in Development Server section
            let mut lines: Vec<String> = existing.lines().map(|s| s.to_string()).collect();
            let mut in_dev_section = false;
            let mut port_updated = false;
            
            for line in &mut lines {
                let trimmed = line.trim_start();
                let lower_trimmed = trimmed.to_ascii_lowercase();

                if lower_trimmed.starts_with("## development server") {
                    in_dev_section = true;
                } else if trimmed.starts_with("## ") {
                    in_dev_section = false;
                }
                
                let lower_line = line.trim().to_ascii_lowercase();
                let is_port_line = lower_line.starts_with("- port:")
                    || lower_line.starts_with("port:")
                    || lower_line.starts_with("- dev server port:")
                    || lower_line.starts_with("dev server port:");

                if in_dev_section && is_port_line {
                    *line = format!("- Port: {}", port);
                    port_updated = true;
                }
            }
            
            // If no port line found in section, add it after the header
            if !port_updated {
                let mut new_lines = Vec::new();
                for line in lines {
                    new_lines.push(line.clone());
                    if line.trim_start().to_ascii_lowercase().starts_with("## development server") {
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

#[tauri::command]
pub async fn write_dev_script_port(
    repo_path: String,
    port: u16,
) -> Result<(), String> {
    let package_json_path = PathBuf::from(&repo_path).join("package.json");
    if !package_json_path.exists() {
        return Err("package.json not found".to_string());
    }

    let content = std::fs::read_to_string(&package_json_path).map_err(|e| e.to_string())?;
    let mut json: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let scripts = json
        .get_mut("scripts")
        .and_then(|scripts| scripts.as_object_mut())
        .ok_or_else(|| "package.json is missing scripts".to_string())?;

    let dev_script = scripts
        .get("dev")
        .and_then(|dev| dev.as_str())
        .ok_or_else(|| "package.json is missing scripts.dev".to_string())?;

    let updated_dev_script = update_explicit_port_in_dev_script(dev_script, port)?;
    scripts.insert("dev".to_string(), serde_json::Value::String(updated_dev_script));

    let updated_content = serde_json::to_string_pretty(&json).map_err(|e| e.to_string())?;
    std::fs::write(&package_json_path, updated_content).map_err(|e| e.to_string())?;
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
    model: String,
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
                "model": &model,
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
                "model": &model,
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
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
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
    model: String,
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
                "model": &model,
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
                "model": &model,
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
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
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
