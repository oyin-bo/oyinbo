# Oyinbo REPL - New Implementation

Clean, modular implementation following the file-based REPL spec.

## Architecture

```
js/
  cli.js       - Entry point, initializes registry and server
  server.js    - HTTP server (polling endpoint + static files)
  registry.js  - Page registry and debug.md management
  parser.js    - Parse agent requests from markdown files
  job.js       - Job lifecycle (create, timeout, finish)
  writer.js    - Write replies to per-instance files
  watcher.js   - Watch per-instance files for changes
  client.js    - Browser injector script
```

## Usage

```bash
node js/cli.js
```

Then open `http://localhost:8302/` in a browser.

## How it works

1. Browser loads HTML, injector script auto-runs
2. Injector polls `/oyinbo?name=<tab>&url=<url>`
3. Server creates per-instance file in `debug/<name>.md`
4. Agent appends JS code to the file
5. File watcher detects change, creates job
6. Next poll delivers code to browser
7. Browser executes, posts result back
8. Server writes reply to per-instance file

## Per-instance file format

```markdown
# <page-name>

> This file is a REPL...

> **agent** to <page> at HH:MM:SS
```JS
1 + 1
```

> **<page>** to agent at HH:MM:SS (2ms)
```JSON
2
```

> Write code in a fenced JS block below to execute against this page.
```

## Files

- `debug.md` - Master registry of connected pages
- `debug/*.md` - Per-instance chat logs (one per browser tab)

## Core principles

- **Brevity**: Simple, direct code
- **Modularity**: Each file has one clear purpose
- **Testability**: Pure functions where possible
- **Spec compliance**: Follows 1-jsrepl.md exactly
