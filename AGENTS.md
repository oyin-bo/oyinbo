# Directness

Always give direct answers to questions, without including any extra commentary or preamble.

# References

[README.md](README.md) - Project overview and further reading links
[docs/*](docs) - Many other documentation files
[js/*](js) - JavaScript implementation

# Using REPL for **verification**, debugging and restarting

REPL must be used to validate important changes, and debug any issues. It's AI-friendly and fast.

* REPL is always available by running the server (`npm start`) and editing files.
* To restart the server, use `%%SHUTDOWN%%` as described in [Server control and debugging](docs/1.3-workers-and-test-runner.md#server-control-and-debugging).
* Only daebug.md in the root folder is authoritative registry. Only files linked in daebug.md are accepted as live REPL sessions.
* Refreshing a page can be achieved by REPL commands too!
* Always verify the **execution timing IMMEDIATELY** when adding REPL command. It is critical and must not be skipped.
* Running any commands except `npm start` and `npm test` is very expensive and must be avoided. Use file editing tools and these two commands. That includes `timeout` command too: **very** expensive.

## Daebug REPL Quick Reference

**Finding sessions:** Open `daebug.md` in repo root. It lists all active pages with session file links.

**Adding commands:**
1. Click session link in `daebug.md` (e.g., `daebug/6-dune-2040-42.md`)
2. Scroll to bottom where prompt `> ` appears
3. Add JavaScript code block after prompt:
   ````markdown
   ```js
   your code here
   ```
   ````
4. Save file
5. Results appear within 1-2 seconds

**Command format:**
- Use `js` fenced code blocks
- Write expressions or IIFEs (e.g., `(() => { return 42 })()`)
- Promises awaited automatically
- Do NOT use top-level `return` or `await`

**Restart server:** Add `%%SHUTDOWN%%` on separate line in `daebug.md`, then run `npm start`

**Refresh page:** Send command `location.reload()` via REPL, or close/reopen browser tab

**Check timing:** Every result shows execution time (e.g., `(17ms)`). Always verify this.

# Unit Testing

**Run tests:** Use `npm test` command. Never run individual test files directly.

**Test validation:** After making changes, run tests to verify correctness. Tests must pass.

**Test failures:** Read error messages carefully. Test output shows exact line and assertion that failed.

**REPL for debugging tests:** Use daebug REPL to debug failing test scenarios in browser context.

# Code comments

Comments should explain complex or non-obvious code quirks and intent, NOT mirror code actions.

Comments always relate to the current code state, NEVER to changes made NOR to previous state.

# Rich Markdown

Use full Markdown capabilities: headings, lists, code blocks, links, images, tables.

# Directness

Always give direct answers to questions. DO NOT embellish or recommend anything unless requested.

Do not announce writing TODOs.