use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use serde::Serialize;
use std::path::Path;
use std::sync::mpsc::{channel, Sender};
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Serialize, Clone)]
pub struct FileChangeEvent {
    pub paths: Vec<String>,
    pub kind: String,
}

pub struct WatcherHandle {
    stop_tx: Sender<()>,
}

impl WatcherHandle {
    pub fn stop(self) {
        let _ = self.stop_tx.send(());
    }
}

pub fn start_watcher(path: &str, app: AppHandle) -> Result<WatcherHandle, String> {
    let path = path.to_string();
    let (stop_tx, stop_rx) = channel();

    thread::spawn(move || {
        let (tx, rx) = channel();

        let mut debouncer = match new_debouncer(Duration::from_millis(100), tx) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("Failed to create debouncer: {}", e);
                return;
            }
        };

        let watch_path = Path::new(&path);
        if let Err(e) = debouncer.watcher().watch(watch_path, RecursiveMode::Recursive) {
            eprintln!("Failed to watch path: {}", e);
            return;
        }

        loop {
            // Check for stop signal
            if stop_rx.try_recv().is_ok() {
                break;
            }

            // Check for file events
            match rx.recv_timeout(Duration::from_millis(100)) {
                Ok(Ok(events)) => {
                    let paths: Vec<String> = events
                        .iter()
                        .filter_map(|e| {
                            let path_str = e.path.to_string_lossy().to_string();
                            // Filter out .git directory
                            if path_str.contains("/.git/") || path_str.contains("\\.git\\") {
                                None
                            } else {
                                Some(path_str)
                            }
                        })
                        .collect();

                    if !paths.is_empty() {
                        let event = FileChangeEvent {
                            paths,
                            kind: "change".to_string(),
                        };

                        let _ = app.emit("file:change", event);
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Watch error: {:?}", e);
                }
                Err(_) => {
                    // Timeout, continue loop
                }
            }
        }
    });

    Ok(WatcherHandle { stop_tx })
}
