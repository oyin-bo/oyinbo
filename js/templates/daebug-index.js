// @ts-check

/**
 * Template for daebug.md index
 * @param {{ startTime: string, pageList?: string, isShutdown?: boolean, endTime?: string }} params
 * @returns {string}
 */
export function daebugIndex({ startTime, pageList = '', isShutdown = false, endTime = '' }) {
  return `# 👾 Daebug remote debugging REPL${isShutdown ? `: SERVER SHUT DOWN ${endTime}` : ` started ${startTime}`}
> ${isShutdown ? 'This debugging session has concluded.' : 'Interactive debugging REPL sessions for live browser contexts'}

${isShutdown ?
    `The REPL server has been shut down. Total uptime was from ${startTime} to ${endTime}.` :
    `This file tracks all active debugging sessions. Each entry represents a connected page or web worker where you can execute JavaScript code and see results in real-time.`}

${isShutdown ? 
      `
To begin a new debugging session:

${'```'}
npm start
${'```'}
` :
      `
## Active Sessions

${pageList}
`}

## How to Use

**Key Features:**
- **Live execution**: Code runs in actual browser/worker contexts, not simulated
- **Async/await support**: Promises resolve naturally, no special handling needed
- **Multi-realm**: Main pages and their web workers are tracked separately
- **File-based protocol**: No IDE plugins required, just edit Markdown files

**Workflow:**
1. Open any session file from the list above
2. Scroll to bottom and add code in a JS fenced block (after the prompt line)
3. Save the file
4. Results appear automatically within 1-2 seconds

## Restart

To exit write \`%%SHUTDOWN%%\` **in this file on a separate line,** then run \`npm start\` again.
`;
}
