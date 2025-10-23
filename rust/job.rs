// Job lifecycle management

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, SystemTime};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub page_name: String,
    pub agent: String,
    pub code: String,
    pub state: JobState,
    pub started_at: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobState {
    Requested,
    Dispatched,
    Started,
    Finished,
    Failed,
    Timeout,
}

pub struct JobManager {
    jobs: Arc<RwLock<HashMap<String, Job>>>,
}

impl JobManager {
    pub fn new() -> Self {
        JobManager {
            jobs: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub fn create(&self, page_name: &str, agent: &str, code: &str) -> Job {
        let id = Self::generate_id();
        let job = Job {
            id: id.clone(),
            page_name: page_name.to_string(),
            agent: agent.to_string(),
            code: code.to_string(),
            state: JobState::Requested,
            started_at: Self::current_time(),
        };

        let mut jobs = self.jobs.write().unwrap();
        jobs.insert(id, job.clone());
        job
    }

    pub fn get(&self, id: &str) -> Option<Job> {
        let jobs = self.jobs.read().unwrap();
        jobs.get(id).cloned()
    }

    pub fn get_by_page(&self, page_name: &str) -> Option<Job> {
        let jobs = self.jobs.read().unwrap();
        jobs.values()
            .find(|j| j.page_name == page_name && j.state == JobState::Dispatched)
            .cloned()
    }

    pub fn update_state(&self, id: &str, state: JobState) {
        let mut jobs = self.jobs.write().unwrap();
        if let Some(job) = jobs.get_mut(id) {
            job.state = state;
        }
    }

    pub fn remove(&self, id: &str) {
        let mut jobs = self.jobs.write().unwrap();
        jobs.remove(id);
    }

    fn generate_id() -> String {
        use std::time::UNIX_EPOCH;
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis();
        format!("job-{}", timestamp)
    }

    fn current_time() -> u64 {
        SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }
}

impl Default for JobManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_job_create() {
        let manager = JobManager::new();
        let job = manager.create("test-page", "agent", "console.log('test')");
        
        assert_eq!(job.page_name, "test-page");
        assert_eq!(job.agent, "agent");
        assert_eq!(job.state, JobState::Requested);
    }

    #[test]
    fn test_job_lifecycle() {
        let manager = JobManager::new();
        let job = manager.create("test-page", "agent", "console.log('test')");
        
        manager.update_state(&job.id, JobState::Dispatched);
        let updated = manager.get(&job.id).unwrap();
        assert_eq!(updated.state, JobState::Dispatched);
        
        manager.remove(&job.id);
        assert!(manager.get(&job.id).is_none());
    }
}
