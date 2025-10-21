// @ts-check
import { relative } from 'node:path';

/**
 * Format milliseconds as HH:MM:SS time string
 * @param {number} ms
 * @returns {string}
 */
function clockFmt(ms) {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
}

/**
 * Template for daebug.md index
 * @param {{
 *   startTime: number|Date,
 *   pageList?: Array<{name: string, url: string, file: string, state: string, lastSeen: number}>,
 *   isShutdown?: boolean,
 *   endTime?: number|Date,
 *   root?: string
 * }} params
 * @returns {string}
 */
export function daebugMD_template({ startTime, pageList = [], isShutdown = false, endTime, root }) {
  // Normalize timestamps to milliseconds
  const startMs = startTime instanceof Date ? startTime.getTime() : startTime;
  const endMs = endTime instanceof Date ? endTime.getTime() : endTime;
  
  // Format time strings
  const startTimeStr = new Date(startMs).toLocaleTimeString();
  const endTimeStr = endMs !== undefined ? new Date(endMs).toLocaleTimeString() : '';
  
  // Format page list as markdown
  const pageListStr = pageList
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .map(p => {
      const filePath = root ? relative(root, p.file).replace(/\\/g, '/') : p.file.replace(/\\/g, '/');
      return `* [${p.name}](${filePath}) (${p.url}) at ${new Date(p.lastSeen).toLocaleTimeString()}: ${p.state === 'idle' ? 'live' : p.state}`;
    })
    .join('\n');

  return `# 👾 Daebug remote debugging REPL${isShutdown ? `: SERVER SHUT DOWN ${endTimeStr}` : ` started ${startTimeStr}`}
> ${isShutdown ? 'This debugging session has concluded.' : 'Interactive debugging REPL sessions for live browser contexts'}

${isShutdown ?
    `The REPL server has been shut down. Total uptime was from ${startTimeStr} to ${endTimeStr}.` :
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

${pageListStr}
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
