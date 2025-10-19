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
* Only debug.md in the root folder is authoritative registry. Only files linked in debug.md are accepted as live REPL sessions.
* Refreshing a page can be achieved by REPL commands too!
* Always verify the **execution timing IMMEDIATELY** when adding REPL command. It is critical and must not be skipped.
* Running any commands except `npm start` and `npm test` is very expensive and must be avoided. Use file editing tools and these two commands. That includes `timeout` command too: **very** expensive.

# Code comments

Comments should explain complex or non-obvious code quirks and intent, NOT mirror code actions.

Comments always relate to the current code state, NEVER to changes made NOR to previous state.

# Rich Markdown

Use full Markdown capabilities: headings, lists, code blocks, links, images, tables.

# Directness

Always give direct answers to questions. DO NOT embellish or recommend anything unless requested.

Do not announce writing TODOs.