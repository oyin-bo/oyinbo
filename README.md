# 👾 DAEBUG: Remote REPL for Live Debugging

A file-based REPL that lets you run JavaScript in live browser pages proper quick. Write code in Markdown files, the server sends it to your page, and results come back automatically. No messing about with DevTools or manual console input — just files what you can edit.

## What it does innit

You know when you're debugging something and you need to poke at it whilst it's running? That's what this is for. The server it watches Markdown files where you write code, your browser page picks up that code and runs it, then writes results back to the same file. Simple.

**Key thing**: The server watches files you create under `daebug/` directory and coordinates execution. The browser polls for jobs and runs them. All results go back into those files for keeps.

## Quick start

**Install it globally:**
```bash
npm install -g daeb.ug
```

**Start the server** in your project:
```bash
cd /path/to/your-project
daebug
```

The server starts and tells you the URL (usually something like `http://localhost:8302/`). Open that in your browser.

**Create a REPL file** for interacting with your page:
```bash
mkdir -p daebug
echo "> Write code in a fenced JS block below to execute against this page." > daebug/my-page.md
```

**Add code** to the file `daebug/my-page.md`:
````markdown
> **agent** to my-page at 10:30:00
```JS
document.title = 'Changed by REPL'
```
````

Within a second or two, the server picks up your code, sends it to the browser, and the result appears in the same file:
````markdown
> **my-page** to agent at 10:30:01 (12ms)
```JSON
"Changed by REPL"
```
````

That's it basically. You've now got a proper persistent debugging session what you can review later.

## Real examples to show you how

### Example 1: Check if a module has loaded
You're working on a SPA and need to verify that window object has your module attached proper like:

````markdown
> **dev** to dashboard at 14:23:10
```JS
window.myApp ? 'Loaded' : 'Not loaded'
```
````

Results come back:
````markdown
> **dashboard** to dev at 14:23:10 (3ms)
```JSON
"Loaded"
```
````

### Example 2: Test API responses quick
You want seeing what an API returns without setting up loads of test infrastructure innit:

````markdown
> **dev** to dashboard at 14:25:33
```JS
await fetch('/api/users/me')
  .then(res => res.json())
  .then(data => ({ status: 'success', user: data }))
```
````

Response appears below:
````markdown
> **dashboard** to dev at 14:25:34 (243ms)
```JSON
{"status":"success","user":{"id":42,"name":"Alice"}}
```
````

### Example 3: Debug that annoying state problem
Component state is acting weird and you need inspecting it:

````markdown
> **dev** to app at 15:10:22
```JS
// Assuming React DevTools globals exist
$r.state
```
````

### Example 4: Background errors what get captured
Sometimes errors happen in timers or promises. The REPL catches those automatically:

````markdown
> **dev** to page at 16:45:10
```JS
setTimeout(() => { throw new Error('Whoops') }, 100)
'Code ran'
```
````

Result:
````markdown
> **page** to dev at 16:45:10 (3ms)
```JSON
"Code ran"
```

```Error
16:45:10 window.onerror
Error: Whoops
    at setTimeout (eval at <anonymous>...
```
````

See how background errors are captured even though your code returned fine? Proper useful for catching async failures.

### Example 5: Multi-statement debugging
Need to doing several things in sequence:

````markdown
> **dev** to page at 17:02:33
```JS
const user = await fetch('/api/user').then(r => r.json())
console.log('User:', user)
return user.permissions
```
````

### Example 6: Check localStorage quick
````markdown
> **dev** to page at 09:15:00
```JS
Object.keys(localStorage).map(k => [k, localStorage[k]])
```
````

## How files is organised

After running for a bit, you'll be having:

```
daebug.md                  # Registry showing connected pages (server-managed)
daebug/
  my-page.md              # Per-page chat logs (you create these)
  dashboard.md
  admin-panel.md
```

The `daebug.md` file is updated by server and shows you what pages are connected. The files inside `daebug/` directory are your actual REPL sessions — one file per page.

**Important**: You must create the `daebug/` directory and per-page files yourself. Server won't create them automatic like. This is deliberate so you control what gets debugged.

## File format (for LLMs and humans)

Each REPL file is a conversation between you (the "agent") and the page. Format is proper simple:

**Your request:**
````markdown
> **agent-name** to page-name at HH:MM:SS
```JS
code here
```
````

**Page response:**
````markdown
> **page-name** to agent-name at HH:MM:SS (17ms)
```JSON
result here
```
````

The server manages timestamps and execution duration. You just add code blocks at the bottom.

## Command-line options

```bash
daebug [options]

Options:
  --root, -r <path>      Root directory to serve (default: current directory)
  --port, -p <number>    Port to listen on (default: derived from directory name)
  --help, -h            Show help
  --version, -v         Show version
```

The default port is derived from your directory name (hash-based, between 8100-9099) so different projects get different ports automatic. Clever innit.

## Web Workers and test runner

The browser client creates Web Workers automatically what also connect to the REPL. You can run tests in workers and get structured results back. Check [docs/1.3-workers-and-test-runner.md](docs/1.3-workers-and-test-runner.md) for the full story.

## Future plans (not implemented yet)

Some features are planned but **not actually working yet**:
- **Rust server**: Docs mention a Rust implementation but it's just conceptual ([docs/2-rust.md](docs/2-rust.md))
- **esbuild/Vite plugins**: We want to integrate with build tools but that's future work ([docs/1.6-esbuild-vite.md](docs/1.6-esbuild-vite.md))

For now, you've got the Node.js server what works a treat.

## More documentation

Want the proper detailed specs?

- [Mission statement](docs/0-mission.md) — Why this exists and what it's trying to do
- [File format spec](docs/1-jsrepl.md) — Complete specification of the file-based protocol
- [Example session](docs/1.1-example.md) — Full example showing multiple interactions
- [Testing guide](docs/1.2-testing.md) — How to using the test runner
- [Background events](docs/1.4-background-events.md) — How console and errors get captured

## Why it's file-based

Files are brilliant for LLM debugging because:
- **Persistent**: History stays around so you can review what happened
- **Auditable**: Everything is logged with timestamps and duration
- **Multi-agent**: Different tools can all work with same files
- **Reliable**: No websocket disconnections or lost messages
- **Simple**: Just Markdown, no special formats or protocols

An LLM can edit files proper easy, and the results come back in a format what's easy to parse.

## Licence

[MIT](LICENSE) — Do what you want with it.

## Tips and tricks

**Multiple pages?** Create a file for each. The server handles multiple concurrent sessions no problem.

**Restart server quick?** Add `%%SHUTDOWN%%` to `daebug.md` and the server exits graceful. Proper useful during development.

**Long-running code?** Default timeout is 60 seconds. If your code takes longer time, you'll get a timeout error.

**Security?** This is a development tool. Don't expose the server to public internet — it runs arbitrary code what you write in files.
