// Writer module for in-place editing of REPL logs using markdown-rs

use crate::parser::parse_file_ast;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;

pub struct Writer {
    root: PathBuf,
    locks: Arc<Mutex<HashMap<String, Arc<Mutex<()>>>>>,
}

impl Writer {
    pub fn new(root: impl Into<PathBuf>) -> Self {
        Writer {
            root: root.into(),
            locks: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Write a reply to a page's REPL log
    /// Uses full-file parsing to locate the correct insertion point
    pub fn write_reply(
        &self,
        page_name: &str,
        result: &str,
        duration_ms: u64,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let lock = self.get_lock(page_name);
        let _guard = lock.lock().unwrap();

        let file_path = self.root.join("daebug").join(format!("{}.md", page_name));
        let content = fs::read_to_string(&file_path).unwrap_or_default();

        // Parse the current file
        let ast = parse_file_ast(&content)?;

        // Generate reply content
        let reply = format!(
            "\n#### 👍{} to agent at {} ({}ms)\n```JSON\n{}\n```\n\n",
            page_name,
            Self::current_time_str(),
            duration_ms,
            result
        );

        // For now, simple append - full implementation would do AST-based insertion
        let new_content = content + &reply;
        
        fs::write(&file_path, new_content)?;
        Ok(())
    }

    /// Update test results in-place rather than appending
    /// This prevents unbounded log growth
    pub fn update_test_results(
        &self,
        page_name: &str,
        results: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let lock = self.get_lock(page_name);
        let _guard = lock.lock().unwrap();

        let file_path = self.root.join("daebug").join(format!("{}.md", page_name));
        let content = fs::read_to_string(&file_path).unwrap_or_default();

        // Parse to find test results section
        let ast = parse_file_ast(&content)?;

        // Find and replace test results section (simplified)
        // Full implementation would locate specific heading and replace its content
        let marker = "## Test Results";
        if let Some(pos) = content.find(marker) {
            // Find next section or end of file
            let after_marker = &content[pos..];
            if let Some(next_section) = after_marker.find("\n## ") {
                let before = &content[..pos];
                let after = &after_marker[next_section..];
                let new_content = format!("{}{}\n{}\n{}", before, marker, results, after);
                fs::write(&file_path, new_content)?;
            } else {
                // Test results is the last section
                let new_content = format!("{}{}\n{}\n", &content[..pos], marker, results);
                fs::write(&file_path, new_content)?;
            }
        } else {
            // No test results section yet, append
            let new_content = format!("{}\n{}\n{}\n", content, marker, results);
            fs::write(&file_path, new_content)?;
        }

        Ok(())
    }

    fn get_lock(&self, page_name: &str) -> Arc<Mutex<()>> {
        let mut locks = self.locks.lock().unwrap();
        locks
            .entry(page_name.to_string())
            .or_insert_with(|| Arc::new(Mutex::new(())))
            .clone()
    }

    fn current_time_str() -> String {
        use std::time::SystemTime;
        let now = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs();
        
        let hours = (now / 3600) % 24;
        let minutes = (now / 60) % 60;
        let seconds = now % 60;
        format!("{:02}:{:02}:{:02}", hours, minutes, seconds)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_writer_create() {
        let writer = Writer::new(".");
        // Writer created successfully
    }
}
