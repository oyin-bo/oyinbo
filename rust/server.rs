// HTTP server using axum

use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use crate::{job::JobManager, registry::Registry, writer::Writer};

pub struct Server {
    root: PathBuf,
    port: u16,
    registry: Arc<Registry>,
    job_manager: Arc<JobManager>,
    writer: Arc<Writer>,
}

#[derive(Clone)]
struct AppState {
    registry: Arc<Registry>,
    job_manager: Arc<JobManager>,
    writer: Arc<Writer>,
}

#[derive(Deserialize)]
struct PollParams {
    name: String,
    url: String,
}

#[derive(Serialize)]
struct PollResponse {
    code: Option<String>,
    job_id: Option<String>,
}

#[derive(Deserialize)]
struct ResultPayload {
    job_id: String,
    ok: bool,
    value: Option<serde_json::Value>,
    error: Option<String>,
}

impl Server {
    pub fn new(root: impl Into<PathBuf>, port: u16) -> Result<Self, Box<dyn std::error::Error>> {
        let root = root.into();
        Ok(Server {
            registry: Arc::new(Registry::new(root.clone())),
            job_manager: Arc::new(JobManager::new()),
            writer: Arc::new(Writer::new(root.clone())),
            root,
            port,
        })
    }

    pub async fn run(self) -> Result<(), Box<dyn std::error::Error>> {
        let state = AppState {
            registry: self.registry.clone(),
            job_manager: self.job_manager.clone(),
            writer: self.writer.clone(),
        };

        let app = Router::new()
            .route("/health", get(health_handler))
            .route("/daebug", get(poll_handler).post(result_handler))
            .route("/daebug.md", get(registry_handler))
            .with_state(state);

        let addr = SocketAddr::from(([127, 0, 0, 1], self.port));
        println!("👾Daebug v{} listening on http://{}/", crate::VERSION, addr);

        let listener = tokio::net::TcpListener::bind(addr).await?;
        axum::serve(listener, app).await?;

        Ok(())
    }
}

async fn health_handler() -> &'static str {
    "👾 Daebug is running"
}

async fn poll_handler(
    Query(params): Query<PollParams>,
    State(state): State<AppState>,
) -> Json<PollResponse> {
    // Register or update page
    let _page = state.registry.get_or_create(&params.name, &params.url);

    // Check for pending jobs
    if let Some(job) = state.job_manager.get_by_page(&params.name) {
        Json(PollResponse {
            code: Some(job.code),
            job_id: Some(job.id),
        })
    } else {
        Json(PollResponse {
            code: None,
            job_id: None,
        })
    }
}

async fn result_handler(
    State(state): State<AppState>,
    Json(payload): Json<ResultPayload>,
) -> StatusCode {
    // Write result to file
    let result_str = if payload.ok {
        serde_json::to_string_pretty(&payload.value).unwrap_or_default()
    } else {
        payload.error.unwrap_or_default()
    };

    // Get job to find page name
    if let Some(job) = state.job_manager.get(&payload.job_id) {
        // Write reply
        if let Err(e) = state.writer.write_reply(&job.page_name, &result_str, 0) {
            eprintln!("Error writing reply: {}", e);
            return StatusCode::INTERNAL_SERVER_ERROR;
        }

        // Update job state
        state
            .job_manager
            .update_state(&payload.job_id, crate::job::JobState::Finished);
    }

    StatusCode::OK
}

async fn registry_handler(State(state): State<AppState>) -> String {
    let pages = state.registry.list_pages();
    let mut output = String::from("# 👾Daebug Registry\n\n");

    for page in pages {
        output.push_str(&format!(
            "- **{}** - {} - {:?}\n",
            page.name, page.url, page.state
        ));
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_server_create() {
        let server = Server::new(".", 8342);
        assert!(server.is_ok());
    }
}
