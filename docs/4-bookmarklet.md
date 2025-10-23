# Remote Daebugging via Bookmarklet — Conceptual Plan

## Executive Summary

This document outlines the architecture for extending 👾Daebug's remote REPL capabilities to **any web page**, not just those served by the Daebug server. The solution uses a **bookmarklet** to inject debugging capabilities into arbitrary pages, with a **CORS/CSP broker** pattern to enable communication between restricted environments and the Daebug server.

**Key Innovation**: Two execution modes accommodate different security contexts:
1. **Eval mode**: Direct JavaScript execution for pages without strict CSP
2. **LISP interpreter mode**: Embedded interpreter for CSP-restricted environments that block eval

---

## Problem Statement

Current Daebug implementation supports remote debugging only for pages served by the Daebug HTTP server itself. The server injects client script at page load time, which then polls the `/daebug` endpoint.

**Limitations of current approach:**
- Cannot debug production sites or third-party pages
- Cannot debug pages served by other development servers
- Requires control over the page's HTTP response headers

**User need**: Debug any page in any browser tab with the same file-based REPL workflow, regardless of how the page is served.

---

## Architecture Overview

### Component Diagram

```
┌──────────────────────────────────────────────────────────┐
│  Target Page (any origin, possibly CSP-restricted)       │
│  ┌────────────────────────────────────────────────────┐  │
│  │ Bookmarklet Injected Script                        │  │
│  │  • Detect CSP/eval restrictions                    │  │
│  │  • Choose execution mode (eval vs LISP)            │  │
│  │  • Open broker window (window.open)                │  │
│  │  • Send/receive via postMessage                    │  │
│  └────────┬───────────────────────────────────────────┘  │
│           │ postMessage                                   │
└───────────┼───────────────────────────────────────────────┘
            │
            │ cross-origin postMessage
            │
┌───────────▼───────────────────────────────────────────────┐
│  Broker Window (https://daeb.ug or localhost:8302/broker) │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Broker Script                                       │  │
│  │  • Relay messages between target page and server   │  │
│  │  • Handle CORS-safe HTTP to Daebug server          │  │
│  │  • Maintain connection state                       │  │
│  └────────┬────────────────────────────────────────────┘  │
│           │ HTTP fetch (same-origin or CORS-enabled)      │
└───────────┼────────────────────────────────────────────────┘
            │
            │ HTTP GET/POST
            │
┌───────────▼────────────────────────────────────────────────┐
│  Daebug Server (localhost:8302)                            │
│  • Same /daebug endpoint as existing implementation        │
│  • Same file-based protocol (daebug.md, daebug/*.md)       │
│  • Recognizes bookmarklet-connected pages                  │
└─────────────────────────────────────────────────────────────┘
```

### Message Flow

**Initialization:**
1. User clicks bookmarklet on target page
2. Bookmarklet script injects itself into page context
3. Script detects eval/CSP capabilities
4. Script opens broker window with `window.open('https://daeb.ug/broker')` or local equivalent
5. Script establishes postMessage channel to broker
6. Broker registers page with Daebug server via HTTP POST

**Job Execution (eval mode):**
1. Daebug server detects new code in per-instance file
2. Broker polls `/daebug` endpoint, receives code
3. Broker sends code to target page via postMessage
4. Target page executes code with eval/AsyncFunction
5. Target page sends result back to broker via postMessage
6. Broker POSTs result to Daebug server
7. Server writes result to per-instance file

**Job Execution (LISP mode):**
1-2. Same as eval mode
3. Broker sends LISP code to target page via postMessage
4. Target page executes code using embedded LISP interpreter
5-7. Same as eval mode

---

## Bookmarklet Design

### Bookmarklet Code Structure

The bookmarklet must be minimal (URL length limits ~2KB for browser compatibility) and bootstrap a full client:

```javascript
javascript:(function(){
  if(window.__daebugActive){alert('Daebug already active');return;}
  var s=document.createElement('script');
  s.src='https://daeb.ug/bookmarklet.js?v='+Date.now();
  s.onload=function(){window.__daebugInit();};
  s.onerror=function(){alert('Failed to load Daebug');};
  document.head.appendChild(s);
})();
```

### Full Bookmarklet Client (`bookmarklet.js`)

The full client loaded from the bookmarklet contains:

**Core components:**
- CSP/eval detection logic
- postMessage communication layer
- Eval execution engine (for non-CSP pages)
- Embedded LISP interpreter (for CSP-restricted pages)
- Background event capture (errors, console)
- Connection state management

**Detection heuristic:**
```javascript
function detectEvalSupport() {
  try {
    new Function('return 42')();
    return true;
  } catch (e) {
    if (e instanceof EvalError || 
        /unsafe-eval|Content Security Policy/.test(e.message)) {
      return false;
    }
    throw e;
  }
}
```

**Initialization sequence:**
1. Inject itself into page (or already injected by bookmarklet)
2. Detect eval capabilities
3. Choose execution mode
4. Generate unique page name (similar to current client.js)
5. Open broker window (reuse existing window if available)
6. Establish postMessage handshake with broker
7. Start polling for jobs via broker

---

## Execution Modes

### Mode 1: Eval/AsyncFunction (Standard Mode)

**When to use:** Pages without strict CSP or CSP allows `unsafe-eval`

**How it works:**
- Same eval strategy as current `client.js`
- Wrap code in AsyncFunction for expression vs statement handling
- Execute in page context with full DOM/window access

**Advantages:**
- Full JavaScript language support
- Direct access to page globals
- Compatible with existing REPL code examples

**Code execution:**
```javascript
async function executeEval(code) {
  const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
  try {
    return await new AsyncFunction('return (' + code + ')')();
  } catch {
    return await new AsyncFunction(code)();
  }
}
```

### Mode 2: Embedded LISP Interpreter

**When to use:** Pages with strict CSP that blocks eval

**How it works:**
- Embed a minimal Scheme/LISP interpreter in the bookmarklet client
- Transpile or execute LISP code in interpreter
- Provide FFI (foreign function interface) to access page globals

**Interpreter choice considerations:**
- **BiwaScheme**: Full Scheme R6RS/R7RS, ~200KB minified
- **LIPS**: Scheme-like, smaller footprint ~100KB
- **femtolisp**: Minimal, educational implementation
- **Custom minimal**: S-expression evaluator with basic forms

**Recommended: Custom minimal LISP** for bookmarklet context:
- Core forms: `define`, `lambda`, `if`, `quote`, `begin`, `let`
- Arithmetic: `+`, `-`, `*`, `/`, `<`, `>`, `=`
- List operations: `cons`, `car`, `cdr`, `list`, `map`, `filter`
- FFI: `js-eval`, `js-get`, `js-set`, `js-call` for DOM access
- Size target: <50KB minified

**FFI example:**
```scheme
; Get element by ID
(define elem (js-call document "getElementById" "myButton"))

; Set property
(js-set elem "textContent" "Clicked!")

; Attach event handler
(js-call elem "addEventListener" "click" 
  (lambda (e) (js-call console "log" "Clicked")))
```

**S-Expression protocol:**
```scheme
; Request format (in per-instance file)
> **agent** to target-page-via-bookmarklet at 14:22:30
```scheme
(begin
  (js-set document.body.style.background "red")
  (js-call console "log" "Changed background"))
```

; Response format
> **target-page-via-bookmarklet** to agent at 14:22:31 (12ms)
```JSON
null
```
```

**Mode detection and fallback:**
The bookmarklet client automatically detects capabilities and chooses the appropriate mode. Users can also force a mode via bookmarklet parameter:

```javascript
// Auto-detect
javascript:(function(){...})();

// Force eval mode (will fail if CSP blocks it)
javascript:(function(){window.__daebugMode='eval';...})();

// Force LISP mode
javascript:(function(){window.__daebugMode='lisp';...})();
```

---

## CORS/CSP Broker Pattern

### Why a Broker is Needed

**CORS problem:**
Target page (e.g., `https://example.com`) cannot directly fetch from Daebug server (`http://localhost:8302`) due to CORS restrictions.

**CSP problem:**
Even if CORS were solved, CSP `connect-src` directive might block connections to localhost or specific origins.

**postMessage solution:**
`window.postMessage` is exempt from CORS and most CSP restrictions when communicating between windows from different origins, making it ideal for this use case.

### Broker Window Responsibilities

The broker is a minimal HTML page served from a trusted origin (either the Daebug server itself or a dedicated domain like `daeb.ug`):

**Broker location options:**
1. **Local broker**: `http://localhost:8302/broker.html` (served by Daebug server)
2. **Public broker**: `https://daeb.ug/broker` (hosted service, optional)

**Broker page structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>👾Daebug Broker</title>
  <style>
    body { 
      font-family: monospace; 
      padding: 20px; 
      background: #1a1a1a; 
      color: #0f0; 
    }
    .status { margin: 10px 0; }
    .log { 
      max-height: 400px; 
      overflow-y: auto; 
      border: 1px solid #0f0; 
      padding: 10px; 
      font-size: 11px;
    }
  </style>
</head>
<body>
  <h1>👾Daebug Broker</h1>
  <div class="status">Status: <span id="status">Initializing...</span></div>
  <div class="status">Connected pages: <span id="pages">0</span></div>
  <div class="status">Server: <span id="server">Not connected</span></div>
  <div class="log" id="log"></div>
  <script src="/broker.js"></script>
</body>
</html>
```

**Broker script responsibilities:**
1. Listen for postMessage from target pages
2. Maintain registry of connected target pages
3. Poll Daebug server `/daebug` endpoint for each connected page
4. Relay code from server to target pages
5. Relay results from target pages to server
6. Handle connection lifecycle (page close, broker close)

### postMessage Protocol

**Message types (target page → broker):**
```javascript
{
  type: 'register',
  pageName: 'unique-page-identifier',
  pageUrl: 'https://example.com/page',
  mode: 'eval' | 'lisp',
  timestamp: Date.now()
}

{
  type: 'result',
  pageName: 'unique-page-identifier',
  jobId: 'server-provided-job-id',
  ok: true,
  value: <serialized result>,
  backgroundEvents: [...],
  timestamp: Date.now()
}

{
  type: 'heartbeat',
  pageName: 'unique-page-identifier',
  timestamp: Date.now()
}

{
  type: 'unregister',
  pageName: 'unique-page-identifier',
  timestamp: Date.now()
}
```

**Message types (broker → target page):**
```javascript
{
  type: 'registered',
  pageName: 'unique-page-identifier',
  serverConnected: true,
  timestamp: Date.now()
}

{
  type: 'job',
  jobId: 'server-provided-job-id',
  code: '...code to execute...',
  mode: 'eval' | 'lisp',
  timestamp: Date.now()
}

{
  type: 'ping',
  timestamp: Date.now()
}
```

**Security considerations:**
- Broker MUST validate message origin (check `event.origin`)
- Target page MUST validate broker window origin
- Messages MUST include timestamps to detect replay attacks
- Broker MUST rate-limit messages per page
- Broker MUST validate message structure (type, required fields)

**Origin validation example:**
```javascript
// In broker
const ALLOWED_ORIGINS = ['*']; // Accept all in dev mode
window.addEventListener('message', (event) => {
  // In production, validate specific origins:
  // if (!ALLOWED_ORIGINS.includes(event.origin)) return;
  
  handleMessage(event.data, event.source, event.origin);
});

// In target page bookmarklet
const BROKER_ORIGIN = 'http://localhost:8302'; // or https://daeb.ug
window.addEventListener('message', (event) => {
  if (event.origin !== BROKER_ORIGIN) return;
  if (event.source !== brokerWindow) return;
  
  handleBrokerMessage(event.data);
});
```

---

## Integration with Existing Daebug Server

### Server-Side Changes

**Minimal changes required** — the core file-based protocol remains identical:

1. **Endpoint enhancement**: `/daebug` endpoint recognizes bookmarklet clients
   - No changes to GET (polling) or POST (results) semantics
   - Add optional query parameter: `?source=bookmarklet`
   - Add optional query parameter: `?mode=eval|lisp`

2. **Registry support**: `daebug.md` tracks bookmarklet pages
   ```markdown
   # Connected pages:
   * example-com-4-oak-1425-30 (https://example.com/ via bookmarklet) last 14:25:45 state: idle
   * localhost-index (http://localhost:8302/) last 14:26:02 state: executing
   ```

3. **Per-instance file naming**: Sanitize external URLs for filenames
   ```javascript
   function sanitizeExternalUrl(url) {
     const { hostname, pathname } = new URL(url);
     const sanitized = (hostname + pathname)
       .replace(/[^a-z0-9]+/g, '-')
       .replace(/^-|-$/g, '')
       .substring(0, 40); // Limit length
     
     return sanitized + '-' + generateRandomSuffix();
   }
   
   // Example: https://example.com/products/123
   // → example-com-products-123-7-mint-1430-15
   ```

4. **No changes to**:
   - Job queue mechanism
   - Parser/writer modules
   - File watching logic
   - Result formatting

### Client-Side Integration (Broker)

The broker acts as a **proxy** for the existing client polling mechanism:

**Broker polling loop** (one loop per connected page):
```javascript
async function pollForPage(pageName, pageUrl, pageWindow, pageOrigin) {
  const endpoint = `/daebug?name=${encodeURIComponent(pageName)}` +
                   `&url=${encodeURIComponent(pageUrl)}` +
                   `&source=bookmarklet`;
  
  while (pageIsConnected(pageName)) {
    try {
      const res = await fetch(endpoint, { cache: 'no-cache' });
      const code = await res.text();
      
      if (code) {
        // Send job to target page
        pageWindow.postMessage({
          type: 'job',
          jobId: res.headers.get('x-job-id'),
          code: code,
          timestamp: Date.now()
        }, pageOrigin);
      }
      
      await sleep(500);
    } catch (err) {
      console.warn('Broker poll error:', err);
      await sleep(3000);
    }
  }
}
```

**Result relay**:
```javascript
async function relayResult(pageName, pageUrl, result) {
  const endpoint = `/daebug?name=${encodeURIComponent(pageName)}` +
                   `&url=${encodeURIComponent(pageUrl)}` +
                   `&source=bookmarklet`;
  
  await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(result)
  });
}
```

---

## LISP Interpreter Implementation

### Minimal LISP Core

A minimal LISP interpreter for the bookmarklet should implement:

**1. Reader (parser)**
- Tokenize S-expressions
- Parse atoms: numbers, strings, symbols
- Parse lists: `(...)` with proper nesting
- Handle quotes: `'expr` → `(quote expr)`

**2. Evaluator**
- Environment/scope management
- Special forms: `quote`, `if`, `define`, `lambda`, `begin`, `let`
- Function application
- Tail call optimization (optional but recommended)

**3. Built-in functions**
- Arithmetic: `+`, `-`, `*`, `/`, `mod`
- Comparison: `<`, `>`, `=`, `<=`, `>=`
- Lists: `cons`, `car`, `cdr`, `list`, `null?`, `pair?`
- Logic: `and`, `or`, `not`
- Utility: `display`, `newline`

**4. FFI (Foreign Function Interface)**
Critical for DOM access from LISP:
```scheme
; FFI primitives
(js-eval "alert('hello')")           ; Execute arbitrary JS
(js-get window "location.href")     ; Get property
(js-set document.title "New Title")  ; Set property
(js-call console "log" "message")    ; Call method
(js-new "Date")                      ; Construct object
```

### Example Minimal Implementation

**Size target:** <50KB minified, <20KB gzipped

**Core data structures:**
```javascript
// Atoms
class Sym { constructor(name) { this.name = name; } }
class Num { constructor(value) { this.value = value; } }
class Str { constructor(value) { this.value = value; } }

// Lists (cons cells)
class Cons { 
  constructor(car, cdr) { 
    this.car = car; 
    this.cdr = cdr; 
  } 
}

const NIL = Symbol('nil');
```

**Reader:**
```javascript
function read(input) {
  const tokens = tokenize(input);
  return readFrom(tokens);
}

function tokenize(input) {
  return input
    .replace(/\(/g, ' ( ')
    .replace(/\)/g, ' ) ')
    .trim()
    .split(/\s+/);
}

function readFrom(tokens) {
  if (tokens.length === 0) throw new Error('Unexpected EOF');
  
  const token = tokens.shift();
  if (token === '(') {
    const list = [];
    while (tokens[0] !== ')') {
      list.push(readFrom(tokens));
    }
    tokens.shift(); // Remove ')'
    return listToConsChain(list);
  } else if (token === ')') {
    throw new Error('Unexpected )');
  } else if (token === "'") {
    return new Cons(new Sym('quote'), 
                    new Cons(readFrom(tokens), NIL));
  } else {
    return parseAtom(token);
  }
}

function parseAtom(token) {
  if (/^-?\d+(\.\d+)?$/.test(token)) return new Num(parseFloat(token));
  if (token.startsWith('"')) return new Str(token.slice(1, -1));
  return new Sym(token);
}
```

**Evaluator:**
```javascript
function evaluate(expr, env) {
  // Self-evaluating
  if (expr instanceof Num || expr instanceof Str) return expr;
  if (expr === NIL) return NIL;
  
  // Variable lookup
  if (expr instanceof Sym) return env.lookup(expr.name);
  
  // List application
  if (expr instanceof Cons) {
    const first = expr.car;
    
    // Special forms
    if (first instanceof Sym) {
      if (first.name === 'quote') return expr.cdr.car;
      if (first.name === 'if') return evalIf(expr.cdr, env);
      if (first.name === 'define') return evalDefine(expr.cdr, env);
      if (first.name === 'lambda') return evalLambda(expr.cdr, env);
      if (first.name === 'begin') return evalBegin(expr.cdr, env);
      if (first.name === 'let') return evalLet(expr.cdr, env);
    }
    
    // Function application
    const func = evaluate(first, env);
    const args = consToArray(expr.cdr).map(arg => evaluate(arg, env));
    return apply(func, args);
  }
  
  throw new Error('Cannot evaluate: ' + expr);
}
```

**FFI implementation:**
```javascript
function setupFFI(env) {
  // js-eval: execute JavaScript string
  env.define('js-eval', (code) => {
    if (!(code instanceof Str)) throw new Error('js-eval expects string');
    return wrapValue(eval(code.value));
  });
  
  // js-get: get property from object
  env.define('js-get', (obj, prop) => {
    const jsObj = unwrapValue(obj);
    const jsProp = unwrapValue(prop);
    return wrapValue(jsObj[jsProp]);
  });
  
  // js-set: set property on object
  env.define('js-set', (obj, prop, val) => {
    const jsObj = unwrapValue(obj);
    const jsProp = unwrapValue(prop);
    const jsVal = unwrapValue(val);
    jsObj[jsProp] = jsVal;
    return wrapValue(jsVal);
  });
  
  // js-call: call method on object
  env.define('js-call', (obj, method, ...args) => {
    const jsObj = unwrapValue(obj);
    const jsMethod = unwrapValue(method);
    const jsArgs = args.map(unwrapValue);
    return wrapValue(jsObj[jsMethod](...jsArgs));
  });
}

function wrapValue(jsVal) {
  if (typeof jsVal === 'number') return new Num(jsVal);
  if (typeof jsVal === 'string') return new Str(jsVal);
  if (jsVal === null || jsVal === undefined) return NIL;
  return jsVal; // Pass objects through as-is
}

function unwrapValue(lispVal) {
  if (lispVal instanceof Num) return lispVal.value;
  if (lispVal instanceof Str) return lispVal.value;
  if (lispVal === NIL) return null;
  return lispVal; // Objects pass through
}
```

### Embedding Strategy

**Inline in bookmarklet client**: Include the LISP interpreter code directly in `bookmarklet.js`:

```javascript
// bookmarklet.js structure
(function() {
  'use strict';
  
  // LISP interpreter code (minified)
  const LispInterpreter = (function() {
    // ... reader, evaluator, FFI as above ...
    return { read, evaluate, createEnv };
  })();
  
  // Bookmarklet client code
  const BookmarkletClient = (function() {
    let mode = 'eval'; // or 'lisp'
    let interpreter = null;
    let env = null;
    
    function init() {
      detectMode();
      if (mode === 'lisp') {
        env = LispInterpreter.createEnv();
      }
      connectToBroker();
    }
    
    async function executeCode(code) {
      if (mode === 'eval') {
        return await executeEval(code);
      } else {
        return executeLisp(code);
      }
    }
    
    function executeLisp(code) {
      const expr = LispInterpreter.read(code);
      const result = LispInterpreter.evaluate(expr, env);
      return result;
    }
    
    // ... rest of bookmarklet client ...
  })();
  
  // Export init function
  window.__daebugInit = BookmarkletClient.init;
})();
```

**Size optimization:**
- Minify with terser/uglify
- Use short variable names
- Remove comments
- Inline small functions
- Consider gzip (browser decompresses automatically)

---

## Security and Safety

### Content Security Policy (CSP) Challenges

**CSP directives that affect bookmarklet:**

1. **`script-src`**: Blocks inline scripts and eval
   - Bookmarklet is inline by definition (runs in `javascript:` URL)
   - Solution: Bookmarklet only injects `<script src="...">` tag, not inline code
   - LISP mode bypasses eval restriction

2. **`connect-src`**: Blocks fetch/XHR to certain origins
   - Affects broker connection to Daebug server
   - Solution: Broker window has its own origin/CSP, can connect freely
   - Target page only uses postMessage (CSP-exempt)

3. **`frame-src` / `child-src`**: Blocks iframes
   - Not relevant (we use popup window, not iframe)

4. **`default-src`**: Fallback for other directives
   - May block bookmarklet script load
   - Solution: Use trusted origin (daeb.ug) with proper CSP

**Bookmarklet CSP compatibility:**
```
Content-Security-Policy: default-src 'self'; 
  script-src 'self' https://daeb.ug;
  connect-src 'self';
```
This CSP allows:
- Bookmarklet to load script from daeb.ug ✓
- Broker to connect to Daebug server (if same-origin) ✓
- Target page to use postMessage ✓ (always allowed)

### Trusted Broker Domain

**Why daeb.ug domain:**
- Short, memorable bookmarklet URL
- Trust anchor for CSP `script-src` whitelist
- HTTPS for security
- Can serve from CDN for reliability

**Broker domain requirements:**
- Serve `bookmarklet.js` with proper CORS headers
- Serve `broker.html` with minimal CSP
- HTTPS only (no mixed content)
- Rate limiting to prevent abuse
- Optionally require API key for server connection

**Local development alternative:**
```javascript
// Bookmarklet for local development
javascript:(function(){
  var s=document.createElement('script');
  s.src='http://localhost:8302/bookmarklet.js?v='+Date.now();
  document.head.appendChild(s);
})();
```

### Privacy and Data Safety

**Data that leaves target page:**
- Execution results (user-controlled via REPL commands)
- Background events (errors, console logs)
- Page metadata (URL, name, timestamp)

**Data that does NOT leave target page:**
- Cookies (not accessible to bookmarklet)
- localStorage/sessionStorage (unless explicitly read in REPL)
- Form data (unless explicitly accessed)
- Authentication tokens (unless in DOM/window)

**User consent:**
- Bookmarklet is user-initiated (explicit consent)
- Broker window visible (user knows connection is active)
- Can be disabled by closing broker window

**Security recommendations:**
1. Never send credentials via REPL
2. Use localhost server for sensitive debugging
3. Review background events before flushing
4. Clear per-instance files after debugging session
5. Broker should support authentication (optional)

---

## Implementation Phases

### Phase 1: Local Broker (MVP)

**Goal**: Basic bookmarklet support for local development

**Deliverables:**
1. Broker HTML page served at `/broker.html`
2. Broker JavaScript (`broker.js`) with postMessage relay
3. Bookmarklet client (`bookmarklet.js`) with eval mode only
4. Server endpoint enhancement for bookmarklet clients
5. Documentation for creating and using bookmarklet

**Timeline estimate:** 2-3 weeks

**Success criteria:**
- Can debug any local page via bookmarklet
- postMessage communication working reliably
- Results appear in per-instance files
- Background events captured correctly

### Phase 2: LISP Interpreter

**Goal**: Support CSP-restricted pages

**Deliverables:**
1. Minimal LISP interpreter implementation
2. FFI for DOM/window access
3. Mode detection and fallback logic
4. LISP code examples and documentation
5. Tests for LISP interpreter

**Timeline estimate:** 3-4 weeks

**Success criteria:**
- Can execute LISP code on CSP-restricted pages
- FFI allows practical DOM manipulation
- Interpreter size <50KB minified
- Performance acceptable (<100ms for simple expressions)

### Phase 3: Public Broker (Optional)

**Goal**: Enable debugging of external production sites

**Deliverables:**
1. Deploy broker to daeb.ug domain
2. CDN setup for bookmarklet.js
3. Rate limiting and abuse prevention
4. Optional authentication for server connection
5. Monitoring and logging

**Timeline estimate:** 2-3 weeks

**Success criteria:**
- Bookmarklet works on any public website
- Broker stable and performant
- No security incidents
- Documentation for public usage

### Phase 4: Enhanced Features (Future)

**Potential enhancements:**
- **Multi-tab debugging**: Broker manages multiple tabs simultaneously
- **Session persistence**: Reconnect after page reload
- **Breakpoint support**: Pause execution at specific points
- **DOM inspection**: Enhanced DOM tree exploration commands
- **Network monitoring**: Capture fetch/XHR calls
- **Performance profiling**: Time code execution
- **Mobile support**: Bookmarklet for mobile browsers
- **Browser extension**: Alternative to bookmarklet for easier activation

---

## Code Examples

### Example 1: Using Bookmarklet (Eval Mode)

**Setup:**
1. Visit any page (e.g., https://example.com)
2. Click bookmarklet in browser toolbar
3. Broker window opens automatically
4. Create per-instance file: `daebug/example-com-4-oak-1425-30.md`

**REPL interaction:**
```markdown
> Write code in a fenced JS block below to execute against this page.

> **agent** to example-com-4-oak-1425-30 at 14:25:45
```js
document.title
```

> **example-com-4-oak-1425-30** to agent at 14:25:46 (8ms)
```JSON
"Example Domain"
```

> **agent** to example-com-4-oak-1425-30 at 14:26:12
```js
document.body.style.background = 'lightblue';
document.body.style.color = 'darkblue';
'Styled!'
```

> **example-com-4-oak-1425-30** to agent at 14:26:13 (5ms)
```JSON
"Styled!"
```

> Write code in a fenced JS block below to execute against this page.
```

### Example 2: Using Bookmarklet (LISP Mode)

**Setup:**
Same as above, but page has strict CSP

**REPL interaction:**
```markdown
> Write code in a fenced Scheme block below to execute against this page.

> **agent** to strict-csp-page-7-zen-1427-05 at 14:27:15
```scheme
(js-get document "title")
```

> **strict-csp-page-7-zen-1427-05** to agent at 14:27:16 (12ms)
```JSON
"Secure Page"
```

> **agent** to strict-csp-page-7-zen-1427-05 at 14:27:30
```scheme
(begin
  (define body (js-get document "body"))
  (js-set (js-get body "style") "background" "lightgreen")
  (js-call console "log" "Background changed to green")
  "Done")
```

> **strict-csp-page-7-zen-1427-05** to agent at 14:27:31 (18ms)
```JSON
"Done"
```

> Write code in a fenced Scheme block below to execute against this page.
```

### Example 3: Background Events Capture

**Scenario:** Page throws error during REPL execution

```markdown
> **agent** to example-com-4-oak-1425-30 at 14:30:00
```js
document.querySelector('.nonexistent').click()
```

> **example-com-4-oak-1425-30** to agent at 14:30:01 (**ERROR** after 3ms)
```Error
TypeError: Cannot read properties of null (reading 'click')
    at eval (eval at <anonymous> (bookmarklet.js:342:28), <anonymous>:1:38)
    at executeEval (bookmarklet.js:342:28)
    at async handleJobMessage (bookmarklet.js:298:20)
```

> Write code in a fenced JS block below to execute against this page.
```

---

## Testing Strategy

### Unit Tests

**Bookmarklet client:**
- postMessage communication (mock MessageEvent)
- Mode detection (mock CSP)
- Code execution (both modes)
- Background event capture
- Connection lifecycle

**LISP interpreter:**
- Reader: parsing S-expressions
- Evaluator: special forms, function application
- FFI: js-eval, js-get, js-set, js-call
- Error handling
- Edge cases (deeply nested lists, large numbers, etc.)

**Broker:**
- Message routing (target ↔ broker ↔ server)
- Multi-page management
- Origin validation
- Rate limiting
- Connection recovery

### Integration Tests

**End-to-end scenarios:**
1. Bookmarklet injection on test page
2. Broker connection establishment
3. Code execution via file-based REPL
4. Result retrieval and verification
5. Background event capture
6. Connection cleanup

**Cross-browser testing:**
- Chrome/Chromium
- Firefox
- Safari
- Edge

**CSP testing:**
- Various CSP configurations
- Mode fallback behavior
- FFI functionality under strict CSP

### Manual Testing Checklist

- [ ] Bookmarklet loads on HTTP page
- [ ] Bookmarklet loads on HTTPS page
- [ ] Bookmarklet loads on localhost
- [ ] Broker window opens and connects
- [ ] Eval mode executes JavaScript correctly
- [ ] LISP mode executes Scheme correctly
- [ ] Background errors captured
- [ ] Console events captured
- [ ] Multiple pages simultaneously
- [ ] Page refresh handling
- [ ] Broker close/reopen
- [ ] Server restart handling
- [ ] Network error recovery

---

## API Reference

### Bookmarklet Global API

**Once bookmarklet is active, the target page has:**

```javascript
// Check if Daebug is active
window.__daebugActive // boolean

// Current mode
window.__daebugMode // 'eval' | 'lisp'

// Force mode (before activation)
window.__daebugMode = 'lisp';

// Manual initialization (if needed)
window.__daebugInit();

// Connection state
window.__daebugConnected // boolean

// Broker window reference
window.__daebugBroker // Window object

// Send message to broker (advanced usage)
window.__daebugSend(messageObject);

// LISP environment (if LISP mode)
window.__daebugLispEnv // Environment object
```

### Broker API

**The broker window exposes (for debugging):**

```javascript
// Connected pages
window.__brokerPages // Map<pageName, pageInfo>

// Server connection status
window.__brokerServerConnected // boolean

// Manual page registration (advanced)
window.__brokerRegisterPage(pageName, pageWindow, pageOrigin);

// Disconnect page
window.__brokerDisconnectPage(pageName);

// Send message to page
window.__brokerSendToPage(pageName, message);

// Get statistics
window.__brokerStats() 
// Returns: { pages: 3, jobs: 47, errors: 2, uptime: 12345 }
```

---

## Comparison with Existing Approaches

### vs Browser DevTools Console

**Advantages of Daebug bookmarklet:**
- File-based REPL (better for LLM workflows)
- Multi-statement execution with history
- Background event capture
- Cross-browser consistency
- Can automate via file editing

**Disadvantages:**
- More setup (bookmarklet + broker)
- Network latency (local though)
- Less integrated with browser (no DOM inspector link)

### vs Browser Extensions

**Advantages of bookmarklet:**
- No installation required
- Works immediately
- No extension permissions
- Updates automatically (script from server)

**Disadvantages:**
- Must click each time (extension can be always-on)
- No persistent storage (extension has chrome.storage)
- No background page (extension can run code in background)

**Future consideration:** Create browser extension that embeds the bookmarklet functionality for easier activation.

### vs Selenium/Puppeteer

**Advantages of Daebug:**
- Human-friendly file-based interface
- Works on live pages (not just automated)
- LLM-optimized protocol
- Lightweight (no browser driver)

**Disadvantages:**
- Less control (Selenium can navigate, take screenshots, etc.)
- Manual activation (Selenium is fully automated)

---

## Open Questions and Future Research

### Technical Questions

1. **Interpreter performance**: Is the LISP interpreter fast enough for practical use? 
   - Benchmark target: <100ms for typical REPL commands
   - May need JIT or bytecode compilation for complex code

2. **Interpreter size**: Can we fit LISP interpreter in reasonable bookmarklet size?
   - Target: <50KB minified interpreter
   - May need to lazy-load advanced features

3. **CSP bypass reliability**: Will LISP mode work on all CSP-restricted sites?
   - Need to test with real-world CSP configurations
   - Some sites may block postMessage sources

4. **postMessage performance**: Is postMessage fast enough for large results?
   - May need chunking for >1MB results
   - Consider compression for large data

### UX Questions

1. **Broker window UX**: Should broker be popup, tab, or iframe?
   - Popup: obtrusive but obvious
   - Tab: less obvious, may get lost
   - iframe: stealthy but CSP may block

2. **Multi-page workflow**: How to manage debugging multiple tabs?
   - One broker for all tabs? Or one per tab?
   - How to switch between pages in REPL?

3. **Mobile support**: Can bookmarklet work on mobile browsers?
   - iOS Safari restrictions on bookmarklets
   - Android Chrome bookmarklet support

4. **Error recovery**: What if broker connection drops?
   - Auto-reconnect? Manual?
   - How to communicate state to user?

---

## Appendix: S-Expression Protocol Details

### Wire Format

When using LISP mode, the per-instance file contains Scheme code instead of JavaScript:

**Agent request:**
```markdown
> **agent** to page-name at HH:MM:SS
```scheme
(+ 2 3)
```
```

**Page reply:**
```markdown
> **page-name** to agent at HH:MM:SS (Nms)
```JSON
5
```
```

### Standard Library

**Recommended standard library functions for bookmarklet LISP:**

**List operations:**
```scheme
(define (length lst)
  (if (null? lst) 0 (+ 1 (length (cdr lst)))))

(define (map f lst)
  (if (null? lst) 
      '() 
      (cons (f (car lst)) (map f (cdr lst)))))

(define (filter pred lst)
  (cond
    ((null? lst) '())
    ((pred (car lst)) (cons (car lst) (filter pred (cdr lst))))
    (else (filter pred (cdr lst)))))

(define (reduce f init lst)
  (if (null? lst)
      init
      (reduce f (f init (car lst)) (cdr lst))))
```

**DOM helpers:**
```scheme
(define ($ id)
  (js-call document "getElementById" id))

(define (sel selector)
  (js-call document "querySelector" selector))

(define (sel-all selector)
  (js-call document "querySelectorAll" selector))

(define (text elem)
  (js-get elem "textContent"))

(define (set-text elem txt)
  (js-set elem "textContent" txt))

(define (on elem event handler)
  (js-call elem "addEventListener" event handler))
```

**Usage example:**
```scheme
(begin
  (define btn ($ "myButton"))
  (set-text btn "Click me!")
  (on btn "click" (lambda (e) (js-call alert "Clicked!")))
  "Event handler attached")
```

---

## Summary

This plan outlines a comprehensive approach to extending 👾Daebug to any web page via bookmarklet. The key innovations are:

1. **postMessage broker pattern** to bypass CORS/CSP restrictions
2. **Dual execution modes** (eval + LISP) to support both permissive and restricted environments
3. **Minimal server changes** leveraging existing file-based protocol
4. **Progressive enhancement** from local MVP to public service

The bookmarklet approach democratizes remote debugging, enabling LLM-driven development and quality assurance across the entire web ecosystem, not just locally-served pages.

**Next steps:**
1. Implement Phase 1 (local broker + eval mode)
2. Test on real-world pages with various CSP configurations
3. Gather feedback and iterate
4. Proceed to Phase 2 (LISP interpreter) if CSP restrictions are common
5. Consider Phase 3 (public broker) based on user demand

---

**Document version:** 1.0  
**Last updated:** 2025-10-23  
**Status:** Planning / Design document
