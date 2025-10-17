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

Instructive header (human-friendly guidance)

Each per-instance log file and the master registry (`debug.md`) SHOULD include a short, human-friendly instructive header near the top of the file. The goal is to let a human or an LLM arriving at the file immediately understand what the file is and how to use it — keep the header short, plain-language, and friendly.

Recommended guidance for the instructive header:

- Place the header near the top of the file, immediately after the title line if the file has one.
- Render the header as one or two Markdown blockquote lines (prefix with `> `) so it is visually distinct yet still part of the document.
- Keep the text short and non-technical (one sentence preferred, two sentences maximum). Avoid verbatim technical grammar or parser-focused tokens.
- Do not use the agent request header grammar (avoid lines that look like `> **agent** to ...`) — parsers will ignore the instructive header and scan from the file tail for actionable requests.

Suggested phrasing (per-instance file):

> This file is a REPL presented as a chat between you and a live page. Add a fenced JavaScript block at the bottom and the connected page will run it; the result will be printed below. Please do not edit server-inserted replies or the append anchor.

Suggested phrasing (master `debug.md`):

> Master registry of connected pages and states. Do not edit server-updated lines here; open a page's per-instance log to run code against that page.

Server behaviour note: The server may update or normalize these headers over time but should preserve the user's human text where reasonable. Parsers MUST treat the header as non-actionable guidance and continue to locate agent requests by scanning the file tail for the canonical request header and complete fenced blocks.

## Per-instance chat-log format

Each per-instance file is an append-only conversation between one or more agents and the realm instance. The format is deliberately human-first and deterministic for automated parsing.

Rules (authoritative):

Agent request header (exact):

```
> **<agent-name>** to <page-name> at HH:MM:SS
```

Followed immediately by a fenced code block with the language tag (JS recommended):

```
```JS
<code...>
```
```

Page reply header (accepted forms):

```
> **<page-name>** to <agent-name> at HH:MM:SS
```

Or, for errors/delays, include the `(**ERROR** after <duration>)` marker:

```
> **<page-name>** to <agent-name> at HH:MM:SS (**ERROR** after 16ms)
```

Result content follows. For successful evaluations use `JSON` fenced block or `Text` when appropriate. For error stacks use `Error` fenced block or plain text stack.

Formatting rule: after a reply has been injected and the execution is finished (success or failure), there MUST be a single blank line following the reply block. This ensures parsers and human readers can reliably detect the file tail and append new requests.

Examples:

Agent request:

```
> **agent** to index-7-zen at 22:52:47
```JS
12+13
```

Page reply (success):

```
> **index-7-zen** to agent at 22:52:48 (17ms)
```JSON
25
```


Page reply (error):

```
> **index-7-zen** to agent at 22:52:48 (**ERROR** after 16ms)
```Error
Error: test error
  at eval (eval at <anonymous> (http://localhost:8302/:112:37), <anonymous>:1:7)
  at inject (http://localhost:8302/:112:37)
```


Important rules:

- Timestamps are human per-second `HH:MM:SS`. If absent, server uses file-mtime (if after last edit and before now) or now as fallback.
- Duration: always reported when available in parentheses next to reply header (ms or seconds if >2000ms). This is a required signal for verification.
- Fences must be closed; incomplete fences are treated as drafts and not dispatched.

## Agent input: text (or Markdown) alongside executable code

- Agent chunks may include plain text or Markdown commentary before and/or after an executable fenced code block. This is permitted and preserved by the server.
- Dispatch rules:
  - The agent request header line (the exact header shown above) MUST appear at the top of the newly appended chunk for it to be considered an actionable request.
  - The server locates the complete fenced code block (or blocks, if muiltiple they will be processed sequentially) after that header in the appended chunk and treats that fenced block as the executable payload. If no complete fenced block is present the chunk is treated as a draft and is not dispatched.
  - If multiple fenced blocks are present, the first complete fenced block after the header is executed first; then each of the remaining blocks one after another in sequence.
- Execution and result injection:
  - The code in each fenced block sequentially is executed by the realm and the result (or error) is injected directly beneath that fenced block in the per-instance file using the normal reply format (reply header + fenced JSON/Text/Error block).
  - Any commentary or Markdown that was before or after the executed code block remains in place and is not removed by the server.
- Partial/incomplete fences: remain drafts and are ignored (not dispatched). Editors may continue to edit the chunk until fences are closed.

## Parser heuristics

The server watches per-instance files and parses only the bottom-most chunk (tail) to detect new agent requests. Parsing must be debounced (recommended 150ms) to avoid catching writes-in-flight.

Single-request model (canonical behaviour):

- At most one outstanding REPL request exists per per-instance file. This simplifies pairing and makes the file authoritative: replies are assumed to belong to the single outstanding request.
- When no job is outstanding and the tail contains a valid agent request header plus at least one complete fenced code block, create a Job and enqueue it for that page instance. The server then accepts the request and begins the execution lifecycle described in the "Footer anchor and dynamic lifecycle (detailed)" section.
- If a page reply (or reply-looking content) is observed while a job is outstanding, treat it as the reply for the current job. Do not attempt nearest-prior matching across multiple outstanding jobs (there are none).
- If a reply is observed while no job is outstanding, record it as a background diagnostic (for example, write a short `Error` or `Text` block) rather than attempting to retroactively match it.

Edge cases handling:

- Partial fences: ignore and do not dispatch. Leave file as-is for the user to complete.
- Rewrites (editor save as): reparse the tail; if the previously-detected request is gone, cancel the queued job (or mark it orphaned) and notify on server console and in-file diagnostics.
- Late results (post-timeout): accepted, appended, and marked in the header as `late` in the master registry. If a late result arrives but no job is outstanding, append a diagnostic note instead of attempting to match.

## Error capture and formatting

- Adapter implementations SHOULD capture runtime errors into an error buffer. For browser-based adapters this typically means handling `window.error` and `unhandledrejection`; other environments should capture equivalent runtime diagnostics. Stack traces should be serialized as strings.
- When returning a result, the payload SHOULD include captured errors. The server formats errors as aa fenced `Error` block in the per-instance file.

Example (success + background errors):

```
**index-7-zen** to agent at 09:34:02 (742ms)
```JSON
{"message":"ok"}
```

```Error
TypeError: Cannot read property 'x' of undefined
    at <anonymous>:1:5

ReferenceError: y is not defined
    at <anonymous>:2:10
```

For failures, write the raw stack (plain text) and include supplemental error buffer below.

## Background capture: global errors and console events

To improve debugging, adapters SHOULD capture background runtime activity in addition to direct REPL results. Background events include:

- Global unhandled errors (`window.onerror` and `unhandledrejection` equivalents).
- Console activity: `console.error`, `console.warn`, `console.info`, and `console.log`.

Rules and formatting:

- Buffering: maintain a per-instance background buffer of events. When serializing to the per-instance file include at most 10 entries. If more than 10 entries exist, serialize the first 2 entries, then a single ellipsis placeholder, then the last 8 entries. Use the placeholder format:

  ... (N more background events omitted) ...

- Entry shape: each background event should be an object with at least `{type, level, ts, message, stack?}`. `ts` should be human `HH:MM:SS`.

- Fence metadata for background entries: when writing background or console content use a fence info string that combines the fence language and the source, e.g. ````Error window.onerror```` or ````JSON console.log````. The first token (language) remains the conventional language id and the remaining token(s) are free-form metadata indicating source/level.

- Placement: when a REPL reply is written, append all unflushed background events that occurred up to `finishedAt` immediately after the reply's result block(s). Do NOT insert an extra blank line between the reply result block and the first background block. Background blocks are appended one after another as fenced blocks (Error, JSON, Text, etc.). The reply header remains at the top of the combined output.

- Background-only updates: when there is no REPL reply to attach to, the server may flush background events on their own. In that case use a background-only header:

  > **<page-name>** background at HH:MM:SS

  followed by the batched background fenced blocks.

- Footer anchor: after all reply and background blocks, append a single-line footer starting with `> ` to provide an append anchor for editors and LLMs. For example:

  Footer anchor behaviour (single, managed footer):

  - There MUST be at most one footer line in the file at any time. The footer is a single human-readable line that starts with `> ` and acts as the append anchor for agent requests. Example:

    > Write code in a fenced JS block below to execute against this page.

  - The server is responsible for managing this footer line:
    - When tooling or an agent appends a request block, the server removes the footer before inserting the request. This ensures the footer never appears above an agent-added chunk.
    - While a job is executing the server may keep the footer removed; once execution completes (success/failure/timeout), the server re-appends the single footer at the file tail.
    - Background events always append above the footer (they push the footer down). The footer remains the final line in the file after any background-only flushes or reply+background writes.

  - Parsers and tooling MUST treat the single footer line as the canonical append anchor. The presence or absence of the footer is also a useful signal: absence usually indicates a request is currently being inserted/executed.


  Footer anchor and dynamic lifecycle (detailed)

  The footer is the canonical append anchor and also the natural partition between historical content and the active tail. The server manages a single footer line (configurable) which must be treated as the authoritative append anchor by editors, tooling and parsers.

  Canonical footer example (single line):
  > Write code in a fenced JS block below to execute against this page.

  High-level lifecycle (server-managed)

  1. Footer present and idle: the footer is the final line. Any content inserted below the footer by an agent is considered a candidate request and is ignored by parsers until the server accepts it.
  2. Agent appends request below footer: the server scans from the file bottom to find the canonical footer, reads the active tail region above it, and accepts the presence of an agent request header (optional) and at least one complete fenced code block. If no complete fence is present the chunk is treated as a plain text and the footer is moved below it.
  3. Server accepts request: the server removes the footer and injects a server-managed agent-request header above the agent's snippet (if not already present). Immediately after the agent's snippet the server inserts a "currently executing" announcement header, then a short placeholder line (the placeholder is the visible executing marker). Background updates are written between the announcement header and the placeholder.
  4. While executing: background events (console/errors) are collected in-memory as a textual block. On each background update the server swaps the text in the active region between the executing-announcement header and the placeholder with the new background text (applying truncation/compression if needed). The placeholder remains after this block. Placeholder text (elapsed time) is updated at a capped cadence (default: once every 5s) to avoid editor churn.
  5. Completion: when a result arrives the server replaces the placeholder with the final reply header(s) and fenced result blocks, appends any remaining background text up to finishedAt, and then re-appends the canonical footer as the final line.

  Placement rules (exact ordering)

  - Server-inserted agent-request header: injected immediately above the agent's appended request chunk.
  - Executing announcement header: injected immediately below the agent's request chunk.
  - Background text: injected below the executing announcement header and above the placeholder; background updates replace the prior background text chunk (in-memory swap), they are not appended as separate, cumulative fenced blocks during execution.
  - Placeholder: a short single-line visible marker (e.g. "executing (0s)") that remains after the background region until replaced by final results.

  Counting-from-footer semantics

  To tolerate arbitrary user edits elsewhere in the file, the server locates the active region by finding the canonical footer and working backwards. All live operations for an accepted job operate on the portion of the file between the last server-inserted reply (or file head) and the footer. The server must not rely on file byte offsets recorded earlier; instead it should identify content by searching from the footer for the remembered server header strings when performing recovery.

  Background text and truncation

  - Background text kept in memory is a single textual representation used to render the background region; adapters need only provide textual content for each event — the server does not need to retain full event objects on disk.
  - When serializing a background buffer with more than 10 entries, use the first-2 / ellipsis / last-8 compression format exactly as described above. The ellipsis line should state how many entries were omitted: "... (N more background events omitted) ...".
  - Ordering: append background events in the order received. Do not reorder by timestamp or other keys.

  Placeholder update cadence

  - Update the executing placeholder no more often than once every 3–10 seconds. Default recommended cadence: 5 seconds.
  - Placeholder updates only change the placeholder line (elapsed time); they must not alter the background text or server headers.

  Recovery and disruption rules

  - If the executing-announcement header is edited or removed during execution, attempt recovery by searching backward from the footer for the server-remembered agent-request header. If found, re-insert the executing announcement header below it and continue (preserving in-memory background text).
  - If recovery fails (the remembered agent header cannot be located), write a short Markdown notice into the file documenting the disruption, declare the job cancelled/failed in the file, re-append the canonical footer, and clear the in-memory job state.
  - If the agent edits the request chunk during execution (allowed), the server policy is to treat such edits conservatively: if edits occur before the server accepted the request, treat as draft; if edits occur after acceptance but before start, cancel and notify, or optionally accept with careful re-validation — implementer choice, but cancellation is safest.

  Matching and single-request model

  There is at most one outstanding REPL request per per-instance file. Because of this, replies are assumed to correspond to the single current request. Unexpected replies (page writes a reply while no outstanding request exists) should be recorded in the file as a background or diagnostic note (for example as an `Error` block or a short Markdown notice) rather than attempting complex matching.

  Writes and update strategy

  - To keep the implementation simple and human-friendly the server will start with full-file read-modify-write semantics (read entire file, compute new content, write entire file). This avoids early complexity with rename/replace strategies.
  - Full-file write tradeoffs: simple to implement and generally safe for the human/LLM use-case; however a partial write during a crash could leave temporarily inconsistent files. If this proves problematic in practice the server can be upgraded to write via a temp-file + rename/replace strategy for atomic replacement.
  - If using full-file write, add a simple verification step after write: re-open the file and confirm the canonical footer (or the server-inserted header) exists. If verification fails, retry the write up to a small retry limit.

  In-memory job state

  While a job is executing the server keeps the following minimal in-memory state for the per-instance file:
  While a job is executing the server keeps the following minimal in-memory state for the per-instance file:
  - agentName, pageName
  - requestedAt (server-accept time)
  - snapshot of the active chunk (string)
  - backgroundText (string)
  - lastPlaceholderUpdate timestamp

  Diagnostics and unexpected events

  - Any surprising or ambiguous writes (missing headers, late replies, or other anomalies) should be written into the per-instance file as human-readable notes (for example under an `Error` block or `Text` block) so the developer and LLM can see what happened.



- Example fence metadata uses:

  - `Error window.onerror` — captured global error stack
  - `Error unhandledrejection` — captured promise rejection
  - `JSON console.log` or `Text console.info` — serialized console output

Implementation notes:

- Adapters should wrap/monkeypatch console methods and register `window.onerror` / `unhandledrejection` handlers to capture events into the per-instance buffer.
- The buffer may be in-memory by default; persisting to disk is optional. Ensure ordering is chronological and flush semantics align with job lifecycle (include unflushed events up to `finishedAt`).

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

- Per-instance files enable concurrent execution across different instances (e.g., multiple pages). Each instance is independent.
- Within a single per-instance file there is at most one outstanding REPL job at a time. Replies are assumed to correspond to the currently active job. Unexpected replies (for example, a reply written when no job is outstanding) should be recorded in-file as diagnostic notes rather than attempting to match them to other jobs.


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
> **agent** to index-7-zen-1a2b at 22:53:49
```JS
await window._psys.loadSystem();
```

Reply (executing placeholder):

```
> **index-7-zen-1a2b** to agent at 22:53:57
executing ...
```

Reply (completed):

```
> **index-7-zen-1a2b** to agent at 22:53:57 (8ms)
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
