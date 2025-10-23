// 👾 Daebug Remote REPL - Rust + WASM implementation
//
// Design: The same WASM module is loaded in three different contexts:
// 1. Node.js server - Full orchestration (HTTP, file watching, registry)
// 2. Browser page - Client REPL execution
// 3. Web worker - Isolated REPL execution
//
// A small JS bootstrap disambiguates by passing a runtime flag.

pub mod server;
pub mod parser;
pub mod registry;
pub mod job;
pub mod watcher;
pub mod writer;
pub mod runtime;

#[cfg(target_family = "wasm")]
pub mod wasm;

pub use server::Server;
pub use parser::parse_request;
pub use registry::Registry;
pub use job::Job;
pub use runtime::{RuntimeContext, init_runtime};

/// Version of the Daebug server
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
