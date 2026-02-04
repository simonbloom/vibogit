mod commands;
mod git;
mod tray;
mod watcher;

use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut};

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .macos_launcher(MacosLauncher::LaunchAgent)
                .build(),
        )
        .setup(|app| {
            // Set up system tray
            tray::setup_tray(app)?;

            // Initialize app state
            let app_handle = app.handle().clone();
            commands::init_state(&app_handle);

            // Initialize dev server manager
            app.manage(commands::DevServerManager::default());

            // Register global shortcuts
            let save_shortcut = Shortcut::new(Some(Modifiers::SUPER), Code::KeyS);
            let ship_shortcut = Shortcut::new(Some(Modifiers::SUPER | Modifiers::SHIFT), Code::KeyS);

            let app_handle_save = app.handle().clone();
            let app_handle_ship = app.handle().clone();

            app.global_shortcut().on_shortcut(save_shortcut, move |_app, _shortcut, _event| {
                let _ = app_handle_save.emit("shortcut:save", ());
            })?;

            app.global_shortcut().on_shortcut(ship_shortcut, move |_app, _shortcut, _event| {
                let _ = app_handle_ship.emit("shortcut:ship", ());
            })?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Git commands
            commands::git_status,
            commands::git_save,
            commands::git_ship,
            commands::git_sync,
            commands::git_log,
            commands::git_diff,
            commands::git_stage,
            commands::git_unstage,
            commands::git_checkout,
            commands::git_create_branch,
            commands::git_branches,
            commands::git_remotes,
            commands::git_stash_save,
            commands::git_stash_pop,
            commands::git_file_diff,
            commands::git_init,
            // Project commands
            commands::set_project,
            commands::list_recent_projects,
            commands::add_project_folder,
            commands::get_current_project,
            commands::is_git_repo,
            // File commands
            commands::list_files,
            commands::read_file,
            commands::get_favicon,
            // Launcher commands
            commands::open_in_browser,
            commands::open_in_editor,
            commands::open_in_terminal,
            commands::open_in_finder,
            commands::open_editor_with_app,
            commands::open_terminal_with_app,
            commands::send_to_terminal,
            // Dev server commands
            commands::dev_server_detect,
            commands::dev_server_start,
            commands::dev_server_stop,
            commands::dev_server_state,
            commands::kill_port,
            commands::cleanup_dev_locks,
            // Agents config commands
            commands::read_agents_config,
            commands::write_agents_config,
            // Skills commands
            commands::list_skills,
            // Autostart commands
            commands::is_autostart_enabled,
            commands::set_autostart,
            // Notification commands
            commands::send_notification,
            commands::notify_save_success,
            commands::notify_ship_success,
            commands::notify_error,
            // Config commands
            commands::get_config,
            commands::set_config,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ViboGit");
}
