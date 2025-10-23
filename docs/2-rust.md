# Rust + WASM for npm distribution

Purpose

This document describes the vision for a Rust implementation of 👾Daebug, compiled to WebAssembly and distributed via npm as a drop-in replacement for the current JavaScript version. The Rust implementation serves as the orchestration layer and HTTP server for the file-based Markdown REPL (see `docs/1-jsrepl.md`), while JavaScript execution continues in host runtimes (browser main thread, web workers, Node). Rust provides reliable server-side behaviour, deterministic file handling, and strong concurrency/IO guarantees, distributed universally via WASM.

## Evolution Since Original Vision

The current JavaScript implementation has matured significantly:

**Implemented Features** (must be preserved in Rust):
- **npx distribution**: Global CLI tool (`npx daebug`) with intelligent port derivation
- **Background event capture**: Real-time console logs, errors, and promise rejections with streaming
- **Test runner**: `--test` flag for running browser-based test suites with progress updates
- **Rich Markdown formatting**: Hierarchical heading structure with outline navigation
- **Dynamic executing regions**: Real-time placeholder updates showing job progress
- **Worker realm support**: Automatic web worker creation with independent REPL sessions
- **Multi-page orchestration**: Single server managing multiple browser contexts

**Conceptual Features** (documented but not yet built):
- **Build tool plugins**: Architecture for esbuild and Vite integration (see `docs/1.6-esbuild-vite.md`)

## Deployment: npm Package with WASM Core

The Rust implementation will be distributed as an npm package with WASM orchestration engine:
- Core logic compiled to WASM, runs in Node.js runtime
- Thin Node.js wrapper for file system access
- `npx daebug` works identically to current JS version
- Seamless upgrade path: same CLI, same files, faster execution
- Installable on any platform supporting Node 18+

High-level goals

- Provide a stable Rust server that manages the per-instance file lifecycle, master registry (`daebug.md`), and HTTP endpoints used by browser shims and remote realms.
- Implement worker registration, heartbeat handling, job dispatch, result ingestion, background-event buffering, and safe atomic file writes in Rust.
- Expose a compact, well-documented HTTP API that browser/client JS shims and Node clients can use for polling, posting jobs/results, reading/writing per-instance logs, and registering worker realms.
- Orchestrate the Remote Test Runner lifecycle by coordinating module load requests and result collection, but delegate actual module import and test execution to the host clients.

## Why Rust with WASM distribution

- **Robust IO**: Rust's async ecosystems (tokio, async-std) provide reliable file-system operations and high-concurrency HTTP servers (hyper, axum)
- **Memory safety**: Explicit error handling reduces crashes that could corrupt per-instance files
- **Universal distribution**: WASM compilation enables npm distribution without platform-specific native modules
- **Performance**: Native code performance for file watching, parsing, and HTTP serving
- **Cross-platform consistency**: Same binary logic on Linux, macOS, Windows via WASM

Core responsibilities for the Rust server

1. Master registry management (`daebug.md`)
   - Maintain, update, and atomically write the registry file. Track connected realms, last heartbeat, state (idle/executing/failed), and pointers to per-instance files.

2. Per-instance log management (per `docs/1-jsrepl.md`)
   - Provide endpoints to read and write per-instance files.
   - Validate appended chunks for required grammar (agent request header, fenced blocks) before accepting them as candidate requests.
   - When accepting a request from a client, atomically remove the footer, insert server-managed request header and executing-announcement placeholder, and track the job in-memory.
   - On receiving results from realm clients, append reply headers, result fences, background events, and re-append the canonical footer. Use a safe write strategy (write to temp-file + rename) to avoid corruption.
   - Parse rich Markdown with hierarchical heading structure (see `docs/1.5.2-repl-tidy.md`)

3. Job lifecycle orchestration
   - Track job states: requested → dispatched → started → finished/failed/timeout.
   - Provide an HTTP-based job fetch endpoint for realm clients (poll-on-demand or long-poll) that returns code to execute and job metadata.
   - Accept postback results (JSON + fenced payloads) and persist them to per-instance files.
   - Implement job timeouts and write appropriate timeout/diagnostic entries.
   - Support dynamic executing regions with real-time placeholder updates

4. Background event capture API
   - Accept background event posts (console, window.onerror, unhandledrejection) from clients and buffer them per-instance until a job reply is written.
   - Serialize background events to file following the compression rules (first-2 / ellipsis / last-8) when flushing.
   - Support streaming background events during long-running jobs (per `docs/1.4-background-events.md`)

5. Worker realm registration, heartbeat and restart logging
   - Accept worker registration requests from page shims (worker name, realm id, metadata).
   - Expose endpoints for the main thread to proxy worker heartbeats and messages.
   - Provide server-side diagnostics and write restart/timeouts to per-instance logs when workers fail to report.

6. Test-runner orchestration (coordinator only)
   - Provide endpoints to trigger test-run orchestration: a client requests a test run, the server records the run as a job and notifies the target realm to import the requested modules.
   - Collect structured test results posted back by the realm and persist them into the per-instance file in the expected formatted form.
   - The server does not import or execute test modules; it only coordinates which files to import and collects results.
   - Support progress streaming during test execution (per `docs/1.5.1-test-runner.md`)

7. CLI interface (per `docs/1.5-npx-tool.md`)
   - Implement `npx daebug` command with port derivation based on directory name hash
   - Support `--root`, `--port`, `--test` flags
   - Provide same user experience as current JavaScript CLI

8. Security, auth and access controls
   - Provide optional auth (API keys, HMAC, local-only binding) to ensure only authorized clients can read/write per-instance files.
   - Sanitize filenames and inputs to prevent path traversal and injection into the repository.

HTTP API surface (suggested endpoints)

- GET  /health
  - Server health and simple diagnostics.

- GET  /daebug.md
  - Return current master registry (for convenience / browser fetch)

- GET  /instances/{name}
  - Read per-instance file contents (for editors and clients to sync)

- POST /instances/{name}/append
  - Client appends a chunk below footer. Server validates and either accepts (converts to job) or treats as draft. Payload includes agentName, chunk text, and client signature/metadata.

- POST /instances/{name}/jobs/ack
  - Server marks a job accepted and returns jobId.

- GET  /instances/{name}/jobs/poll?workerId={id}
  - Realm client polls for pending job. Server responds with job metadata and code to execute. Supports long-polling.

- POST /instances/{name}/jobs/{jobId}/result
  - Realm client posts execution result: status, duration, result payload(s), background events. Server validates and writes reply blocks.

- POST /instances/{name}/background
  - Post background-only events when no job is active. Server flushes them into file as background-only update.

- POST /workers/register
  - Register a worker realm (workerName, parentPage, initial metadata).

- POST /workers/{workerName}/heartbeat
  - Worker or main thread posts heartbeat; server updates master registry and may schedule restart diagnostics if missing.

- POST /tests/run
  - Request a coordinated test run: request body lists instance name, files to import, timeout, and run metadata. Server enqueues a job and the realm client will import modules and post back structured test results.

Design notes on append/accept flow

- Accept-on-append: clients append below the canonical footer. The server must validate the appended chunk and only accept it as a job when it contains the request header and at least one complete fenced code block.
- Atomic file update: implement write via create-temp-file + fsync + rename to target path on POSIX-like platforms. On Windows use equivalent safe replace (write to temp, atomically replace via std APIs where possible). After write, re-open and verify canonical footer/header presence; retry a small number of times if verification fails.
- In-memory job snapshot: store the agentName, pageName, requestedAt, original tail snapshot, background buffer, and placeholder timestamps for the active job while it is executing.

Concurrency model and persistence

- Per-instance files are the authoritative source of truth. Server should treat them carefully: always read the file before modifying (no blind writes based on stale memory state).
- Use a per-instance lock (in-memory async Mutex keyed by instance name) to ensure only one writer modifies a file at a time.
- Use an append/replace strategy: read entire file, compute new content, write to temp, rename. Avoid partial in-place writes.

Client expectations (JS shims / host runtimes)

- The browser/node shims remain responsible for executing JS code and importing modules. The server will only coordinate: it will post jobs and accept results.
- Clients should expose endpoints or shim hooks to run code and to capture console/errors and serialise them when posting results.
- Clients must support the job polling API and the worker registration/heartbeat API.

Test-runner orchestration specifics

- When a test run is requested, the server enqueues a job specifying which module URLs the realm should import and what timeout to enforce.
- The realm client performs dynamic imports and registers tests locally (test/describe/it). Tests are executed in the realm and the client collects per-test results.
- The client posts a structured TestResults JSON back to the server which persists it in the per-instance file using the same reply + background format described in `docs/1-jsrepl.md`.

Security and sandboxing

- Because execution occurs on client-side realms, the server must validate that posted results match expected jobIds (to prevent spurious writes).
- Consider HMACing job payloads so clients can prove they received the authorized job (or sign results) when operating on untrusted networks.
- The server should default to binding to localhost for local development and require explicit configuration to listen on external interfaces.

Monitoring, diagnostics and operator UX

- Expose a small admin UI (optional) or debug endpoints to list active instances, jobs-in-flight, worker status, and recent logs.
- Emit structured logs (JSON) with job lifecycle events so simple monitors can alert on high failure rates or frequent worker restarts.

Testing strategy

- Unit tests (Rust): parser and validation logic for agent request header detection, fence extraction, footer behaviour, background event compression, and atomic write helpers.
- Integration tests (Rust + Node shim): run an integration scenario that spins up the Rust server, posts an append that becomes a job, simulate a realm client that polls and posts a result, and assert the per-instance file contains correct reply blocks.
- End-to-end manual demo: run server locally and load a sample `browser-shim.js` in a test page that polls server endpoints and posts results.

Implementation roadmap

1) Crate skeleton
   - `daebug-server` Rust crate using `tokio` + `axum` for HTTP, `serde`/`serde_json` for payloads, and `tokio::fs` for async file ops.
   - WASM build target using `wasm-bindgen` and `wasm-pack`

2) Core components
   - File manager: safe read/write, temp-file replace, per-instance lock manager.
   - Parser: implement the `docs/1-jsrepl.md` parsing rules to detect agent requests, fenced blocks, footer management and background serialization rules. Support rich Markdown structure from `docs/1.5.2-repl-tidy.md`.
   - Job manager: in-memory state, timeouts, retries, and lifecycle transitions.

3) HTTP routes
   - Implement endpoints listed above with JSON schemas.

4) WASM packaging
   - Compile to WASM target with Node.js file system bindings
   - Create npm package wrapper that loads WASM module and exposes CLI interface
   - Ensure compatibility with `npx daebug` command

5) Tests
   - Unit tests for parser and file manager.
   - Integration tests with Node.js shim.
   - Validation against existing JavaScript test suite for protocol compatibility.

6) Documentation
   - Write migration guide from JavaScript to Rust+WASM version
   - Document any performance improvements or behavioral differences

Technical foundation

**Core Crates**:
- `tokio`: Async runtime for high-concurrency I/O
- `axum`: HTTP server framework
- `notify`: File watching (or platform-specific inotify/FSEvents)
- `serde`: Serialization for registry persistence and protocol messages
- `wasm-bindgen`: WASM interop for Node.js deployment

**Build Targets**:
- WASM: `wasm32-wasi` for Node.js runtime with file system access

**Distribution**:
- npm package with precompiled WASM module
- Thin JavaScript wrapper for CLI and Node.js integration
- Same package name and CLI interface as current version for seamless upgrade

Conclusion

The Rust + WASM implementation provides a drop-in replacement for the current JavaScript server with improved performance and reliability, while maintaining full compatibility with existing REPL protocols and client implementations. The WASM compilation enables universal npm distribution without platform-specific build requirements.
