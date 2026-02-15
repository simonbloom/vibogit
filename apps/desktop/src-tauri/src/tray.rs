use crate::commands::ProjectInfo;
use crate::git;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

pub fn setup_tray<R: Runtime>(app: &tauri::App<R>) -> Result<(), Box<dyn std::error::Error>> {
    let menu = build_tray_menu(app.handle(), None)?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        })
        .build(app)?;

    Ok(())
}

fn build_tray_menu<R: Runtime>(
    app: &AppHandle<R>,
    project: Option<&ProjectInfo>,
) -> Result<Menu<R>, Box<dyn std::error::Error>> {
    let menu = Menu::new(app)?;

    // Project info header
    if let Some(proj) = project {
        let status = git::get_status(&proj.path).ok();
        let changes = status
            .as_ref()
            .map(|s| s.changed_files.len() + s.untracked_files.len())
            .unwrap_or(0);
        let branch = status
            .as_ref()
            .map(|s| s.branch.clone())
            .unwrap_or_else(|| "unknown".to_string());

        let header_text = format!("{} · {} changes · {}", proj.name, changes, branch);
        let header = MenuItem::with_id(app, "project_header", header_text, false, None::<&str>)?;
        menu.append(&header)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;

        // Quick actions
        let save = MenuItem::with_id(app, "quick_save", "⚡ Quick Save", true, Some("CmdOrCtrl+S"))?;
        let ship = MenuItem::with_id(app, "quick_ship", "🚀 Quick Ship", true, Some("CmdOrCtrl+Shift+S"))?;
        menu.append(&save)?;
        menu.append(&ship)?;
        menu.append(&PredefinedMenuItem::separator(app)?)?;

        // Open actions
        let open_window = MenuItem::with_id(app, "open_window", "📂 Open Window", true, None::<&str>)?;
        let open_editor = MenuItem::with_id(app, "open_editor", "💻 Open in Editor", true, None::<&str>)?;
        let open_finder = MenuItem::with_id(app, "open_finder", "📁 Open in Finder", true, None::<&str>)?;
        let open_terminal = MenuItem::with_id(app, "open_terminal", "🖥 Open in Terminal", true, None::<&str>)?;
        menu.append(&open_window)?;
        menu.append(&open_editor)?;
        menu.append(&open_finder)?;
        menu.append(&open_terminal)?;
    } else {
        let no_project = MenuItem::with_id(app, "no_project", "No project selected", false, None::<&str>)?;
        let open_project = MenuItem::with_id(app, "open_project", "Open Project...", true, None::<&str>)?;
        menu.append(&no_project)?;
        menu.append(&open_project)?;
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Settings
    let preferences = MenuItem::with_id(app, "preferences", "⚙️ Preferences...", true, Some("CmdOrCtrl+,"))?;
    let check_updates = MenuItem::with_id(app, "check_updates", "🔄 Check for Updates", true, None::<&str>)?;
    menu.append(&preferences)?;
    menu.append(&check_updates)?;

    menu.append(&PredefinedMenuItem::separator(app)?)?;

    // Quit
    let quit = MenuItem::with_id(app, "quit", "Quit ViboGit", true, Some("CmdOrCtrl+Q"))?;
    menu.append(&quit)?;

    Ok(menu)
}

pub fn update_tray_menu<R: Runtime>(app: &AppHandle<R>, project: Option<&ProjectInfo>) {
    if let Ok(menu) = build_tray_menu(app, project) {
        if let Some(tray) = app.tray_by_id("main") {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

fn handle_menu_event<R: Runtime>(app: &AppHandle<R>, event_id: &str) {
    match event_id {
        "quick_save" => {
            // Emit event to trigger save from frontend
            let _ = app.emit("tray:quick-save", ());
        }
        "quick_ship" => {
            // Emit event to trigger ship from frontend
            let _ = app.emit("tray:quick-ship", ());
        }
        "open_window" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "open_editor" => {
            if let Some(state) = app.try_state::<crate::commands::AppState>() {
                if let Some(path) = state.current_project.lock().unwrap().clone() {
                    let _ = tauri::async_runtime::spawn(async move {
                        let _ = crate::commands::open_in_editor(path).await;
                    });
                }
            }
        }
        "open_finder" => {
            if let Some(state) = app.try_state::<crate::commands::AppState>() {
                if let Some(path) = state.current_project.lock().unwrap().clone() {
                    let _ = tauri::async_runtime::spawn(async move {
                        let _ = crate::commands::open_in_finder(path).await;
                    });
                }
            }
        }
        "open_terminal" => {
            if let Some(state) = app.try_state::<crate::commands::AppState>() {
                if let Some(path) = state.current_project.lock().unwrap().clone() {
                    let _ = tauri::async_runtime::spawn(async move {
                        let _ = crate::commands::open_in_terminal(path).await;
                    });
                }
            }
        }
        "open_project" => {
            // Emit event to trigger folder picker from frontend
            let _ = app.emit("tray:open-project", ());
        }
        "preferences" => {
            // TODO: Open preferences window or emit event
            let _ = app.emit("tray:preferences", ());
        }
        "check_updates" => {
            // TODO: Trigger update check
            let _ = app.emit("tray:check-updates", ());
        }
        "quit" => {
            app.exit(0);
        }
        _ => {}
    }
}
