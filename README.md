# 👾 Daebug: Remote REPL for Live Pages

A proper file-based REPL that lets you run JavaScript code in live browser pages. Dead simple innit — the server watches Markdown files under `daebug/` and sends your code to conected pages for execution. No faff, just works.

## What's This Then?

Imagine your debugging a gnarly issue in your web app. Instead of mucking about with `console.log` everywhere, you just write JavaScript in a Markdown file and boom — it runs in your live page and spits the result back. Proper handy for LLMs and AI agents too, since they can iterate on code without breaking flow.

## Quick Start (Dead Easy)

1. **Fire up the server**: `npm start`
2. **Open your page**: Navigate to `http://localhost:8302/`
3. **Check the registry**: The server creates `daebug.md` showing all connected pages
4. **Write some code**: Create a file under `daebug/` (like `daebug/index-xyz.md`)
5. **Watch the magic**: Your code executes and results appear in the same file

## Actual Examples (Not Just Theory)

### Example 1: Quick Variable Check

Say you've got a page open and you wanna check what's in `window.location`:

```js
window.location.href
```

Chuck that in a fenced JS block in your page's daebug file, and within a second you'll see the result printed below it. Timing included and everything.

### Example 2: Testing DOM Manipulation

Need to see if that button actualy exists?

```js
document.querySelector('#submit-btn')?.innerText
```

Result comes back straight away. No need to poke around DevTools like a mug.

### Example 3: Async Operations

Works with promises too mate:

```js
fetch('/api/users')
  .then(r => r.json())
  .then(data => data.slice(0, 3))
```

The REPL waits for your promise to resolve and shows you the data. Execution time gets logged so you can spot slow endpoints.

### Example 4: Multi-Statement Code

Want to do proper calculations?

```js
(() => {
  let total = 0;
  for (let i = 1; i <= 100; i++) {
    total += i;
  }
  return total;
})()
```

Use an IIFE and you're sorted. The return value shows up in the results.

### Example 5: Debugging Event Handlers

Check if your click handler fires:

```js
const btn = document.querySelector('#mystery-button');
btn.addEventListener('click', () => console.log('Clicked innit'));
'Event listener added'
```

Console output gets capured and appears in your daebug file alongside the result. Mint.

## How It Actually Works

### File Structure

- **`daebug.md`** — Main registry showing all connected pages (server manages this)
- **`daebug/*.md`** — One file per page instance (you or your agent creates these)
- **`js/`** — Node.js server modules (the actual implementation)

The server **doesn't** create the per-instance files for you. That's on you (or your editor/agent/whatever).

### The Flow

1. Client script gets injected into your HTML (polls server every 500ms)
2. Server watches `daebug/*.md` files for new code blocks
3. When it spots new code, server sends it to the right page
4. Page executes the code in an isolated context
5. Results (or errors) get writen back to your Markdown file
6. Background stuff (console logs, errors) gets captured too

### Web Workers (Bonus)

Pages automaticaly spawn a Web Worker that **also** gets its own REPL session. So you can test worker code without the faff of setting up a seperate worker file. Proper clever that.

### Test Runner

There's even a test runner built in. You can write tests directly in the REPL:

```js
describe('my feature', () => {
  it('should do the thing', async () => {
    const result = await myFunction();
    expect(result).toBe(42);
  });
});
```

Results show up formatted nicely in the daebug file. No need for separate test infrastructure when you're just iterating quickly.

## Future Plans (Not Here Yet!)

Just so you know, these are **ideas** we're thinking about, not stuff that actually works today:

- **Rust server**: Might rewrite the orchestration layer in Rust for better performance
- **esbuild/Vite plugins**: Would be sick to integrate directly with modern build tools
- **Python REPL**: Extending beyond JavaScript to other languages

If you see docs about Rust or Vite in this repo, that's just us planning ahead. The current implementation is pure JavaScript/Node.js and it works a treat.

## Why You'd Want This

- **Fast iteration**: No build step, no page refresh (most of the time)
- **LLM-friendly**: AI agents can debug your app by writing to files
- **Stateful sessions**: Each page keeps its state between commands
- **Full error capture**: Stack traces, console output, the lot
- **Works everywhere**: If it runs JavaScript, it can run this

## Real Talk

This isn't some corporate enterprise solution with a 50-page setup guide. It's a scrappy tool that solves a real problem: running code in live pages without bollocks. If you're debugging weird browser behaviour or letting an AI agent poke at your app, this is your mate.

## More Info

- [Mission Statement: REPL for LLM Debugging](docs/0-mission.md)
- [Implementation Spec: Per-Instance Chat Logs](docs/1-jsrepl.md)
- [Testing Guide](docs/1.2-testing.md)
- [Background Events](docs/1.4-background-events.md)

---

> [MIT LICENSE](LICENSE) — Use it however you like
