use notify::RecursiveMode;
use notify_debouncer_mini::new_debouncer;
use serde::Serialize;
use std::path::Path;
use std::collections::HashSet;
use std::sync::mpsc::{channel, Sender};
use std::thread;
use std::time::{Duration, Instant};
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

const WATCHER_DEBOUNCE_MS: u64 = 300;
const WATCHER_COALESCE_MS: u64 = 500;
const IGNORED_COMPONENTS: [&str; 11] = [
    ".git",
    "node_modules",
    ".next",
    "dist",
    "build",
    "out",
    "target",
    ".turbo",
    ".cache",
    "coverage",
    ".DS_Store",
];

fn should_ignore_path(path: &Path) -> bool {
    path.components().any(|component| {
        let value = component.as_os_str().to_string_lossy();
        IGNORED_COMPONENTS.iter().any(|ignored| value == *ignored)
    })
}

pub fn start_watcher(path: &str, app: AppHandle) -> Result<WatcherHandle, String> {
    let path = path.to_string();
    let (stop_tx, stop_rx) = channel();
    let debug_power = std::env::var("VIBOGIT_DEBUG_POWER")
        .map(|value| matches!(value.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false);

    thread::spawn(move || {
        let (tx, rx) = channel();
        let mut pending_paths = HashSet::new();
        let mut coalesce_deadline: Option<Instant> = None;
        let mut watcher_events_received: u64 = 0;
        let mut watcher_events_filtered: u64 = 0;

        let mut debouncer = match new_debouncer(Duration::from_millis(WATCHER_DEBOUNCE_MS), tx) {
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
                    watcher_events_received += events.len() as u64;

                    for event in events {
                        if should_ignore_path(&event.path) {
                            watcher_events_filtered += 1;
                            continue;
                        }
                        pending_paths.insert(event.path.to_string_lossy().to_string());
                    }

                    if !pending_paths.is_empty() && coalesce_deadline.is_none() {
                        coalesce_deadline =
                            Some(Instant::now() + Duration::from_millis(WATCHER_COALESCE_MS));
                    }

                    if debug_power && watcher_events_received > 0 && watcher_events_received % 200 == 0 {
                        eprintln!(
                            "[PowerDebug][watcher] received={} filtered={} pending={}",
                            watcher_events_received,
                            watcher_events_filtered,
                            pending_paths.len()
                        );
                    }
                }
                Ok(Err(e)) => {
                    eprintln!("Watch error: {:?}", e);
                }
                Err(_) => {
                    // Timeout, continue loop
                }
            }

            if !pending_paths.is_empty()
                && coalesce_deadline.is_some_and(|deadline| Instant::now() >= deadline)
            {
                let event = FileChangeEvent {
                    paths: pending_paths.drain().collect(),
                    kind: "change".to_string(),
                };
                coalesce_deadline = None;
                let _ = app.emit("file:change", event);
            }
        }
    });

    Ok(WatcherHandle { stop_tx })
}
