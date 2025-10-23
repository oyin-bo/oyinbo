// 👾 Daebug Remote REPL - Rust + WASM implementation

pub mod server;
pub mod parser;
pub mod registry;
pub mod job;
pub mod watcher;
pub mod writer;

pub use server::Server;
pub use parser::parse_request;
pub use registry::Registry;
pub use job::Job;

/// Version of the Daebug server
pub const VERSION: &str = env!("CARGO_PKG_VERSION");
