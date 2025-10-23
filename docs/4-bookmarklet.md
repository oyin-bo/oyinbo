# Bookmarklet Remote Debugging — Universal Daebug Access

## Purpose and Vision

Currently, 👾Daebug provides remote REPL capabilities for pages served by the Daebug server itself. This document outlines the architecture for **universal remote debugging** via bookmarklet injection, enabling agents to debug and interact with **any webpage** regardless of hosting, CORS policies, or Content Security Policy (CSP) restrictions.

**Key Innovation**: By combining a bookmarklet injector with a postMessage relay broker, Daebug can overcome browser security restrictions that normally prevent cross-origin script execution and eval restrictions.

---

## Problem Statement

### Current Limitations

The existing Daebug system works only for pages served by the Daebug HTTP server:
- Pages must be loaded from `http://localhost:8302/` (or configured port)
- Client script is injected during page load via server modification
- Direct fetch/polling to Daebug server from same origin

### Target Scenarios

Universal debugging must support:
1. **Any third-party website** (news sites, documentation, web apps)
2. **Production deployments** with strict CSP policies
3. **Pages that disable eval()** via CSP `unsafe-eval` restriction
4. **Cross-origin pages** that can't directly communicate with localhost Daebug server

### Security Constraints

Browser security mechanisms that must be navigated:
- **CORS**: Cross-Origin Resource Sharing blocks direct fetch to localhost from arbitrary origins
- **CSP**: Content Security Policy may block eval, inline scripts, or external script sources
- **Same-Origin Policy**: Prevents direct communication between different origins

---

## Architectural Overview

The bookmarklet system consists of three components working in concert:

```
┌─────────────────────┐
│   Target Webpage    │  (any origin, restricted CSP)
│   + Bookmarklet     │
│   Injected Code     │
└──────────┬──────────┘
           │ postMessage
           ↓
┌─────────────────────┐
│  Relay Broker Page  │  (https://daeb.ug)
│  (opened popup)     │  
└──────────┬──────────┘
           │ HTTP fetch
           ↓
┌─────────────────────┐
│  Daebug HTTP Server │  (localhost:8302)
│  Registry & REPL    │
└─────────────────────┘
```

### Component 1: Bookmarklet Injector

**Purpose**: Inject debugging client into any page via user action

**Delivery**: JavaScript bookmark URL (bookmarklet) that users save and click

**Functionality**:
- Detects if page allows eval (via CSP check)
- Injects appropriate client implementation:
  - **Standard client** (eval-based) for permissive pages
  - **LISP interpreter client** for CSP-restricted pages
- Establishes connection to relay broker
- Provides session management UI (minimal, non-intrusive)

**Code structure**:
```javascript
javascript:(function(){
  // Detection and injection logic here
  // Opens relay broker window
  // Initializes postMessage communication
  // Injects appropriate REPL client
})();
```

### Component 2: Relay Broker Page

**Purpose**: Bridge CORS/CSP-restricted pages with Daebug localhost server

**Hosting**: `https://daeb.ug/relay.html` (or configurable URL)

**Communication pattern**:
- Receives postMessage from target page (bookmarklet-injected code)
- Makes HTTP fetch requests to Daebug server (localhost or configured)
- Forwards responses back via postMessage
- Maintains message queue and handles timeouts

**Broker protocol**:
```javascript
// From target page to broker
{
  type: 'daebug-poll',
  sessionId: 'unique-session-id',
  pageName: 'example-com-homepage'
}

// From broker to Daebug server (HTTP)
GET /poll?session=unique-session-id&page=example-com-homepage

// From Daebug server to broker (HTTP response)
{
  job: { id: 123, code: 'console.log("test")' }
}

// From broker back to target page (postMessage)
{
  type: 'daebug-job',
  job: { id: 123, code: 'console.log("test")' }
}
```

### Component 3: Dual Execution Engines

#### Engine A: Standard Eval-Based REPL

**When to use**: Pages without CSP eval restrictions

**Implementation**: Similar to current client.js, but using postMessage transport

**Execution model**:
```javascript
// Receive job from broker
const result = await eval(job.code);
// Serialize and send back via postMessage to broker
```

**Advantages**:
- Full JavaScript compatibility
- Fast execution
- Access to all browser APIs
- Direct object manipulation

#### Engine B: Embedded LISP Interpreter

**When to use**: Pages with CSP `unsafe-eval` restrictions

**Implementation**: Pure JavaScript LISP interpreter (no eval needed)

**Execution model**:
```javascript
// Receive LISP S-expressions from broker
const result = lispInterpreter.evaluate(sExpression);
// Serialize and send back via postMessage
```

**LISP dialect requirements**:
- Basic arithmetic and logic operations
- Variable binding and scope management
- Function definition and invocation
- DOM access primitives (querySelector, manipulation)
- Console output primitives
- Object property access (interop with JavaScript objects)

**Example S-expressions**:
```lisp
; Query DOM element
(js-call (js-prop document "querySelector") "#main")

; Set property
(js-set! (js-call (js-prop document "querySelector") "h1")
         "textContent"
         "Modified by Daebug")

; Console output
(console-log "Daebug LISP interpreter active")
```

**Interpreter architecture**:
- Parser: S-expression string → AST
- Evaluator: AST → execution → result
- Environment: Variable bindings and scope chain
- Primitives: Built-in functions for DOM/Console access
- Serializer: Result → string representation

**Size considerations**:
- Target: <20KB minified for bookmarklet delivery
- Optimization: Strip unnecessary features, minimal standard library
- Compression: URL-encode for bookmarklet, or load from relay broker

---

## Implementation Phases

### Phase 1: Relay Broker Infrastructure

**Deliverables**:
1. Static relay page (`relay.html`) with postMessage handlers
2. HTTP client for Daebug server communication
3. Message routing and session management
4. Error handling and timeout logic

**API endpoints** (Daebug server additions):
- `GET /bookmarklet-poll?session={id}&page={name}` — long-polling for jobs
- `POST /bookmarklet-result` — submit job execution results
- `POST /bookmarklet-register` — register new bookmarklet session
- `POST /bookmarklet-events` — background event reporting

**Registry integration**:
- Bookmarklet sessions tracked separately from served-page sessions
- Session metadata includes origin, user agent, capabilities (eval vs LISP)

### Phase 2: Bookmarklet Injector

**Deliverables**:
1. Bookmarklet code generator script
2. CSP detection logic
3. Relay broker connection establishment
4. Session initialization and page name generation
5. Minimal UI for connection status

**User experience**:
1. User clicks bookmarklet on any page
2. Small notification appears: "🔮 Daebug connecting..."
3. Relay broker window opens (small popup)
4. Connection established: "👾 Daebug active"
5. REPL commands execute, results visible in Daebug logs

**Bookmarklet code structure**:
```javascript
javascript:(function(){
  // Avoid double injection
  if (window.__daebugActive) return;
  window.__daebugActive = true;
  
  // CSP detection
  const canEval = detectEvalCapability();
  
  // Open relay broker
  const broker = window.open('https://daeb.ug/relay.html', 'daebug-relay',
    'width=400,height=300,menubar=no,toolbar=no');
  
  // Inject appropriate client
  if (canEval) {
    injectEvalClient(broker);
  } else {
    injectLispClient(broker);
  }
})();
```

### Phase 3: Standard Eval-Based Client

**Deliverables**:
1. PostMessage-based transport layer
2. Job polling via broker
3. Code execution with eval
4. Result serialization and reporting
5. Background event capture (errors, console)
6. Worker support (if page allows)

**Differences from current client.js**:
- Replace HTTP fetch with postMessage to broker
- No Web Worker (broker handles polling)
- Simplified lifecycle (injected on-demand, not page load)

### Phase 4: LISP Interpreter Engine

**Deliverables**:
1. Minimal LISP interpreter (<20KB minified)
2. S-expression parser
3. Core evaluation logic
4. JavaScript interop primitives
5. DOM access functions
6. Standard library (minimal)

**Interpreter features**:
- S-expression syntax: `(function arg1 arg2 ...)`
- Special forms: `if`, `let`, `lambda`, `quote`
- Arithmetic: `+`, `-`, `*`, `/`, `%`
- Comparison: `=`, `<`, `>`, `<=`, `>=`
- Logic: `and`, `or`, `not`
- DOM access: `js-prop`, `js-call`, `js-set!`, `query-selector`
- Console: `console-log`, `console-warn`, `console-error`
- Evaluation: `eval-string` (for LISP strings, not JavaScript)

**Example LISP session**:
```lisp
; Define a function
(let ((greet (lambda (name) 
                (+ "Hello, " name "!"))))
  (console-log (greet "Agent")))

; DOM manipulation
(let ((heading (query-selector "h1")))
  (js-set! heading "textContent" "Daebug Active")
  (js-set! (js-prop heading "style") "color" "green"))

; Iteration example
(let ((items (js-call (query-selector-all ".item") "forEach"
               (lambda (el idx)
                 (js-set! el "textContent" 
                          (+ "Item " (+ idx 1)))))))
  "done")
```

### Phase 5: Server-Side Integration

**Deliverables**:
1. New API endpoints for bookmarklet sessions
2. Registry support for bookmarklet page types
3. Modified writer to handle LISP result format
4. Documentation and examples

**Registry extensions**:
- Page type field: `served` vs `bookmarklet`
- Execution mode: `eval` vs `lisp`
- Origin URL tracking for bookmarklet sessions
- Capability flags (CSP restrictions detected)

**Log format considerations**:
- JavaScript code blocks for eval-mode sessions
- LISP code blocks for LISP-mode sessions
- Mode indicator in page status line
- Clear documentation in per-instance file headers

---

## Security and Privacy Considerations

### Relay Broker Security

**Trust model**: The relay broker at `https://daeb.ug` acts as a trusted intermediary

**Security measures**:
- Origin verification: Broker validates postMessage origin
- Session tokens: Unique session IDs prevent session hijacking
- HTTPS only: Relay must use HTTPS to prevent MITM
- No data persistence: Broker doesn't store messages or sessions
- Timeout enforcement: Idle sessions expire after 5 minutes

### Bookmarklet Safety

**User consent**: Bookmarklet activation is explicit user action

**Transparency**:
- Clear visual indication when Daebug is active
- Easy deactivation (close broker window)
- No automatic injection or persistence

**Code injection boundaries**:
- Bookmarklet only injects into current page
- No modification of other tabs or windows
- No persistent hooks or monitoring

### CSP Implications

**Respect for site policies**: 
- Sites that block eval will use LISP interpreter (respects CSP)
- No attempts to bypass or disable CSP
- Detection, not circumvention

**LISP interpreter security**:
- Sandboxed: No access beyond granted JavaScript capabilities
- No new security holes: Can only do what JavaScript could do
- Transparent: All code visible in LISP form

---

## User Documentation

### Quick Start Guide

**Installing the bookmarklet**:
1. Start Daebug server: `npm start` or `npx daebug`
2. Visit `http://localhost:8302/bookmarklet` to get bookmarklet code
3. Drag "🔮 Daebug Remote" link to bookmarks bar
4. Navigate to any webpage you want to debug
5. Click the bookmarklet
6. Check `daebug.md` for new session

**Using the REPL**:
1. Find bookmarklet session in `daebug.md`
2. Open session file (e.g., `daebug/bookmarklet-example-com-homepage.md`)
3. Add JavaScript (eval mode) or LISP (CSP mode) code blocks
4. Results appear in same file

**Example JavaScript session** (eval mode):
```markdown
> **agent** to bookmarklet-example-com at 14:32:15

```js
document.querySelector('h1').textContent = 'Modified!';
```

> **bookmarklet-example-com** to agent at 14:32:16 (12ms)

```json
"Modified!"
```
```

**Example LISP session** (CSP-restricted mode):
```markdown
> **agent** to bookmarklet-github-com at 14:35:22

```lisp
(js-set! (query-selector "h1") "textContent" "Daebug Active")
```

> **bookmarklet-github-com** to agent at 14:35:22 (8ms)

```json
"Daebug Active"
```
```

### Troubleshooting

**Bookmarklet doesn't work**:
- Ensure Daebug server is running
- Check browser console for errors
- Verify relay broker can reach `localhost:8302`
- Try clicking bookmarklet again (idempotent)

**Relay broker connection fails**:
- Check if popup blocker prevented broker window
- Verify `https://daeb.ug/relay.html` is accessible
- Ensure CORS allows localhost connection

**CSP blocks execution**:
- System should auto-detect and use LISP mode
- Check session file header for execution mode
- LISP syntax different from JavaScript

---

## Technical Specifications

### Bookmarklet Size Budget

**Maximum size**: 2048 characters (browser bookmark URL limit)

**Optimization strategies**:
- Minify JavaScript aggressively
- Load heavy code (LISP interpreter) from relay broker
- Use short variable names
- Remove comments and whitespace
- URL-encode efficiently

### Message Protocol

**PostMessage structure**:
```typescript
// Target page → Broker
interface DaebugRequest {
  type: 'poll' | 'result' | 'register' | 'events';
  sessionId: string;
  pageName: string;
  data?: any;
}

// Broker → Target page
interface DaebugResponse {
  type: 'job' | 'ack' | 'error';
  data?: any;
  error?: string;
}
```

**HTTP protocol** (Broker ↔ Daebug Server):
```
GET /bookmarklet-poll?session={id}&page={name}
→ Long-poll, returns job when available or timeout

POST /bookmarklet-result
Content-Type: application/json
{ sessionId, jobId, result, duration, error }
→ Submit execution result

POST /bookmarklet-register
Content-Type: application/json
{ sessionId, pageName, origin, mode, capabilities }
→ Register new session

POST /bookmarklet-events
Content-Type: application/json
{ sessionId, events: [{type, message, stack, ts}] }
→ Report background events
```

### LISP Interpreter Specification

**Parser grammar**:
```
S-expr     := Atom | List
Atom       := Number | String | Symbol
Number     := [0-9]+ | [0-9]+\.[0-9]+
String     := "..." (with escaping)
Symbol     := [a-zA-Z_+\-*/<>=!?][a-zA-Z0-9_+\-*/<>=!?]*
List       := '(' S-expr* ')'
```

**Core special forms**:
- `(if condition then else)`
- `(let ((var val) ...) body)`
- `(lambda (params) body)`
- `(quote expr)` or `'expr`

**Built-in functions**:
- Arithmetic: `+, -, *, /, %`
- Comparison: `=, <, >, <=, >=`
- Logic: `and, or, not`
- DOM: `query-selector, query-selector-all`
- JavaScript interop: `js-prop, js-call, js-set!`
- Console: `console-log, console-warn, console-error`
- Type checks: `null?, number?, string?, list?`

**Environment model**:
- Lexical scoping
- First-class functions (closures)
- Mutation via `js-set!` (controlled)
- No macros (Phase 1 limitation)

### Performance Targets

**Bookmarklet injection**: <100ms
**Relay broker connection**: <500ms
**Job polling frequency**: 1 request per 2 seconds (long-poll)
**Eval execution overhead**: <5ms per job
**LISP execution overhead**: <50ms per job (simple expressions)
**Message round-trip**: <100ms (target ↔ broker ↔ server)

---

## Development Roadmap

### Milestone 1: Broker Infrastructure (Week 1-2)
- [ ] Create relay.html page with postMessage handlers
- [ ] Implement HTTP polling to Daebug server
- [ ] Message routing and error handling
- [ ] Session management logic
- [ ] Testing with mock target pages

### Milestone 2: Basic Bookmarklet (Week 2-3)
- [ ] Bookmarklet code generator
- [ ] CSP detection logic
- [ ] Broker window management
- [ ] Session registration
- [ ] Testing on sample pages

### Milestone 3: Eval-Based Client (Week 3-4)
- [ ] PostMessage transport layer
- [ ] Job execution with eval
- [ ] Result serialization
- [ ] Background event capture
- [ ] Integration with existing registry

### Milestone 4: LISP Interpreter (Week 4-6)
- [ ] S-expression parser
- [ ] Core evaluator
- [ ] Special forms implementation
- [ ] JavaScript interop primitives
- [ ] Standard library functions
- [ ] Size optimization (<20KB)
- [ ] Testing and validation

### Milestone 5: Server Integration (Week 6-7)
- [ ] New API endpoints
- [ ] Registry extensions
- [ ] Writer format handling
- [ ] Per-instance file templates
- [ ] Testing with both modes

### Milestone 6: Documentation and Polish (Week 7-8)
- [ ] User guide
- [ ] Troubleshooting documentation
- [ ] Example sessions
- [ ] Video demonstrations
- [ ] Security audit

---

## Success Criteria

**Functional Requirements**:
- ✓ Bookmarklet works on arbitrary third-party websites
- ✓ Eval mode executes JavaScript on permissive pages
- ✓ LISP mode executes S-expressions on CSP-restricted pages
- ✓ Relay broker successfully bridges CORS restrictions
- ✓ Sessions appear in daebug.md with correct metadata
- ✓ Results written to per-instance files
- ✓ Background events captured and reported

**Performance Requirements**:
- ✓ Injection latency <100ms
- ✓ Job execution overhead <5ms (eval) or <50ms (LISP)
- ✓ Message round-trip <100ms (local server)

**Security Requirements**:
- ✓ No CSP bypass attempts
- ✓ Explicit user consent (click bookmarklet)
- ✓ Session isolation (no cross-session leakage)
- ✓ HTTPS for relay broker
- ✓ Clear visual indication when active

**Usability Requirements**:
- ✓ One-click bookmarklet installation
- ✓ Automatic mode detection (eval vs LISP)
- ✓ Clear documentation with examples
- ✓ Troubleshooting guide
- ✓ Visual feedback for connection status

---

## Future Enhancements

### Phase 2 Features

**Multi-page coordination**:
- Coordinate actions across multiple tabs
- Shared state between bookmarklet sessions
- Page-to-page communication

**Enhanced LISP capabilities**:
- Macros for code generation
- Module system
- Persistent storage (localStorage interop)
- Async/await support

**Developer tools integration**:
- Breakpoint injection
- Call stack inspection
- Memory profiling
- Network request monitoring

**Mobile support**:
- iOS Safari bookmarklet support
- Android Chrome debugging
- Touch event handling

### Research Areas

**WebAssembly LISP interpreter**:
- Faster execution than JavaScript
- Smaller code size
- Still CSP-compliant (no eval)

**Browser extension alternative**:
- More integrated than bookmarklet
- Better performance
- Automatic injection option

**Remote relay service**:
- Cloud-hosted relay (not just daeb.ug)
- NAT traversal for remote debugging
- Team sharing (multiple agents, one session)

---

## Conclusion

The bookmarklet architecture extends 👾Daebug from a localhost development tool to a universal remote debugging platform. By leveraging postMessage relay and dual execution engines (eval + LISP), it navigates browser security restrictions while maintaining the core REPL experience that makes Daebug valuable for LLM-driven development.

**Key innovations**:
1. **CORS workaround**: Relay broker bridges arbitrary origins with localhost
2. **CSP adaptation**: Automatic fallback to LISP interpreter when eval blocked
3. **Universal deployment**: Works on any webpage via bookmarklet
4. **LLM-friendly**: Maintains file-based REPL interface agents already understand

**Next steps**:
1. Implement relay broker infrastructure
2. Create minimal bookmarklet injector
3. Develop LISP interpreter prototype
4. Integrate with existing Daebug server
5. Test on diverse real-world pages
6. Document and publish for agent use

This plan transforms Daebug from a powerful local tool into a truly universal debugging platform, enabling agents to introspect and modify any web page, anywhere.
