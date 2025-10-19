# Test Runner Usage Guide

This document explains how to use the Oyinbo remote test runner in browser contexts.

## Quick Start

### Running Inline Tests

```javascript
// Import test primitives
import { test, describe, it } from 'node:test';
import assert from 'node:assert';

// Define tests inline
describe('My Test Suite', () => {
  test('addition works', () => {
    assert.strictEqual(1 + 1, 2);
  });
  
  it('async operations work', async () => {
    const result = await Promise.resolve(42);
    assert.strictEqual(result, 42);
  });
});

// Run all registered tests
import { oyinboRunTests } from 'node:test';
const results = await oyinboRunTests({ files: [] });
console.log(results);
```

### Running File-Based Tests

```javascript
// Import run function
import { run } from 'node:test';

// Run tests from files (with test discovery)
const results = await run({ 
  files: ['**/*.test.js']  // glob pattern
});

// Or run specific test files
const results = await run({
  files: [
    '/js/parser.test.js',
    '/js/client-helpers.test.js'
  ]
});
```

## Test Discovery

The server supports test file discovery via glob patterns:

### Supported Patterns
- `**/*.test.js` - All test files recursively
- `js/*.test.js` - Test files in js directory
- `test-*.js` - Files starting with "test-"
- Explicit paths: `/js/specific-test.js`

### Exclusions (automatic)
- `node_modules/**`
- `.git/**`
- `dist/**`
- `build/**`

### Example Discovery Request

```javascript
// The run() function handles this automatically, but you can also call directly:
const response = await fetch('/oyinbo/discover-tests', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ 
    files: ['**/*.test.js'] 
  })
});
const data = await response.json();
console.log('Found test files:', data.files);
```

## Test Progress Streaming

Test results are automatically streamed to the server and written to the realm's debug log file:

```markdown
## Test Results: 15 pass, 0 fail, 0 skip (11ms)

✓ JavaScript Core Tests > string operations (0ms)
✓ JavaScript Core Tests > array operations (0ms)
✓ Assertion Tests > assert.ok works (0ms)
...
```

Results appear in `debug/<realm-name>.md` above the footer.

## Browser-Compatible Test Files

### Requirements

Test files that run in the browser must:
1. Use ES module imports (no CommonJS `require()`)
2. Avoid Node.js-only APIs (`fs`, `path`, `child_process`, etc.)
3. Have dependencies that are also browser-accessible
4. Use `import { test } from 'node:test'` and `import assert from 'node:assert'`

### Recommended Browser-Friendly Test Files

These test files from the repository work well in browsers:

1. **Parser Tests** (`js/parser.test.js`) - String/regex operations
   - Dependencies: `./parser.js` (browser-compatible)
   
2. **Client Helpers Tests** (`js/client-helpers.test.js`) - Browser utility functions
   - Tests: `formatTime`, `serializeValue`, `sanitizeName`
   - Pure JavaScript, no Node.js dependencies

3. **Edge Cases Tests** (`js/edge-cases.test.js`) - Serialization edge cases
   - Tests: NaN, Infinity, BigInt, circular refs, Date/RegExp
   - Comprehensive assertion testing

4. **Test Runner Tests** (`js/test-runner.test.js`) - Meta-tests
   - Tests the test runner itself
   - Validates `test()`, `describe()`, assertions

### Files to Avoid in Browser

These files use Node.js-only APIs and won't work in browsers:
- `js/job.test.js` - Uses `fs` (mkdtempSync, writeFileSync)
- `js/registry.test.js` - Uses filesystem operations
- `js/writer.test.js` - Uses file I/O
- `js/watcher.test.js` - Uses `fs.watch`, `child_process`

## API Reference

### `test(name, fn)` or `test(options, fn)`

Register a test:

```javascript
test('my test', () => {
  assert.ok(true);
});

test({ name: 'my test', timeout: 5000 }, () => {
  // test implementation
});
```

### `describe(name, fn)`

Group tests into suites:

```javascript
describe('Math operations', () => {
  test('addition', () => {
    assert.strictEqual(1 + 1, 2);
  });
  
  test('subtraction', () => {
    assert.strictEqual(5 - 3, 2);
  });
});
```

### `it(name, fn)`

Alias for `test()`:

```javascript
describe('My Suite', () => {
  it('should work', () => {
    assert.ok(true);
  });
});
```

### `assert` Methods

- `assert.ok(value, message)` - Truthy check
- `assert.equal(actual, expected, message)` - Loose equality (==)
- `assert.strictEqual(actual, expected, message)` - Strict equality (===)
- `assert.deepEqual(actual, expected, message)` - Deep equality
- `assert.throws(fn, validator, message)` - Function throws
- `assert.rejects(fn, validator, message)` - Promise rejects

### `oyinboRunTests(options)`

Execute registered tests:

```javascript
const results = await oyinboRunTests({
  files: ['/path/to/test.js'],  // Files to import
  timeout: 60000                 // Overall timeout (optional)
});

// Result object:
{
  passed: 10,
  failed: 1,
  skipped: 0,
  total: 11,
  duration: 1234,
  tests: [
    { name: 'test 1', passed: true, duration: 45 },
    { name: 'test 2', passed: false, error: '...', duration: 12 }
  ]
}
```

### `run(options)`

Node.js-compatible API with discovery and streaming:

```javascript
const results = await run({
  files: ['**/*.test.js']  // Patterns or explicit paths
});
```

Results are automatically streamed to server and written to debug log.

## Demo Page

See `test-runner-demo.html` for an interactive demonstration:

```bash
npm start
# Open http://localhost:8302/test-runner-demo.html
```

The demo shows:
1. Inline test registration and execution
2. File-based test discovery and import
3. Test result display
4. Progress streaming to server logs

## Implementation Details

### Test Execution Flow

1. **Discovery** (if using patterns):
   - Browser sends POST to `/oyinbo/discover-tests`
   - Server scans filesystem with security validation
   - Returns array of file URLs

2. **Import**:
   - Browser uses dynamic `import()` for each file
   - Test files register themselves via `test()`, `describe()`, `it()`

3. **Execution**:
   - Runner iterates registered tests
   - Captures results (pass/fail, timing, errors)

4. **Streaming**:
   - Progress updates sent to `/oyinbo/test-progress` (debounced)
   - Server formats as markdown
   - Written to realm's debug log above footer

### Security

- All discovered files must be within server document root
- Path validation prevents `../` traversal
- Server-side pattern matching only
- Browser cannot list arbitrary directories

## Troubleshooting

### Tests Not Found

If `run()` returns 0 tests:
- Check file paths are absolute (start with `/`)
- Verify files exist in served directory
- Check exclusion patterns aren't blocking files
- Use explicit paths instead of patterns for debugging

### Import Errors

If test files fail to import:
- Verify all dependencies are browser-compatible
- Check import paths are correct
- Ensure files are served by HTTP server
- Use browser DevTools Network tab to check 404s

### Tests Fail in Browser but Pass in Node

- Check for Node.js-only APIs (`fs`, `path`, etc.)
- Verify `window`/`document` assumptions
- Use browser DevTools Console for error details
- Consider environment-specific test files

## Next Steps

For advanced usage, see:
- `docs/1.3-workers-and-test-runner.md` - Architecture and design
- `js/modules/test-runner.js` - Test runner source
- `js/server.js` - Discovery and streaming implementation
