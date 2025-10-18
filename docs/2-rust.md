# Rust orchestration & HTTP server for the File-based Markdown REPL

Purpose

This document describes a design and implementation plan for using Rust only as the orchestration layer and HTTP server for the file-based Markdown REPL (see `docs/1-jsrepl.md`) and the Web Worker + Remote Test Runner proposal (`docs/1.3-workers-and-test-runner.md`). Important constraint: Rust will NOT execute JavaScript (or other REPL code); all code execution happens in host runtimes (browser main thread, web workers, Node). Rust provides reliable, single-binary server-side behaviour, deterministic file handling, and strong concurrency/IO guarantees.

High-level goals

- Provide a stable Rust server that manages the per-instance file lifecycle, master registry (`debug.md`), and HTTP endpoints used by browser shims and remote realms.
- Implement worker registration, heartbeat handling, job dispatch, result ingestion, background-event buffering, and safe atomic file writes in Rust.
- Expose a compact, well-documented HTTP API that browser/client JS shims and Node clients can use for polling, posting jobs/results, reading/writing per-instance logs, and registering worker realms.
- Orchestrate the Remote Test Runner lifecycle by coordinating module load requests and result collection, but delegate actual module import and test execution to the host clients.

Why Rust-only orchestration is a good fit

- Robust IO: Rust's standard and async ecosystems (tokio, async-std) provide reliable file-system operations, high-concurrency HTTP servers (hyper, axum), and careful handling of atomic writes.
- Single trusted server process: avoids brittle JS/Node server drift across environments and gives deterministic behaviour for file-based logs and registry updates.
- Safety: memory safety and explicit error handling reduce server-side crashes that could corrupt per-instance files.
- Performance headroom for many simultaneous connected realms and logs.

Core responsibilities for the Rust server

1. Master registry management (`debug.md`)
   - Maintain, update, and atomically write the registry file. Track connected realms, last heartbeat, state (idle/executing/failed), and pointers to per-instance files.

2. Per-instance log management (per `docs/1-jsrepl.md`)
   - Provide endpoints to read and write per-instance files.
   - Validate appended chunks for required grammar (agent request header, fenced blocks) before accepting them as candidate requests.
   - When accepting a request from a client, atomically remove the footer, insert server-managed request header and executing-announcement placeholder, and track the job in-memory.
   - On receiving results from realm clients, append reply headers, result fences, background events, and re-append the canonical footer. Use a safe write strategy (write to temp-file + rename) to avoid corruption.

3. Job lifecycle orchestration
   - Track job states: requested → dispatched → started → finished/failed/timeout.
   - Provide an HTTP-based job fetch endpoint for realm clients (poll-on-demand or long-poll) that returns code to execute and job metadata.
   - Accept postback results (JSON + fenced payloads) and persist them to per-instance files.
   - Implement job timeouts and write appropriate timeout/diagnostic entries.

4. Background event capture API
   - Accept background event posts (console, window.onerror, unhandledrejection) from clients and buffer them per-instance until a job reply is written.
   - Serialize background events to file following the compression rules (first-2 / ellipsis / last-8) when flushing.

5. Worker realm registration, heartbeat and restart logging
   - Accept worker registration requests from page shims (worker name, realm id, metadata).
   - Expose endpoints for the main thread to proxy worker heartbeats and messages.
   - Provide server-side diagnostics and write restart/timeouts to per-instance logs when workers fail to report.

6. Test-runner orchestration (coordinator only)
   - Provide endpoints to trigger test-run orchestration: a client requests a test run, the server records the run as a job and notifies the target realm to import the requested modules.
   - Collect structured test results posted back by the realm and persist them into the per-instance file in the expected formatted form.
   - The server does not import or execute test modules; it only coordinates which files to import and collects results.

7. Security, auth and access controls
   - Provide optional auth (API keys, HMAC, local-only binding) to ensure only authorized clients can read/write per-instance files.
   - Sanitize filenames and inputs to prevent path traversal and injection into the repository.

HTTP API surface (suggested endpoints)

- GET  /health
  - Server health and simple diagnostics.

- GET  /debug.md
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

Implementation roadmap (concrete steps)

1) Crate skeleton
   - `oyinbo-server` Rust crate using `tokio` + `axum` or `hyper` for HTTP, `serde`/`serde_json` for payloads, and `tokio::fs` for async file ops.

2) Core components
   - File manager: safe read/write, temp-file replace, per-instance lock manager.
   - Parser/validator: implement the `docs/1-jsrepl.md` parsing rules to detect agent requests, fenced blocks, footer management and background serialization rules.
   - Job manager: in-memory state, timeouts, retries, and lifecycle transitions.

3) HTTP routes
   - Implement endpoints listed above with JSON schemas and openapi-style docs (optional).

4) Security hardening
   - Input sanitization, filename sanitization, optional API key middleware, local-only defaults.

5) Tests
   - Unit tests for parser and file manager.
   - Integration tests with a small Node shim (the shim will be used only during tests and demos).

6) Documentation and examples
   - Write quickstart README showing how to run the Rust server and how to use the `browser-shim.js` and `node-shim.js` (the shims are JS clients that execute code and test workflows).

Developer ergonomics & ops

- Provide clear logging for write failures and recovery attempts.
- Provide a dry-run mode that validates incoming appends and prints the actions without mutating files.
- Provide a `--data-dir` option to allow running the server against a specific repository copy.

Edge cases & risks

- Clients may post malformed results or fail to follow expected jobId semantics; server must defensively validate and append diagnostics rather than overwriting.
- Cross-platform atomic replace semantics differ; test carefully on Windows and POSIX.
- Long-running background buffers may cause memory bloat; cap per-instance retained events (per the compression rules) and persist when necessary.
- CSP and worker-src may prevent the browser from creating workers; the server should accept graceful degradation and write diagnostic entries when worker creation fails.

Conclusion

Using Rust as the orchestration and HTTP server (while leaving JS execution to the clients) gives the project a stable, auditable, and robust server-side implementation. The server is the authoritative manager of per-instance files, job lifecycle, worker registration, heartbeats, and test-run coordination, while the client-side shims remain responsible for executing code and returning structured results.

Next steps

- I can implement the `oyinbo-server` crate skeleton and the file-manager + parser in Rust and add unit tests for the parsing/atomic-write behaviour. Then I'll add minimal Node-based integration tests that exercise the HTTP routes end-to-end. If you want me to start that, tell me to proceed and I will create the crate and initial files.
