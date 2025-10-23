# Rust + WASM Implementation

## Architecture

The Daebug Rust implementation uses a **unified WASM module** that runs in three different contexts:

1. **Node.js Server** (`wasm-node.js`) - Full orchestration
   - HTTP server with axum
   - File watching with notify
   - Registry and job management
   - Markdown parsing with markdown-rs

2. **Browser Page** (`wasm-page.js`) - Client REPL
   - Polls server for jobs
   - Executes code in page context
   - Returns results to server
   - Captures background events

3. **Web Worker** (`wasm-worker.js`) - Isolated REPL
   - Receives jobs from main thread
   - Executes code in worker context
   - Returns results via postMessage

### Runtime Disambiguation

A small JavaScript bootstrap loads the WASM module and calls `init_runtime(context)` with one of:
- `"node"` - For Node.js server
- `"page"` - For browser page
- `"worker"` - For web worker

The WASM code checks the runtime context and enables only the appropriate functionality.

## Building

### Prerequisites

```bash
# Install wasm-pack
curl https://rustwasm.github.io/wasm-pack/installer/init.sh -sSf | sh

# Or with cargo
cargo install wasm-pack
```

### Build for Node.js (WASI target)

```bash
# Build WASM module for Node.js
cargo build --target wasm32-wasi --release

# The WASM binary will be in target/wasm32-wasi/release/daebug.wasm
```

### Build for Browser (web target)

```bash
# Build WASM module for browser
wasm-pack build --target web --out-dir js/pkg

# This generates:
# - js/pkg/daebug.js (JS bindings)
# - js/pkg/daebug_bg.wasm (WASM binary)
# - js/pkg/daebug.d.ts (TypeScript definitions)
```

### Development

```bash
# Check compilation
cargo check

# Run tests
cargo test

# Run tests for WASM target
wasm-pack test --node
```

## Usage

### Node.js Server

```javascript
import { startServer } from './js/wasm-node.js';

// Start server on port 8342
await startServer('.', 8342);
```

### Browser Page

```javascript
import { startPageClient } from './js/wasm-page.js';

// Initialize page client
const client = await startPageClient('http://localhost:8342/daebug', 'my-page');
```

### Web Worker

```javascript
// Create worker
const worker = new Worker('./js/wasm-worker.js', { type: 'module' });

// Send initialization
worker.postMessage({ type: 'init' });

// Execute code
worker.postMessage({ 
  type: 'execute', 
  data: { code: 'console.log("Hello from worker")' }
});
```

## Current Status

### Implemented
- ✅ Core module structure (parser, registry, job, watcher, writer, server)
- ✅ Runtime context disambiguation
- ✅ WASM bindings for entry points
- ✅ JavaScript bootstrap modules for all three contexts
- ✅ Unit tests for Rust modules

### In Progress
- 🚧 WASM compilation configuration
- 🚧 Full server implementation in Node context
- 🚧 Code execution in Page/Worker contexts
- 🚧 HTTP client for polling and posting results

### Todo
- ⏳ Complete AST diff algorithm for Markdown
- ⏳ In-place editing implementation
- ⏳ npm packaging
- ⏳ Integration tests across all three contexts

## File Structure

```
/
├── Cargo.toml              # Rust project config
├── rust/
│   ├── lib.rs             # Library entry with runtime design doc
│   ├── main.rs            # Binary entry (native only)
│   ├── runtime.rs         # Runtime context disambiguation
│   ├── wasm.rs            # WASM-specific bindings
│   ├── parser.rs          # markdown-rs parser
│   ├── registry.rs        # Page/realm tracking
│   ├── job.rs             # Job lifecycle
│   ├── watcher.rs         # File watching
│   ├── writer.rs          # In-place editing
│   └── server.rs          # HTTP server (Node context)
├── js/
│   ├── wasm-node.js       # Node.js bootstrap
│   ├── wasm-page.js       # Browser page bootstrap
│   └── wasm-worker.js     # Web worker bootstrap
```

## Design Notes

### Why One WASM Module?

Using a single WASM module across all three contexts:
- **Reduces bundle size**: One WASM binary instead of three
- **Ensures consistency**: Same parsing and logic everywhere
- **Simplifies maintenance**: One codebase to update
- **Improves caching**: Browser can cache one WASM file

### Context-Specific Code

The Rust code uses `get_runtime_context()` to check the current context and enable only appropriate functionality:

```rust
use crate::runtime::{get_runtime_context, RuntimeContext};

pub fn some_function() {
    match get_runtime_context() {
        RuntimeContext::Node => {
            // Server-only code
        },
        RuntimeContext::Page => {
            // Page client code
        },
        RuntimeContext::Worker => {
            // Worker code
        }
    }
}
```

### Future: Code Splitting

While we start with one module, wasm-pack supports code splitting for advanced optimization. We can later split heavy server logic into a separate module loaded only in Node context.
