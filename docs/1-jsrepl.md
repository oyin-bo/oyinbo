# JavaScript REPL (file-based) — per-instance chat-log design

This document specifies the file-based JavaScript REPL behaviour used by the local server. It describes the master registry file, the per-instance chat-log files, the request/reply formats, error and duration handling, parsing heuristics, and examples. The goal is a human-first, LLM-friendly, append-only log per open realm instance (for example: each browser tab / page).

## Architecture summary

- Master registry: `debug.md` at repository root. Very small surface area — lists active realm instances and their current state (idle/executing/completed/failed) with last heartbeat timestamps.
- Per-instance chat log files: stored under `debug/` directory at repo root. One file per realm instance (for example: `debug/index-7-zen-1201-03-1a2b.md`). These are the authoritative, append-only chat logs for each realm instance.


Directories (relative to repo root):

```
debug.md                # master registry (lightweight)
debug/                  # per-instance logs
  index-7-zen-1201-03-1a2b.md
  12-dove-1631-13-3f4e.md
```

## File naming and sanitization

- Per-instance filename pattern: `<sanitized-name>-<short-id>.md`
  - `sanitized-name`: lowercase alphanumerics, hyphens for separators. Derived from the page's display name (e.g., the browser tab name). Non-ASCII and unsafe characters are removed or replaced.
  - `short-id`: 4–8 hex characters generated at job creation time to disambiguate instances with identical names.
- Example: a page named "Index - 7 Zen" becomes `index-7-zen-1a2b.md`.

## Master registry (`debug.md`) format

The master registry is small and intentionally machine- and human-friendly. It is fully managed by the server and should not be hand-edited by the user.

Header example:

```
# Connected pages:
* index-7-zen-1201-03 (http://localhost:8302/) last 22:02:12 state: idle
* 12-dove-1631-13 (http://localhost:8302/) last 22:52:48 state: executing
```

The master file also contains an at-a-glance list of recent jobs (optional) and pointers to per-instance files. Keep this file under ~200 lines to avoid editor churn.

## Per-instance chat-log format

Each per-instance file is an append-only conversation between one or more agents and the realm instance. The format is deliberately human-first and deterministic for automated parsing.

Rules (authoritative):

- Agent request header (exact):

```
**<agent-name>** to <page-name> at HH:MM:SS
```

Followed immediately by a fenced code block with the language tag (JS recommended):

```
```JS
<code...>
```
```

- Page reply header (accepted forms):

```
**<page-name>** to <agent-name> at HH:MM:SS
```

Or, for errors/delays, include the `(**ERROR** after <duration>)` marker:

```
**<page-name>** to <agent-name> at HH:MM:SS (**ERROR** after 16ms)
```

- Result content follows. For successful evaluations use `JSON` fenced block or `Text` when appropriate. For error stacks use `Error` fenced block or plain text stack.

Examples:

Agent request:

```
**agent** to index-7-zen at 22:52:47
```JS
12+13
```

Page reply (success):

```
**index-7-zen** to agent at 22:52:48 (17ms)
```JSON
25
```

Page reply (error):

```
**index-7-zen** to agent at 22:52:48 (**ERROR** after 16ms)
```Error
Error: test error
    at eval (eval at <anonymous> (http://localhost:8302/:112:37), <anonymous>:1:7)
    at inject (http://localhost:8302/:112:37)
```

Important rules:

- Timestamps are human per-second `HH:MM:SS`. If absent, server may use file-mtime as fallback.
- Duration: always reported when available in parentheses next to reply header (ms or seconds if >2000ms). This is a required signal for verification.
- Fences must be closed; incomplete fences are treated as drafts and not dispatched.

## Parser heuristics

The server watches per-instance files and parses only the bottom-most chunk (tail) to detect new agent requests. Parsing must be debounced (recommended 150ms) to avoid catching writes-in-flight.

Matching rules:

- When an agent request is detected, create a Job and enqueue it for the corresponding page instance.
- If a page reply arrives, match it to the nearest prior unmatched agent request by agent name and timestamp (nearest-prior-unmatched-request heuristic).
- If ambiguous (same-second collisions), the server accepts replies in append order and logs potential ambiguity in the server console; the files remain authoritative.

Edge cases handling:

- Partial fences: ignore and do not dispatch. Leave file as-is for the user to complete.
- Rewrites (editor save as): reparse the tail; if the previously-detected request is gone, cancel the queued job (or mark it orphaned) and notify on server console.
- Late results (post-timeout): accepted, appended, and marked in the header as `late` in the master registry.

## Error capture and formatting

- Adapter implementations SHOULD capture runtime errors into an error buffer. For browser-based adapters this typically means handling `window.error` and `unhandledrejection`; other environments should capture equivalent runtime diagnostics. Stack traces should be serialized as strings.
- When returning a result, the payload SHOULD include captured errors. The server formats errors as a comment block separated by `---` or as a fenced `Error` block in the per-instance file.

Example (success + background errors):

```
**index-7-zen** to agent at 09:34:02 (742ms)
```JSON
{"message":"ok"}
```

```
/*
TypeError: Cannot read property 'x' of undefined
    at <anonymous>:1:5
---
ReferenceError: y is not defined
    at <anonymous>:2:10
*/
```

For failures, write the raw stack (plain text) and include supplemental error buffer below.

## Job lifecycle and timing

- Job states: `requested` → `dispatched` → `completed`/`failed`/`timeout`.
- `requestedAt`: when server parses the agent request in file.
- `startedAt`: when the page polls and receives the job code (measured at `res.finish` on HTTP side).
- `finishedAt`: when the page posts back the result.
- Duration displayed in reply header is `finishedAt - startedAt`.

Timeout behaviour:

- Default job timeout: 60s (configurable).
- If timeout occurs, server writes a `timeout` entry to the per-instance file and updates master registry with `failed after <ms> (timeout)`.

## Concurrency model

- Per-instance files enable concurrent execution across different instances (e.g., multiple pages). Each instance is independent.
- Within a single per-instance file the server treats requests as strictly ordered; multiple concurrent jobs targeting the same instance are permitted but may be ambiguous — the server pairs replies using heuristics described above.


## Integrations and adapters

-- Adapter: An adapter provides the transport and runtime integration between the server and a target execution environment (for example: a browser page, a realm instance, or another host). The spec intentionally leaves the transport method open — adapters may use polling, long-polling, WebSockets, platform APIs, or other mechanisms.

  Adapters SHOULD provide at minimum:
  - a way to receive jobs (code and metadata) from the server,
  - a way to return results and runtime diagnostics to the server,
  - capture of runtime errors/diagnostics for inclusion in the per-instance log.

-- Python (stretch goal): Support for Jupyter and similar notebook environments is a possible future enhancement.
-- LISP adapters: Adapters for other environments may map their inputs and outputs into per-instance files in the same format (the fence language tag should match the realm/language used by that adapter).

## Security and safety

- The per-instance files are local to the repository and should not be served publicly. The server should ensure file writes are only performed by the local server process.
- Do not execute arbitrary administrative commands embedded in the logs. File-based REPL evaluates code only when served to a verified realm instance.

## Examples

Agent -> Browser:

```
**agent** to index-7-zen-1a2b at 22:53:49
```JS
await window._psys.loadSystem();
```

Reply (executing placeholder):

```
**index-7-zen-1a2b** to agent at 22:53:57
executing ...
```

Reply (completed):

```
**index-7-zen-1a2b** to agent at 22:53:57 (8ms)
```JSON
{"status":"loaded"}
```

## Implementation notes for `serve.js`

- Add helpers:
  - `pathForPage(page)` → absolute path to per-instance file
  - `ensureDebugDir()` → create `debug/` dir if missing
- Change FileHarness behaviour:
  - Continue to update `debug.md` master registry periodically
  - Parse and watch per-instance files for requests (debounced)
  - Write replies to the corresponding per-instance file instead of a single `DEBUG_FILE`

## Backwards compatibility

- Single-file flows MAY be supported by treating `debug.md` as a special per-instance file for a single instance (compat shim) during migration. The spec does not mandate this; implementations may provide compatibility layers as needed.

---

This document is the canonical spec for the per-instance file-based JavaScript REPL format. Implementation should aim to strictly follow the format for reliable LLM parsing and human readability.
