# NPX Tool Architecture Review — Current State vs. Document

**Date**: October 2025  
**Status**: Document review against current codebase  
**Finding**: Document is largely aspirational. Many concepts exist, but implementation differs significantly from the plan.

---

## Executive Summary

The `1.6-npx-tool.md` document outlines transforming Daebug into a global CLI tool (`npx daeb.ug` or similar). The current codebase has:

✅ **Implemented & Working**:
- Core parameterization by root directory (all modules accept `root` parameter)
- Hardcoded port (8302) and hardcoded root (repository directory)
- `index.js` shebang + minimal entry point
- `js/cli.js` exists but contains only hardcoded initialization

❌ **Not Yet Implemented**:
- CLI argument parsing (`--root`, `--port` flags)
- Port derivation algorithm (hash-based deterministic port)
- Port collision handling with retry logic
- Sensible defaults (use `process.cwd()` instead of `join(__dirname, '..')`)
- Help text and version output
- Validation of inputs
- `package.json` `bin` field configuration

🔄 **Changed Since Document**:
- **Long-polling architecture**: Document pre-dates this; server now uses `/daebug` endpoint with long-polling instead of websockets or immediate response
- **Asset serving via suffix**: Import maps and 👾Daebug modules now served from root with special path handling (`/daebug/*` namespace) instead of separate serving logic
- **Registry and pages**: Fully parameterized; document assumption is correct
- **Watcher debouncing**: File watching has debounce and "seen files" tracking (not in document)

---

## Detailed Analysis by Section

### 1. Package Structure & Entry Points

**Document Section**: "Architecture Overview" → "Package Structure"

**Document Says**:
```json
{
  "bin": { "daebug": "./index.js" },
  "main": "./js/cli.js",
  "files": ["bin/", "js/", "index.js", "README.md", "LICENSE"]
}
```

**Current Reality**:
```json
{
  "name": "daeb.ug",
  "main": "index.js",
  "version": "0.0.9",
  "no bin field"
}
```

**Status**: ❌ Not Implemented
- `index.js` exists with correct shebang
- `main` points to `index.js` (document suggests pointing to `js/cli.js`)
- **Missing**: `bin` field needed for `npx` executable
- **Missing**: `files` field for npm publish filtering

**Recommendation**: Add `bin` field to `package.json`:
```json
{
  "bin": { "daeb.ug": "./index.js" },
  "main": "./js/cli.js",
  "files": ["js/", "index.js", "README.md", "LICENSE"],
  "engines": { "node": ">=18.0.0" }
}
```

---

### 2. Root Directory Resolution

**Document Section**: "Functional Requirements" → "UC1: Default invocation"

**Document Says**:
> Root directory = current working directory (`process.cwd()`)

**Current Reality** (`js/cli.js`):
```javascript
const ROOT = join(__dirname, '..');  // Hardcoded to repo directory
const PORT = Number(process.env.PORT) || 8302;
```

**Status**: ❌ Not Implemented
- `ROOT` is hardcoded to package directory, not invocation directory
- `PORT` accepts environment variable but no CLI flag parsing

**Recommendation**: Update `js/cli.js` to:
```javascript
export function run() {
  const args = parseArgs(process.argv.slice(2));
  
  const root = args.root ? resolve(args.root) : process.cwd();
  if (!existsSync(root)) {
    console.error(`[daeb.ug] error: root directory does not exist: ${root}`);
    process.exit(1);
  }
  
  const port = args.port || derivePort(root);
  
  registry.init(root);
  server.start(root, port);
  watcher.watchForRestart(root);
}
```

---

### 3. Port Derivation Algorithm

**Document Section**: "Functional Requirements" → "Port Derivation Algorithm"

**Document Specifies**:
- Hash-based deterministic port: `8100 + (hash(dirname) % 1000)`
- Range: 8100–9099 (1000 ports)
- Collision retry: up to 20 attempts with fallback hash variants
- Fallback sequence: `hash((dirname + i))` for i = 1..19

**Current Reality**:
- Hardcoded `PORT = 8302`
- No port derivation function exists
- No collision detection

**Status**: ❌ Not Implemented

**Recommendation**: Implement port derivation:
```javascript
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

function derivePort(root) {
  const dirname = basename(root).toLowerCase();
  const hash = simpleHash(dirname);
  return 8100 + (hash % 1000);
}
```

---

### 4. CLI Argument Parsing

**Document Section**: "CLI Design" → "Argument Parsing"

**Document Says**:
- Support `--root=<path>` and `--root <path>`
- Support `--port=<number>` and `--port <number>`
- Support `--help`, `-h`
- Support `--version`, `-v`
- No external dependencies initially

**Current Reality** (`js/cli.js`):
```javascript
export function run() {
  registry.init(ROOT);
  server.start(ROOT, PORT);
  watcher.watchForRestart(ROOT);
}
```
No argument parsing at all.

**Status**: ❌ Not Implemented

**Recommendation**: Implement simple argument parser in `js/cli.js`:
```javascript
function parseArgs(argv) {
  const args = { root: null, port: null, help: false, version: false };
  
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--version' || arg === '-v') {
      args.version = true;
    } else if (arg.startsWith('--root=')) {
      args.root = arg.slice(7);
    } else if (arg === '--root' && argv[i + 1]) {
      args.root = argv[++i];
    } else if (arg.startsWith('--port=')) {
      args.port = Number(arg.slice(7));
    } else if (arg === '--port' && argv[i + 1]) {
      args.port = Number(argv[++i]);
    } else if (!arg.startsWith('-')) {
      // Positional argument
      args.root = arg;
    }
  }
  
  return args;
}
```

---

### 5. Long-Polling Architecture

**Document Section**: Not explicitly covered (predates this design)

**Document Assumes**: WebSocket or immediate HTTP response

**Current Reality** (`js/server.js`):
```javascript
async function handlePoll(root, url, res) {
  // Long-polling: wait for a job to become available (randomized 10-15s timeout)
  const pollTimeout = 10000 + Math.random() * 5000;
  j = await job.waitForJob(page.name, pollTimeout);
  
  if (!j) {
    return res.writeHead(200, { 'Content-Type': 'application/javascript' }).end('');
  }
  res.writeHead(200).end(j.code);
}
```

**Status**: ✅ Implemented, Better than Document
- Uses efficient long-polling instead of persistent connections
- Randomized timeout (10–15s) reduces thundering herd
- Stateless server-side (no open connections)

**Impact on npx Tool**: None. Port/CLI changes are orthogonal to polling mechanism.

**Document Recommendation**: Update npx tool document to acknowledge long-polling architecture.

---

### 6. Asset Serving & Import Maps

**Document Section**: Not covered (predates suffix-based serving)

**Document Assumes**: Static file serving, minimal special handling

**Current Reality** (`js/server.js`):
```javascript
// 👾Daebug modules (test-runner.js, assert.js)
if (url.pathname in DAEBUG_MODULES) {
  console.log(`[daebug] serving module: ${url.pathname}`);
  return res.writeHead(200).end(DAEBUG_MODULES[url.pathname]);
}

// HTML files: inject/merge import maps and client script
if (extname(file) === '.html') {
  const html = readFileSync(file, 'utf8');
  const modified = processImportMapHTML(html, root);
  const withClient = injectClientScript(modified);
  return res.writeHead(200).end(withClient);
}

// JSON files: check if import map, merge if yes
if (extname(file) === '.json') {
  const json = JSON.parse(content);
  if (json.imports || json.scopes) {
    const merged = mergeImportMaps(json);
    return res.writeHead(200).end(JSON.stringify(merged));
  }
}
```

**Status**: ✅ Implemented, Not in Document
- Special namespace `/daebug/*` for test runner and bootstrap modules
- Import map detection and merging for both HTML and JSON files
- Automatic client script injection into HTML
- Cache-busting headers for JS files

**Impact on npx Tool**: None. These features work regardless of port/root configuration.

**Document Recommendation**: Update document to describe import map and module serving strategy.

---

### 7. Registry & Watcher Parameterization

**Document Section**: "Architecture Overview" → "What Remains Unchanged"

**Document Says**:
> All core logic is already parameterized and reusable

**Current Reality** (`js/registry.js` & `js/watcher.js`):
```javascript
// registry.js
export function init(root) { ... }
export function getOrCreate(root, name, url) { ... }
export function updateMaster(root) { ... }

// watcher.js
export function watchPage(root, page) { ... }
export function watchForRestart(root) { ... }
```

**Status**: ✅ Fully Parameterized
- All functions accept `root` parameter
- No hardcoded paths
- Ready for multi-directory operation

**Example from watcher.js**:
```javascript
const check = () => {
  const text = readFileSync(page.file, 'utf8');
  const req = parseRequest(text, page.name);
  console.info(`> ${req.agent} to ${page.name} "${snippet}"`);
  job.create(page, req.agent, req.code, req.hasFooter);
  registry.updateMaster(root);
};
```

**Document Accuracy**: ✅ Correct. No module rewrites needed for npx tool support.

---

### 8. Startup Message

**Document Section**: "CLI Design" → "Startup Message"

**Document Example**:
```
[daebug] serving /Users/alice/my-project
[daebug] http://localhost:8342/
[daebug] debug registry: debug.md
[daebug] watching: debug/*.md
```

**Current Reality** (`js/server.js` & `js/watcher.js`):
```
[daebug] serving HTML with import map injected: index.html
> user to index-html "const x = 42; x"
```

**Status**: ⚠️ Partially Implemented
- No startup summary message
- Logs individual page connections and job execution
- No URL announcement

**Recommendation**: Add startup message to `js/cli.js`:
```javascript
const server = createServer(...);
server.listen(port, () => {
  console.log(`[daeb.ug] serving ${root}`);
  console.log(`[daeb.ug] http://localhost:${port}/`);
  console.log(`[daeb.ug] debug registry: debug.md`);
  console.log(`[daeb.ug] watching: debug/*.md`);
});
```

---

### 9. Error Handling

**Document Section**: "CLI Design" → "Error Handling"

**Document Scenarios**:
1. Root directory doesn't exist
2. Port unavailable after retries
3. Invalid argument

**Current Reality**: No error handling in `js/cli.js`

**Status**: ❌ Not Implemented

**Recommendation**: Add error handlers:
```javascript
if (!existsSync(root)) {
  console.error(`[daeb.ug] error: root directory does not exist: ${root}`);
  process.exit(1);
}

if (typeof port !== 'number' || port < 1 || port > 65535) {
  console.error(`[daeb.ug] error: port must be between 1 and 65535`);
  process.exit(1);
}

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`[daeb.ug] error: port ${port} is in use`);
    // Try fallback ports
  }
});
```

---

### 10. Help Text & Version

**Document Section**: "CLI Design" → "Help Text"

**Document Says**:
```
daebug — File-based REPL for JavaScript

Usage:
  npx daebug [options]

Options:
  --root <path>     Project root directory (default: current directory)
  --port <number>   HTTP server port (default: derived from project name)
  --help, -h        Show this help
  --version, -v     Show version

Examples:
  npx daebug
  npx daebug --port=9000
  npx daebug --root=/path/to/project
```

**Current Reality**: No help or version support

**Status**: ❌ Not Implemented

**Recommendation**: Add to `js/cli.js`:
```javascript
const version = '0.0.9'; // Read from package.json in production

const helpText = `daeb.ug — File-based REPL for JavaScript

Usage:
  npx daeb.ug [options]

Options:
  --root <path>     Project root directory (default: current directory)
  --port <number>   HTTP server port (default: derived from project name)
  --help, -h        Show this help
  --version, -v     Show version

Examples:
  npx daeb.ug
  npx daeb.ug --port=9000
  npx daeb.ug --root=/path/to/project

Documentation: https://daeb.ug`;

function run() {
  const args = parseArgs(process.argv.slice(2));
  
  if (args.help) {
    console.log(helpText);
    process.exit(0);
  }
  
  if (args.version) {
    console.log(`daeb.ug ${version}`);
    process.exit(0);
  }
  
  // ... rest of startup
}
```

---

### 11. Package Configuration

**Document Section**: "Package Distribution" → "package.json Configuration"

**Current `package.json`**:
```json
{
  "name": "daeb.ug",
  "version": "0.0.9",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js",
    "test": "node --test --test-timeout=3000"
  },
  "no bin field": null,
  "no files field": null,
  "no engines field": null
}
```

**Document Recommends**:
```json
{
  "main": "./js/cli.js",
  "bin": { "daebug": "./index.js" },
  "files": ["js/", "index.js", "README.md", "LICENSE"],
  "engines": { "node": ">=18.0.0" }
}
```

**Status**: ⚠️ Partially Ready
- ✅ `type: "module"` correct
- ✅ `index.js` exists with shebang
- ❌ `bin` field missing
- ❌ `files` field missing
- ❌ `engines` field missing
- ⚠️ `main` field should point to `js/cli.js`

**Gap Analysis**:
- Without `bin` field, `npm` won't create an executable wrapper
- Without `files` field, unnecessary files (debug/, docs/) included in package
- Without `engines` field, older Node.js may attempt install

---

### 12. Testing Strategy

**Document Section**: "Testing Strategy"

**Document Recommends**:
- Unit tests for port derivation and argument parsing
- Integration tests for CLI invocation
- Manual testing checklist

**Current Reality** (`js/*.test.js`):
```javascript
// Tests exist for server, parser, watcher, etc.
// No CLI-specific tests
```

**Status**: ❌ No CLI Tests

**Recommendation**: Create `js/cli.test.js`:
```javascript
import { test, assert } from 'node:test';
import { parseArgs, derivePort, simpleHash } from './cli.js';

test('parseArgs --root flag', () => {
  const args = parseArgs(['--root=/foo']);
  assert.equal(args.root, '/foo');
});

test('parseArgs --port flag', () => {
  const args = parseArgs(['--port=9000']);
  assert.equal(args.port, 9000);
});

test('derivePort deterministic', () => {
  const p1 = derivePort('/path/to/my-project');
  const p2 = derivePort('/path/to/my-project');
  assert.equal(p1, p2);
});

test('simpleHash consistency', () => {
  const h1 = simpleHash('test');
  const h2 = simpleHash('test');
  assert.equal(h1, h2);
});
```

---

### 13. Publishing & Distribution

**Document Section**: "Package Distribution" → "npm Publishing Workflow"

**Current State**: Package is on npm as `daeb.ug` v0.0.9

**Publishing Checklist from Document**:
1. ✅ Version in package.json (0.0.9)
2. ❌ Test locally with `npm link`
3. ❌ Test with `npx .` in another directory
4. ❌ Publish to npm (done, but without CLI support)

**Status**: ⚠️ Published but Incomplete
- Package exists but `bin` field missing, so `npx daeb.ug` doesn't work as CLI
- Would fail `npm link` tests

**Recommendation**: 
1. Implement CLI changes in source
2. Bump version to `1.0.0` (signals stability)
3. Test with `npm link` before republishing
4. Republish to npm

---

## Summary of Gaps

### Implemented ✅
| Feature | Status | Notes |
|---------|--------|-------|
| Root parameterization | ✅ | All modules accept `root` parameter |
| Long-polling | ✅ | Efficient 10-15s timeout |
| Import map handling | ✅ | Merges maps, serves as suffix |
| File watcher | ✅ | Debounced, supports "seen files" |
| Shebang & entry point | ✅ | `index.js` ready to go |

### Not Implemented ❌
| Feature | Effort | Impact |
|---------|--------|--------|
| CLI argument parsing | Small | Critical for npx usability |
| Port derivation | Small | Nice-to-have (deterministic ports) |
| Port collision retry | Medium | Handles port conflicts gracefully |
| Root default to cwd | Small | Critical for npx usability |
| Help/version text | Tiny | Documentation |
| Startup message | Tiny | UX improvement |
| Error handling | Medium | Robustness |
| `package.json` `bin` field | Tiny | Required for npx |
| `package.json` `files` field | Tiny | Clean npm package |
| `package.json` `engines` field | Tiny | Compatibility guarantee |
| CLI unit tests | Medium | Robustness |

### Changed Since Document ⚠️
| Change | Impact | Status |
|--------|--------|--------|
| Long-polling (not websockets) | Fundamental architecture | Document needs update |
| Import map suffix serving | Better than original plan | Document needs update |
| Watcher enhancements | Invisible to npx tool | Minor doc update |

---

## Recommended Implementation Order

### Phase 1: CLI Infrastructure (High Priority)
1. **Update `package.json`**: Add `bin`, `files`, `engines` fields
2. **Implement `js/cli.js` argument parsing**: `--root`, `--port`, `--help`, `--version`
3. **Add startup message**: Show resolved root and port
4. **Add error handling**: Directory validation, port range validation

### Phase 2: Port Derivation (Medium Priority)
1. **Implement port derivation function**: Hash-based from directory name
2. **Add port validation**: Ensure 1–65535 range
3. **Implement collision retry**: Try up to 20 fallback ports

### Phase 3: Testing & Distribution (High Priority)
1. **Write CLI unit tests**: `js/cli.test.js`
2. **Test with `npm link`**: Verify global install works
3. **Update README**: Add npx usage examples
4. **Bump version to `1.0.0`**: Signal stability
5. **Publish to npm**: Finalize distribution

### Phase 4: Documentation (Low Priority)
1. **Update `1.6-npx-tool.md`**: Add long-polling and import map details
2. **Add CLI architecture docs**: Explain port derivation, fallback logic
3. **Add troubleshooting guide**: Common port conflicts, path issues

---

## Conclusion

The document `1.6-npx-tool.md` is **well-designed and largely accurate** for the architectural goal, but **not yet implemented** in the codebase. The main gaps are:

1. **No CLI argument parsing** — `js/cli.js` is empty, hardcoded to repo root
2. **No port derivation** — Fixed port 8302, no deterministic hash-based derivation
3. **Missing `bin` field** — npm won't create executable wrapper for `npx daeb.ug`
4. **Long-polling architecture** — Document pre-dates this; should be updated

The good news: **Core parameterization is solid**. All modules already accept `root` parameter. The work is purely CLI ergonomics and packaging, not architectural changes.

**Estimated effort for full implementation**: 6–8 hours (mostly CLI parsing, error handling, and testing).

