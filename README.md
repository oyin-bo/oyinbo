# 🍯 **O**YINBO **Y**arn **I**s **N**ot **Bo**ring? Remote REPL

A file-based REPL for running JavaScript code in live pages. The server watches per-instance Markdown files under `debug/` and sends code to connected pages for execution.

## How it works

1. Start the server: `node js/cli.js`
2. Open a page at `http://localhost:8302/` — the client injects and polls the server
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
