// Registry management for tracking active pages and realms

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::SystemTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Page {
    pub name: String,
    pub url: String,
    pub last_seen: u64,
    pub state: PageState,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum PageState {
    Idle,
    Executing,
    Failed,
}

pub struct Registry {
    pages: Arc<RwLock<HashMap<String, Page>>>,
    root: PathBuf,
}

impl Registry {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Registry {
            pages: Arc::new(RwLock::new(HashMap::new())),
            root: root.into(),
        }
    }

    pub fn get_or_create(&self, name: &str, url: &str) -> Page {
        let mut pages = self.pages.write().unwrap();
        
        pages.entry(name.to_string()).or_insert_with(|| {
            Page {
                name: name.to_string(),
                url: url.to_string(),
                last_seen: Self::current_time(),
                state: PageState::Idle,
            }
        }).clone()
    }

    pub fn update_state(&self, name: &str, state: PageState) {
        let mut pages = self.pages.write().unwrap();
        if let Some(page) = pages.get_mut(name) {
            page.state = state;
            page.last_seen = Self::current_time();
        }
    }

    pub fn list_pages(&self) -> Vec<Page> {
        let pages = self.pages.read().unwrap();
        pages.values().cloned().collect()
    }

    fn current_time() -> u64 {
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_registry_create() {
        let registry = Registry::new(".");
        let page = registry.get_or_create("test-page", "http://localhost:8080");
        
        assert_eq!(page.name, "test-page");
        assert_eq!(page.url, "http://localhost:8080");
        assert_eq!(page.state, PageState::Idle);
    }

    #[test]
    fn test_registry_update_state() {
        let registry = Registry::new(".");
        registry.get_or_create("test-page", "http://localhost:8080");
        registry.update_state("test-page", PageState::Executing);
        
        let pages = registry.list_pages();
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].state, PageState::Executing);
    }
}
