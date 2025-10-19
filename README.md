# 👾DAEBUG: Remote REPL

A file-based REPL for running JavaScript code in live pages. The server watches per-instance Markdown files under `debug/` and sends code to connected pages for execution.

## Quick start

Run from any project directory:

```bash
npx oyinbo
```

The server will start at a deterministic port based on your project name, and serve files from the current directory.

### Command-line options

```bash
npx oyinbo [options]

Options:
  --root <path>     Project root directory (default: current directory)
  --port <number>   HTTP server port (default: derived from project name)
  --help, -h        Show this help
  --version, -v     Show version
```

Examples:
```bash
# Start server in current directory
npx oyinbo

# Use a specific port
npx oyinbo --port=9000

# Serve a different directory
npx oyinbo --root=/path/to/project
```

## How it works

1. Start the server (see Quick start above)
2. Open a page — the URL is shown in the console (e.g., `http://localhost:8342/`)
3. Create a file under `debug/` with a fenced code block and the canonical footer
4. The server runs the code and writes the result back into the same file

## File structure

- `debug.md` — registry of connected pages (server-managed)
- `debug/` — per-instance chat logs; agents create these files
- `js/` — Node.js server modules

The server does NOT create `debug/` or per-instance files. Agents (editors, CLI) must create them.

[Mission Statement: **REPL for LLM debugging**](docs/0-mission.md)

[Implementation spec: Per-instance chat logs and server behavior](docs/1-jsrepl.md)

<br><br>

> [LICENSE](LICENSE)
