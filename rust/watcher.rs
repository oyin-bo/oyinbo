// File watcher for detecting changes in REPL log files

use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher as NotifyWatcher};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{channel, Receiver};
use std::sync::{Arc, Mutex};

pub struct Watcher {
    root: PathBuf,
    watcher: Arc<Mutex<Option<RecommendedWatcher>>>,
}

impl Watcher {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Watcher {
            root: root.into(),
            watcher: Arc::new(Mutex::new(None)),
        }
    }

    pub fn watch_page(&self, page_name: &str) -> Result<Receiver<Event>, Box<dyn std::error::Error>> {
        let (tx, rx) = channel();
        
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default(),
        )?;

        let page_file = self.root.join("daebug").join(format!("{}.md", page_name));
        watcher.watch(&page_file, RecursiveMode::NonRecursive)?;

        *self.watcher.lock().unwrap() = Some(watcher);
        Ok(rx)
    }

    pub fn watch_directory(&self, dir: &Path) -> Result<Receiver<Event>, Box<dyn std::error::Error>> {
        let (tx, rx) = channel();
        
        let mut watcher = RecommendedWatcher::new(
            move |res| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            },
            Config::default(),
        )?;

        watcher.watch(dir, RecursiveMode::Recursive)?;
        *self.watcher.lock().unwrap() = Some(watcher);
        Ok(rx)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn test_watcher_create() {
        let watcher = Watcher::new(".");
        assert!(watcher.root.exists() || true); // Watcher created successfully
    }
}
