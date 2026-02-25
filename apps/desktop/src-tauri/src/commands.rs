use crate::git::{self, Commit, FileDiff, GitError, ProjectState, SaveResult, ShipResult, SyncResult};
use crate::watcher;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::time::{Duration, Instant};
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
    pub status_cache: Mutex<StatusCache>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            current_project: Mutex::new(None),
            recent_projects: Mutex::new(Vec::new()),
            watcher_handle: Mutex::new(None),
            status_cache: Mutex::new(StatusCache::default()),
        }
    }
}

const STATUS_CACHE_TTL: Duration = Duration::from_millis(1000);

#[derive(Debug, Clone)]
struct StatusCacheEntry {
    state: ProjectState,
    cached_at: Instant,
}

#[derive(Debug, Default)]
pub struct StatusCache {
    entries: HashMap<String, StatusCacheEntry>,
    hits: u64,
    misses: u64,
}

fn is_power_debug_enabled() -> bool {
    std::env::var("VIBOGIT_DEBUG_POWER")
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false)
}

fn maybe_log_cache_debug(cache: &StatusCache, reason: &str) {
    if !is_power_debug_enabled() {
        return;
    }

    let total = cache.hits + cache.misses;
    if total > 0 && total % 100 == 0 {
        let hit_rate = (cache.hits as f64 / total as f64) * 100.0;
        eprintln!(
            "[PowerDebug][status-cache] reason={} hits={} misses={} hit_rate={:.1}%",
            reason,
            cache.hits,
            cache.misses,
            hit_rate
        );
    }
}

fn get_status_cached(state: &AppState, path: &str) -> Result<ProjectState, GitError> {
    let now = Instant::now();

    {
        let mut cache = state.status_cache.lock().unwrap();
        if let Some(cached) = cache.entries.get(path).and_then(|entry| {
            if now.duration_since(entry.cached_at) <= STATUS_CACHE_TTL {
                Some(entry.state.clone())
            } else {
                None
            }
        }) {
            cache.hits += 1;
            maybe_log_cache_debug(&cache, "hit");
            return Ok(cached);
        }

        if cache.entries.contains_key(path) {
            cache.entries.remove(path);
        }

        cache.misses += 1;
        maybe_log_cache_debug(&cache, "miss");
    }

    let fresh = git::get_status(path)?;

    let mut cache = state.status_cache.lock().unwrap();
    cache.entries.insert(
        path.to_string(),
        StatusCacheEntry {
            state: fresh.clone(),
            cached_at: Instant::now(),
        },
    );

    Ok(fresh)
}

fn invalidate_status_cache(state: &AppState, path: &str) {
    let mut cache = state.status_cache.lock().unwrap();
    cache.entries.remove(path);
}

fn invalidate_all_status_cache(state: &AppState) {
    let mut cache = state.status_cache.lock().unwrap();
    cache.entries.clear();
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
pub async fn get_all_project_statuses(
    paths: Vec<String>,
    state: State<'_, AppState>,
) -> Result<Vec<ProjectStatus>, String> {
    let mut statuses = Vec::new();
    
    for path in paths {
        let status = match get_status_cached(&state, &path) {
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

    get_status_cached(&state, &project_path)
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

    let result = git::save(&project_path, message)?;
    invalidate_status_cache(&state, &project_path);
    Ok(result)
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

    let result = git::ship(&project_path)?;
    invalidate_status_cache(&state, &project_path);
    Ok(result)
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

    let result = git::sync(&project_path)?;
    invalidate_status_cache(&state, &project_path);
    Ok(result)
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

    git::fetch(&project_path)?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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
    invalidate_all_status_cache(&state);

    // Validate it's a git repo
    get_status_cached(&state, &path).map_err(|e| e.to_string())?;

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

    git::stage(&project_path, &files)?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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

    git::unstage(&project_path, &files)?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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

    git::checkout(&project_path, &branch)?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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

    git::create_branch(&project_path, &name, checkout.unwrap_or(false))?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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

    git::stash_save(&project_path, message)?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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

    git::stash_pop(&project_path)?;
    invalidate_status_cache(&state, &project_path);
    Ok(())
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
pub async fn git_init(path: String, state: State<'_, AppState>) -> Result<(), GitError> {
    git::init_repo(&path)?;
    invalidate_status_cache(&state, &path);
    Ok(())
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

const MAX_FAVICON_FILE_SIZE: u64 = 512 * 1024; // 512KB
const MAX_ICON_SOURCE_FILE_SIZE: u64 = 256 * 1024; // 256KB

const KNOWN_DEFAULT_ICON_HASHES: [&str; 1] = [
    // Next/Vercel starter favicon.ico used across multiple repos.
    "2b8ad2d33455a8f736fc3a8ebf8f0bdea8848ad4c0db48a2833bd0f9cd775932",
];

const ICON_SOURCE_FILES: [&str; 6] = [
    "app/layout.tsx",
    "src/app/layout.tsx",
    "app/head.tsx",
    "src/app/head.tsx",
    "public/index.html",
    "index.html",
];

const FALLBACK_ICON_PATHS: [&str; 57] = [
    // Browser-likely public paths first.
    "public/favicon.svg",
    "public/favicon.png",
    "public/favicon.ico",
    "public/favicon-32x32.png",
    "public/favicon-16x16.png",
    "public/images/favicon.svg",
    "public/images/favicon.png",
    "public/images/favicon.ico",
    "public/webflow/favicon.svg",
    "public/webflow/favicon.png",
    "public/webflow/favicon.ico",
    "public/img/favicon.svg",
    "public/img/favicon.png",
    "public/img/favicon.ico",
    // Root/static/src favicon paths.
    "favicon.svg",
    "favicon.png",
    "favicon.ico",
    "favicon-32x32.png",
    "favicon-16x16.png",
    "static/favicon.svg",
    "static/favicon.png",
    "static/favicon.ico",
    "src/favicon.svg",
    "src/favicon.png",
    "src/favicon.ico",
    // App router icons after explicit declarations.
    "app/favicon.svg",
    "app/favicon.png",
    "app/favicon.ico",
    "app/icon.svg",
    "app/icon.png",
    "app/icon.ico",
    "src/app/favicon.svg",
    "src/app/favicon.png",
    "src/app/favicon.ico",
    "src/app/icon.svg",
    "src/app/icon.png",
    "src/app/icon.ico",
    // Generic logo/icon fallback.
    "public/logo.svg",
    "public/logo.png",
    "public/logo.ico",
    "public/icon.svg",
    "public/icon.png",
    "public/icon.ico",
    "public/images/logo.svg",
    "public/images/logo.png",
    "public/images/icon.svg",
    "public/images/icon.png",
    "assets/logo.svg",
    "assets/logo.png",
    "assets/icon.svg",
    "assets/icon.png",
    "logo.svg",
    "logo.png",
    "logo.ico",
    "icon.svg",
    "icon.png",
    "icon.ico",
];

#[derive(Debug)]
struct ResolvedFavicon {
    bytes: Vec<u8>,
    mime_type: String,
}

#[tauri::command]
pub async fn get_favicon(path: String) -> Result<FaviconResult, String> {
    let repo_root = PathBuf::from(&path);

    let mut candidates = collect_browser_declared_icon_candidates(&repo_root);
    candidates.extend(collect_fallback_icon_candidates(&repo_root));

    if let Some(resolved) = select_best_icon(candidates) {
        return Ok(FaviconResult {
            favicon: Some(base64_encode(&resolved.bytes)),
            mime_type: Some(resolved.mime_type),
        });
    }

    Ok(FaviconResult {
        favicon: None,
        mime_type: None,
    })
}

fn collect_browser_declared_icon_candidates(repo_root: &Path) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    for source_rel_path in ICON_SOURCE_FILES {
        let source_path = repo_root.join(source_rel_path);
        if !source_path.is_file() {
            continue;
        }

        let Some(content) = read_icon_source_file(&source_path) else {
            continue;
        };

        let mut refs = extract_next_metadata_icon_references(&content);
        refs.extend(extract_link_tag_icon_references(&content));

        for raw_ref in refs {
            for candidate in normalize_icon_reference_to_paths(&raw_ref, &source_path, repo_root) {
                if seen.insert(candidate.clone()) {
                    candidates.push(candidate);
                }
            }
        }
    }

    candidates
}

fn collect_fallback_icon_candidates(repo_root: &Path) -> Vec<PathBuf> {
    FALLBACK_ICON_PATHS.iter().map(|relative| repo_root.join(relative)).collect()
}

fn select_best_icon(candidates: Vec<PathBuf>) -> Option<ResolvedFavicon> {
    select_best_icon_with_known_defaults(candidates, &KNOWN_DEFAULT_ICON_HASHES)
}

fn select_best_icon_with_known_defaults(
    candidates: Vec<PathBuf>,
    known_default_hashes: &[&str],
) -> Option<ResolvedFavicon> {
    let mut fallback_default: Option<ResolvedFavicon> = None;
    let mut seen_paths = HashSet::new();

    for path in candidates {
        if !seen_paths.insert(path.clone()) {
            continue;
        }

        let Some(mime_type) = mime_type_for_icon_path(&path) else {
            continue;
        };

        let Some(bytes) = read_icon_candidate_bytes(&path) else {
            continue;
        };

        let resolved = ResolvedFavicon {
            bytes,
            mime_type: mime_type.to_string(),
        };

        if is_known_default_icon(&resolved.bytes, known_default_hashes) {
            if fallback_default.is_none() {
                fallback_default = Some(resolved);
            }
            continue;
        }

        return Some(resolved);
    }

    fallback_default
}

fn read_icon_source_file(path: &Path) -> Option<String> {
    if !path.is_file() {
        return None;
    }

    let meta = std::fs::metadata(path).ok()?;
    if meta.len() > MAX_ICON_SOURCE_FILE_SIZE {
        return None;
    }

    std::fs::read_to_string(path).ok()
}

fn extract_next_metadata_icon_references(content: &str) -> Vec<String> {
    let mut refs = Vec::new();

    for icons_value in collect_icons_value_segments(content) {
        if is_likely_icon_literal(&icons_value) {
            refs.push(icons_value.clone());
        }

        refs.extend(
            extract_keyed_string_values(&icons_value, &["icon", "shortcut", "apple", "url", "href"])
                .into_iter()
                .filter(|value| is_likely_icon_literal(value)),
        );
    }

    refs
}

fn collect_icons_value_segments(content: &str) -> Vec<String> {
    let mut values = Vec::new();
    let bytes = content.as_bytes();
    let mut search_start = 0;

    while let Some(position) = find_identifier(content, "icons", search_start) {
        let mut index = skip_ascii_whitespace(bytes, position + "icons".len());

        if index < bytes.len() && bytes[index] == b'?' {
            index += 1;
            index = skip_ascii_whitespace(bytes, index);
        }

        if index >= bytes.len() || bytes[index] != b':' {
            search_start = position + "icons".len();
            continue;
        }

        index = skip_ascii_whitespace(bytes, index + 1);
        if index >= bytes.len() {
            break;
        }

        match bytes[index] {
            b'\'' | b'"' => {
                if let Some((value, next_index)) = parse_quoted_string(bytes, index) {
                    values.push(value);
                    search_start = next_index;
                    continue;
                }
            }
            b'{' | b'[' => {
                if let Some((segment, next_index)) = extract_balanced_segment(bytes, index) {
                    values.push(segment);
                    search_start = next_index;
                    continue;
                }
            }
            _ => {}
        }

        search_start = position + "icons".len();
    }

    values
}

fn extract_keyed_string_values(content: &str, keys: &[&str]) -> Vec<String> {
    let mut values = Vec::new();
    let bytes = content.as_bytes();

    for key in keys {
        let mut search_start = 0;

        while let Some(position) = find_identifier(content, key, search_start) {
            let mut index = skip_ascii_whitespace(bytes, position + key.len());
            if index >= bytes.len() || bytes[index] != b':' {
                search_start = position + key.len();
                continue;
            }

            index = skip_ascii_whitespace(bytes, index + 1);
            if index >= bytes.len() {
                break;
            }

            match bytes[index] {
                b'\'' | b'"' => {
                    if let Some((value, next_index)) = parse_quoted_string(bytes, index) {
                        values.push(value);
                        search_start = next_index;
                        continue;
                    }
                }
                b'{' | b'[' => {
                    if let Some((segment, next_index)) = extract_balanced_segment(bytes, index) {
                        values.extend(extract_keyed_string_values(&segment, &["url", "href"]));
                        values.extend(
                            extract_all_quoted_string_literals(&segment)
                                .into_iter()
                                .filter(|value| is_likely_icon_literal(value)),
                        );
                        search_start = next_index;
                        continue;
                    }
                }
                _ => {}
            }

            search_start = position + key.len();
        }
    }

    values
}

fn extract_all_quoted_string_literals(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut values = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        if matches!(bytes[index], b'\'' | b'"') {
            if let Some((value, next_index)) = parse_quoted_string(bytes, index) {
                values.push(value);
                index = next_index;
                continue;
            }
        }
        index += 1;
    }

    values
}

fn extract_link_tag_icon_references(content: &str) -> Vec<String> {
    let mut refs = Vec::new();
    let mut search_start = 0;

    while let Some(offset) = content[search_start..].find("<link") {
        let tag_start = search_start + offset;
        let Some(tag_end_offset) = content[tag_start..].find('>') else {
            break;
        };
        let tag_end = tag_start + tag_end_offset + 1;
        let tag = &content[tag_start..tag_end];

        let attrs = extract_html_attributes(tag);
        let rel = attrs
            .iter()
            .find(|(name, _)| name == "rel")
            .map(|(_, value)| value.to_ascii_lowercase());
        let href = attrs
            .iter()
            .find(|(name, _)| name == "href")
            .map(|(_, value)| value.clone());

        if rel.as_deref().is_some_and(|value| value.contains("icon")) {
            if let Some(href_value) = href {
                refs.push(href_value);
            }
        }

        search_start = tag_end;
    }

    refs
}

fn extract_html_attributes(tag: &str) -> Vec<(String, String)> {
    let bytes = tag.as_bytes();
    let mut attrs = Vec::new();
    let mut index = 0;

    while index < bytes.len() {
        while index < bytes.len()
            && (bytes[index].is_ascii_whitespace()
                || matches!(bytes[index], b'<' | b'>' | b'/'))
        {
            index += 1;
        }

        if index >= bytes.len() {
            break;
        }

        let name_start = index;
        while index < bytes.len()
            && (bytes[index].is_ascii_alphanumeric() || matches!(bytes[index], b'-' | b'_' | b':'))
        {
            index += 1;
        }

        if name_start == index {
            index += 1;
            continue;
        }

        let name = tag[name_start..index].to_ascii_lowercase();
        index = skip_ascii_whitespace(bytes, index);

        if index >= bytes.len() || bytes[index] != b'=' {
            continue;
        }

        index = skip_ascii_whitespace(bytes, index + 1);
        if index >= bytes.len() {
            break;
        }

        let value = if matches!(bytes[index], b'\'' | b'"') {
            if let Some((value, next_index)) = parse_quoted_string(bytes, index) {
                index = next_index;
                value
            } else {
                break;
            }
        } else {
            let value_start = index;
            while index < bytes.len() && !bytes[index].is_ascii_whitespace() && bytes[index] != b'>' {
                index += 1;
            }
            tag[value_start..index].to_string()
        };

        attrs.push((name, value));
    }

    attrs
}

fn normalize_icon_reference_to_paths(raw_ref: &str, source_path: &Path, repo_root: &Path) -> Vec<PathBuf> {
    let Some(sanitized_ref) = sanitize_declared_icon_reference(raw_ref) else {
        return Vec::new();
    };

    let source_dir = source_path.parent().unwrap_or(repo_root);
    let mut candidates = Vec::new();
    let mut seen = HashSet::new();

    let mut add_candidate = |candidate: PathBuf| {
        if seen.insert(candidate.clone()) {
            candidates.push(candidate);
        }
    };

    if sanitized_ref.starts_with('/') {
        let web_root_relative = sanitized_ref.trim_start_matches('/');
        if let Some(normalized) = normalize_repo_relative_path(web_root_relative) {
            add_candidate(repo_root.join("public").join(&normalized));
            add_candidate(repo_root.join(&normalized));
        }
        return candidates;
    }

    if let Some(normalized) = normalize_repo_relative_path(&sanitized_ref) {
        add_candidate(source_dir.join(&normalized));
        add_candidate(repo_root.join("public").join(&normalized));
        add_candidate(repo_root.join(&normalized));
    }

    candidates
}

fn sanitize_declared_icon_reference(raw_ref: &str) -> Option<String> {
    let mut value = raw_ref.trim().trim_matches('"').trim_matches('\'').trim().to_string();
    if value.is_empty() {
        return None;
    }

    let cut_index = value.find(|ch| ch == '?' || ch == '#').unwrap_or(value.len());
    value.truncate(cut_index);
    value = value.trim().to_string();
    if value.is_empty() {
        return None;
    }

    let lowered = value.to_ascii_lowercase();
    if lowered.starts_with("http://")
        || lowered.starts_with("https://")
        || lowered.starts_with("data:")
        || lowered.starts_with("//")
        || lowered.starts_with("image/")
    {
        return None;
    }

    Some(value)
}

fn normalize_repo_relative_path(path: &str) -> Option<PathBuf> {
    use std::path::Component;

    let mut normalized = PathBuf::new();
    for component in Path::new(path).components() {
        match component {
            Component::Normal(part) => normalized.push(part),
            Component::CurDir => {}
            Component::ParentDir => {
                if !normalized.pop() {
                    return None;
                }
            }
            Component::RootDir | Component::Prefix(_) => return None,
        }
    }

    if normalized.as_os_str().is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn is_likely_icon_literal(value: &str) -> bool {
    let lowered = value.to_ascii_lowercase();
    if lowered.starts_with("image/") {
        return false;
    }

    lowered.contains("favicon")
        || lowered.contains("/icon")
        || lowered.ends_with("icon")
        || lowered.ends_with(".ico")
        || lowered.ends_with(".png")
        || lowered.ends_with(".svg")
        || lowered.ends_with(".webp")
        || lowered.ends_with(".jpg")
        || lowered.ends_with(".jpeg")
        || lowered.ends_with(".gif")
        || lowered.ends_with(".avif")
}

fn find_identifier(content: &str, token: &str, start: usize) -> Option<usize> {
    let bytes = content.as_bytes();
    let token_bytes = token.as_bytes();
    if token_bytes.is_empty() || start >= bytes.len() {
        return None;
    }

    let mut index = start;
    while index + token_bytes.len() <= bytes.len() {
        if &bytes[index..index + token_bytes.len()] == token_bytes {
            let left_boundary = index == 0 || !is_identifier_char(bytes[index - 1]);
            let right_index = index + token_bytes.len();
            let right_boundary = right_index >= bytes.len() || !is_identifier_char(bytes[right_index]);
            if left_boundary && right_boundary {
                return Some(index);
            }
        }
        index += 1;
    }

    None
}

fn is_identifier_char(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'$')
}

fn skip_ascii_whitespace(bytes: &[u8], mut index: usize) -> usize {
    while index < bytes.len() && bytes[index].is_ascii_whitespace() {
        index += 1;
    }
    index
}

fn parse_quoted_string(bytes: &[u8], start: usize) -> Option<(String, usize)> {
    if start >= bytes.len() || !matches!(bytes[start], b'\'' | b'"') {
        return None;
    }

    let quote = bytes[start];
    let mut value = String::new();
    let mut index = start + 1;
    let mut escaped = false;

    while index < bytes.len() {
        let byte = bytes[index];
        if escaped {
            value.push(byte as char);
            escaped = false;
            index += 1;
            continue;
        }

        if byte == b'\\' {
            escaped = true;
            index += 1;
            continue;
        }

        if byte == quote {
            return Some((value, index + 1));
        }

        value.push(byte as char);
        index += 1;
    }

    None
}

fn extract_balanced_segment(bytes: &[u8], start: usize) -> Option<(String, usize)> {
    if start >= bytes.len() || !matches!(bytes[start], b'{' | b'[') {
        return None;
    }

    let open = bytes[start];
    let close = if open == b'{' { b'}' } else { b']' };
    let mut depth = 0usize;
    let mut index = start;
    let mut in_quote: Option<u8> = None;
    let mut escaped = false;

    while index < bytes.len() {
        let byte = bytes[index];

        if let Some(quote) = in_quote {
            if escaped {
                escaped = false;
                index += 1;
                continue;
            }

            if byte == b'\\' {
                escaped = true;
                index += 1;
                continue;
            }

            if byte == quote {
                in_quote = None;
            }
            index += 1;
            continue;
        }

        if matches!(byte, b'\'' | b'"') {
            in_quote = Some(byte);
            index += 1;
            continue;
        }

        if byte == open {
            depth += 1;
        } else if byte == close {
            depth = depth.saturating_sub(1);
            if depth == 0 {
                let segment = String::from_utf8_lossy(&bytes[start..=index]).to_string();
                return Some((segment, index + 1));
            }
        }

        index += 1;
    }

    None
}

fn read_icon_candidate_bytes(path: &Path) -> Option<Vec<u8>> {
    if !path.is_file() {
        return None;
    }

    let meta = std::fs::metadata(path).ok()?;
    if meta.len() == 0 || meta.len() > MAX_FAVICON_FILE_SIZE {
        return None;
    }

    std::fs::read(path).ok()
}

fn mime_type_for_icon_path(path: &Path) -> Option<&'static str> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_ascii_lowercase())?;

    match extension.as_str() {
        "png" => Some("image/png"),
        "svg" => Some("image/svg+xml"),
        "ico" => Some("image/x-icon"),
        "webp" => Some("image/webp"),
        "jpg" | "jpeg" => Some("image/jpeg"),
        "gif" => Some("image/gif"),
        "avif" => Some("image/avif"),
        _ => None,
    }
}

fn is_known_default_icon(bytes: &[u8], known_default_hashes: &[&str]) -> bool {
    let hash = sha256_hex(bytes);
    known_default_hashes.iter().any(|known| known.eq_ignore_ascii_case(&hash))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    let digest = hasher.finalize();
    digest.iter().map(|byte| format!("{byte:02x}")).collect()
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
mod favicon_resolution_tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_repo_dir(label: &str) -> PathBuf {
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("time should be monotonic")
            .as_nanos();
        let path = std::env::temp_dir().join(format!(
            "vibogit-favicon-tests-{label}-{}-{now}",
            std::process::id()
        ));
        fs::create_dir_all(&path).expect("temp repo dir should be created");
        path
    }

    fn write_file(repo: &Path, relative_path: &str, bytes: &[u8]) {
        let full_path = repo.join(relative_path);
        if let Some(parent) = full_path.parent() {
            fs::create_dir_all(parent).expect("parent dir should be created");
        }
        fs::write(full_path, bytes).expect("file should be written");
    }

    fn write_text(repo: &Path, relative_path: &str, text: &str) {
        write_file(repo, relative_path, text.as_bytes());
    }

    #[test]
    fn extracts_icons_from_next_metadata_simple_string() {
        let content = r#"
            export const metadata = {
              icons: {
                icon: "/images/favicon.png",
                apple: "/images/webclip.png",
              },
            };
        "#;

        let refs = extract_next_metadata_icon_references(content);
        assert!(refs.contains(&"/images/favicon.png".to_string()));
        assert!(refs.contains(&"/images/webclip.png".to_string()));
    }

    #[test]
    fn extracts_icons_from_next_metadata_array_objects() {
        let content = r#"
            export const metadata = {
              icons: {
                icon: [
                  { url: "/images/favicon.svg", type: "image/svg+xml" },
                  { url: "/images/favicon.png", type: "image/png" },
                ],
                apple: [{ url: "/images/favicon.png", type: "image/png" }],
              },
            };
        "#;

        let refs = extract_next_metadata_icon_references(content);
        assert!(refs.contains(&"/images/favicon.svg".to_string()));
        assert!(refs.contains(&"/images/favicon.png".to_string()));
    }

    #[test]
    fn extracts_icons_from_link_tags() {
        let content = r#"
            <head>
              <link rel="icon" href="/favicon.ico" />
              <link rel='apple-touch-icon' href='/apple-touch.png' />
              <link rel="stylesheet" href="/styles.css" />
            </head>
        "#;

        let refs = extract_link_tag_icon_references(content);
        assert!(refs.contains(&"/favicon.ico".to_string()));
        assert!(refs.contains(&"/apple-touch.png".to_string()));
    }

    #[test]
    fn normalizes_declared_icon_paths_and_skips_external_refs() {
        let repo_root = PathBuf::from("/tmp/fake-repo");
        let source_file = repo_root.join("app/layout.tsx");

        let rooted = normalize_icon_reference_to_paths("/images/favicon.png", &source_file, &repo_root);
        assert_eq!(rooted[0], repo_root.join("public/images/favicon.png"));
        assert_eq!(rooted[1], repo_root.join("images/favicon.png"));

        let relative = normalize_icon_reference_to_paths("favicon.ico", &source_file, &repo_root);
        assert!(relative.contains(&repo_root.join("app/favicon.ico")));

        let external = normalize_icon_reference_to_paths("https://cdn.example.com/favicon.ico", &source_file, &repo_root);
        assert!(external.is_empty());
    }

    #[test]
    fn deprioritizes_known_default_when_custom_icon_exists() {
        let repo = temp_repo_dir("deprioritize-known-default");
        let default_bytes = b"default-template-icon";
        let custom_bytes = b"custom-icon";

        write_file(&repo, "app/favicon.ico", default_bytes);
        write_file(&repo, "public/images/favicon.png", custom_bytes);

        let default_hash = sha256_hex(default_bytes);
        let selected = select_best_icon_with_known_defaults(
            vec![repo.join("app/favicon.ico"), repo.join("public/images/favicon.png")],
            &[default_hash.as_str()],
        )
        .expect("custom icon should be selected");

        assert_eq!(selected.mime_type, "image/png");
        assert_eq!(selected.bytes, custom_bytes.to_vec());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn keeps_default_when_it_is_only_icon() {
        let repo = temp_repo_dir("only-default");
        let default_bytes = b"default-template-icon-only";
        write_file(&repo, "app/favicon.ico", default_bytes);

        let default_hash = sha256_hex(default_bytes);
        let selected = select_best_icon_with_known_defaults(
            vec![repo.join("app/favicon.ico")],
            &[default_hash.as_str()],
        )
        .expect("default icon should still be selected");

        assert_eq!(selected.mime_type, "image/x-icon");
        assert_eq!(selected.bytes, default_bytes.to_vec());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn skips_oversized_icon_file_in_favor_of_valid_small_icon() {
        let repo = temp_repo_dir("size-guard");
        write_file(
            &repo,
            "public/favicon.png",
            &vec![0_u8; (MAX_FAVICON_FILE_SIZE as usize) + 1],
        );
        write_file(&repo, "public/images/favicon.png", b"small-valid-icon");

        let selected = select_best_icon(vec![
            repo.join("public/favicon.png"),
            repo.join("public/images/favicon.png"),
        ])
        .expect("small icon should be selected");

        assert_eq!(selected.mime_type, "image/png");
        assert_eq!(selected.bytes, b"small-valid-icon".to_vec());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn prefers_browser_declared_icon_for_web_meredith_style_repo() {
        let repo = temp_repo_dir("web-meredith-style");
        let default_bytes = b"default-template-icon";
        let custom_bytes = b"meredith-custom-favicon";

        write_text(
            &repo,
            "app/layout.tsx",
            r#"
              export const metadata = {
                icons: {
                  icon: "/images/favicon.png",
                },
              };
            "#,
        );
        write_file(&repo, "app/favicon.ico", default_bytes);
        write_file(&repo, "public/images/favicon.png", custom_bytes);

        let mut candidates = collect_browser_declared_icon_candidates(&repo);
        candidates.extend(collect_fallback_icon_candidates(&repo));

        let default_hash = sha256_hex(default_bytes);
        let selected = select_best_icon_with_known_defaults(candidates, &[default_hash.as_str()])
            .expect("custom declared icon should be selected");

        assert_eq!(selected.mime_type, "image/png");
        assert_eq!(selected.bytes, custom_bytes.to_vec());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn prefers_browser_declared_icon_for_web_volume_style_repo() {
        let repo = temp_repo_dir("web-volume-style");
        let default_bytes = b"default-template-icon";
        let custom_bytes = b"volume-custom-favicon";

        write_text(
            &repo,
            "src/app/layout.tsx",
            r#"
              export const metadata = {
                icons: {
                  icon: "/webflow/favicon.png",
                },
              };
            "#,
        );
        write_file(&repo, "src/app/favicon.ico", default_bytes);
        write_file(&repo, "public/webflow/favicon.png", custom_bytes);

        let mut candidates = collect_browser_declared_icon_candidates(&repo);
        candidates.extend(collect_fallback_icon_candidates(&repo));

        let default_hash = sha256_hex(default_bytes);
        let selected = select_best_icon_with_known_defaults(candidates, &[default_hash.as_str()])
            .expect("webflow icon should be selected");

        assert_eq!(selected.mime_type, "image/png");
        assert_eq!(selected.bytes, custom_bytes.to_vec());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn prefers_app_icon_svg_when_default_favicon_is_present_but_undeclared() {
        let repo = temp_repo_dir("app-icon-svg");
        let default_bytes = b"default-template-icon";
        let custom_svg = br#"<svg xmlns="http://www.w3.org/2000/svg"></svg>"#;

        write_file(&repo, "app/favicon.ico", default_bytes);
        write_file(&repo, "app/icon.svg", custom_svg);

        let mut candidates = collect_browser_declared_icon_candidates(&repo);
        candidates.extend(collect_fallback_icon_candidates(&repo));

        let default_hash = sha256_hex(default_bytes);
        let selected = select_best_icon_with_known_defaults(candidates, &[default_hash.as_str()])
            .expect("app icon svg should be selected");

        assert_eq!(selected.mime_type, "image/svg+xml");
        assert_eq!(selected.bytes, custom_svg.to_vec());

        let _ = fs::remove_dir_all(repo);
    }

    #[test]
    fn returns_none_when_no_icon_files_exist() {
        let repo = temp_repo_dir("no-icons");
        let mut candidates = collect_browser_declared_icon_candidates(&repo);
        candidates.extend(collect_fallback_icon_candidates(&repo));

        assert!(select_best_icon(candidates).is_none());

        let _ = fs::remove_dir_all(repo);
    }
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

// Dev Server Diagnostics

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DevServerDiagnosis {
    pub process_alive: bool,
    pub port_listening: bool,
    pub last_logs: Vec<String>,
    pub problem: String,
    pub suggestion: String,
    pub suggested_command: Option<String>,
    pub diagnosis_code: String,
}

#[tauri::command]
pub async fn dev_server_diagnose(
    path: String,
    port: u16,
    app: AppHandle,
) -> Result<DevServerDiagnosis, String> {
    let project_path = PathBuf::from(&path);

    // Filesystem checks (priority order)
    let package_json_path = project_path.join("package.json");
    if !package_json_path.exists() {
        return Ok(DevServerDiagnosis {
            process_alive: false,
            port_listening: false,
            last_logs: vec![],
            problem: "No package.json found in this directory".to_string(),
            suggestion: "Make sure you've opened the correct project folder. This directory doesn't appear to be a Node.js project.".to_string(),
            suggested_command: None,
            diagnosis_code: "no_package_json".to_string(),
        });
    }

    // Check for dev script
    let has_dev_script = if let Ok(content) = std::fs::read_to_string(&package_json_path) {
        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
            json.get("scripts")
                .and_then(|s| s.get("dev"))
                .is_some()
        } else {
            false
        }
    } else {
        false
    };

    if !has_dev_script {
        return Ok(DevServerDiagnosis {
            process_alive: false,
            port_listening: false,
            last_logs: vec![],
            problem: "No 'dev' script found in package.json".to_string(),
            suggestion: "Add a \"dev\" script to your package.json, for example: \"dev\": \"next dev\" or \"dev\": \"vite\"".to_string(),
            suggested_command: None,
            diagnosis_code: "no_dev_script".to_string(),
        });
    }

    if !project_path.join("node_modules").exists() {
        return Ok(DevServerDiagnosis {
            process_alive: false,
            port_listening: false,
            last_logs: vec![],
            problem: "Dependencies aren't installed yet".to_string(),
            suggestion: "Run bun install in your project directory to install the packages your app needs.".to_string(),
            suggested_command: Some("bun install".to_string()),
            diagnosis_code: "no_node_modules".to_string(),
        });
    }

    // Get process state and logs from DevServerManager
    let mut process_alive = false;
    let mut port_listening = false;
    let mut last_logs: Vec<String> = vec![];

    let manager = app.try_state::<DevServerManager>();
    if let Some(manager) = manager {
        let servers = manager.servers.lock().unwrap();
        if let Some(server) = servers.get(&path) {
            // Check process alive
            process_alive = server.child.as_ref()
                .map(|c| {
                    let mut cmd = Command::new("kill");
                    cmd.args(["-0", &c.id().to_string()]);
                    cmd.output().map(|o| o.status.success()).unwrap_or(false)
                })
                .unwrap_or(false);

            // Check port listening
            port_listening = {
                use std::net::TcpStream;
                use std::time::Duration;
                TcpStream::connect_timeout(
                    &format!("127.0.0.1:{}", port).parse().unwrap(),
                    Duration::from_millis(500),
                ).is_ok()
            };

            // Get last 20 log lines
            if let Ok(logs) = server.logs.lock() {
                let len = logs.len();
                let start = if len > 20 { len - 20 } else { 0 };
                last_logs = logs[start..].to_vec();
            }
        }
    }

    // Log pattern matching (priority order)
    let log_text = last_logs.join("\n");

    if !process_alive && (last_logs.is_empty() || log_text.contains("ENOENT") || log_text.contains("not found") || log_text.contains("command not found")) {
        if last_logs.is_empty() || log_text.contains("ENOENT") || log_text.contains("command not found") {
            return Ok(DevServerDiagnosis {
                process_alive,
                port_listening,
                last_logs,
                problem: "Couldn't find the dev command on your system".to_string(),
                suggestion: "Make sure your package manager (bun, npm, etc.) is installed and available in your PATH.".to_string(),
                suggested_command: None,
                diagnosis_code: "command_not_found".to_string(),
            });
        }
    }

    if log_text.contains("EADDRINUSE") || log_text.contains("address already in use") {
        return Ok(DevServerDiagnosis {
            process_alive,
            port_listening,
            last_logs,
            problem: format!("Port {} is already being used by another app", port),
            suggestion: "Close the other process using this port, or change your dev server port.".to_string(),
            suggested_command: Some(format!("lsof -ti:{} | xargs kill", port)),
            diagnosis_code: "port_in_use".to_string(),
        });
    }

    if log_text.contains("MODULE_NOT_FOUND") || log_text.contains("Cannot find module") || log_text.contains("Module not found") {
        return Ok(DevServerDiagnosis {
            process_alive,
            port_listening,
            last_logs,
            problem: "Some packages are missing".to_string(),
            suggestion: "Install your project's dependencies to fix the missing modules.".to_string(),
            suggested_command: Some("bun install".to_string()),
            diagnosis_code: "missing_deps".to_string(),
        });
    }

    if log_text.contains("SyntaxError") || log_text.contains("TypeError") || log_text.contains("ReferenceError") || log_text.contains("error TS") || log_text.contains("Build error") || log_text.contains("Failed to compile") {
        return Ok(DevServerDiagnosis {
            process_alive,
            port_listening,
            last_logs,
            problem: "Your code has errors that crashed the server".to_string(),
            suggestion: "Check the logs below for the specific error and fix it in your code.".to_string(),
            suggested_command: None,
            diagnosis_code: "script_error".to_string(),
        });
    }

    // Process + port state checks
    if process_alive && !port_listening {
        return Ok(DevServerDiagnosis {
            process_alive,
            port_listening,
            last_logs,
            problem: format!("Server started but isn't responding on port {}", port),
            suggestion: "Your framework may use a different port. Check your config file (next.config.js, vite.config.ts, etc.) or try waiting a bit longer for large projects.".to_string(),
            suggested_command: None,
            diagnosis_code: "wrong_port".to_string(),
        });
    }

    if !process_alive && !last_logs.is_empty() {
        return Ok(DevServerDiagnosis {
            process_alive,
            port_listening,
            last_logs,
            problem: "The dev server stopped unexpectedly".to_string(),
            suggestion: "Check the logs below for details about what went wrong.".to_string(),
            suggested_command: None,
            diagnosis_code: "process_crashed".to_string(),
        });
    }

    // Fallback
    Ok(DevServerDiagnosis {
        process_alive,
        port_listening,
        last_logs,
        problem: "Something went wrong".to_string(),
        suggestion: "Check the dev server logs for more information about the error.".to_string(),
        suggested_command: None,
        diagnosis_code: "unknown".to_string(),
    })
}

// AI Dev Server Diagnostics

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiDiagnoseResponse {
    pub commands: Vec<String>,
}

#[tauri::command]
pub async fn ai_diagnose_dev_server(
    provider: String,
    model: String,
    api_key: String,
    path: String,
    command: String,
    command_args: Vec<String>,
    port: u16,
    diagnosis_code: String,
    problem: String,
    last_logs: Vec<String>,
) -> Result<AiDiagnoseResponse, String> {
    let logs_text = last_logs.join("\n");
    let prompt = format!(
        "My dev server failed to start. Here's the context:\n\
        - Project path: {}\n\
        - Command: {} {}\n\
        - Port: {}\n\
        - Diagnosis: {} - {}\n\
        - Last logs:\n{}\n\n\
        What terminal command(s) should I run to fix this? Reply with ONLY the command(s), one per line, no explanation.",
        path, command, command_args.join(" "), port, diagnosis_code, problem, logs_text
    );

    let client = reqwest::Client::new();

    let response_text = match provider.as_str() {
        "anthropic" => {
            let body = serde_json::json!({
                "model": &model,
                "max_tokens": 300,
                "messages": [{ "role": "user", "content": prompt }]
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
            json["content"][0]["text"].as_str().unwrap_or("").to_string()
        }
        "openai" => {
            let body = serde_json::json!({
                "model": &model,
                "max_tokens": 300,
                "messages": [{ "role": "user", "content": prompt }]
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
            json["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string()
        }
        "gemini" => {
            let url = format!(
                "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent?key={}",
                model, api_key
            );
            let body = serde_json::json!({
                "contents": [{ "parts": [{ "text": prompt }] }],
                "generationConfig": { "maxOutputTokens": 300 }
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
            json["candidates"][0]["content"]["parts"][0]["text"].as_str().unwrap_or("").to_string()
        }
        _ => return Err(format!("Unknown provider: {}", provider)),
    };

    // Parse response: one command per line, strip markdown code blocks
    let mut text = response_text.trim().to_string();
    if text.starts_with("```") {
        text = text
            .trim_start_matches(|c: char| c == '`' || c.is_alphabetic() || c == '\n')
            .trim_end_matches('`')
            .trim()
            .to_string();
    }

    let commands: Vec<String> = text
        .lines()
        .map(|l| l.trim().to_string())
        .filter(|l| !l.is_empty() && !l.starts_with('#') && !l.starts_with("//"))
        .collect();

    Ok(AiDiagnoseResponse { commands })
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
