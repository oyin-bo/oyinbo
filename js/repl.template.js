// @ts-check

/**
 * Format milliseconds as HH:MM:SS time string
 * @param {string} iso ISO timestamp string (e.g. new Date().toISOString())
 * @returns {string}
 */
export function clockFmt(iso) {
  // Expect an ISO timestamp string only (no numeric ms allowed)
  const when = Date.parse(iso);
  const d = new Date(when);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
}

/**
 * Format duration as human-readable time (e.g. "2.5s" or "150ms")
 * @param {number} ms
 * @returns {string}
 */
export function durationFmt(ms) {
  return ms >= 2000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

/**
 * Find the footer line that marks the REPL input area
 * @param {string[]} lines
 * @returns {number} Index of footer line or -1 if not found
 */
export function findFooter(lines) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('> Append your JavaScript snippet below')) {
      const prevLine = lines[i - 1]?.trim() || '';
      if (prevLine.startsWith('--') && prevLine.endsWith('--') && prevLine.replace(/-/g, '').trim() === '')
        return i -1;
      else
        return i;
    }
  }
  return -1;
}

/**
 * Find the last fenced code block (JS/javascript or unlabeled)
 * @param {string[]} lines
 * @returns {{start: number, end: number} | null}
 */
export function findLastFencedBlock(lines) {
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^```/.test(lines[i].trim())) { end = i; break; }
  }
  if (end < 0) return null;
  for (let i = end - 1; i >= 0; i--) {
    if (/^```(?:\s*(?:js|javascript))?/.test(lines[i].trim())) return { start: i, end };
  }
  return null;
}

/**
 * Find agent header line above a given index
 * @param {string[]} lines
 * @param {number} startIdx
 * @returns {number} Index of agent header or -1 if not found
 */
export function findAgentHeaderAbove(lines, startIdx) {
  let idx = startIdx - 1;
  while (idx >= 0 && !lines[idx].trim()) idx--;
  // Check for old format: > **agent** to
  if (idx >= 0 && /^>\s*\*\*/.test(lines[idx].trim())) return idx;
  // Check for new format: ### 🗣️agent to
  if (idx >= 0 && /^###\s*🗣️/.test(lines[idx].trim())) return idx;
  return -1;
}

/**
 * Find an executing block (agent header + "executing" placeholder)
 * @param {string[]} lines
 * @param {string} page
 * @param {string} agent
 * @returns {{headerIdx: number, placeholderIdx: number} | null}
 */
export function findExecutingBlock(lines, page, agent) {
  const footerIdx = findFooter(lines);
  if (footerIdx < 0) return null;
  for (let i = footerIdx - 1; i >= 0; i--) {
    // Check for old format: > **page** to agent at
    if (lines[i].startsWith(`> **${page}** to ${agent} at `) && /^executing \(/.test((lines[i + 1] || '').trim())) {
      return { headerIdx: i, placeholderIdx: i + 1 };
    }
    // Check for new format: #### 👍page or #### 🚫page to agent at
    if (/^#{4}\s*[👍🚫]/.test(lines[i]) && lines[i].includes(`${page} to ${agent} at `) && /^executing \(/.test((lines[i + 1] || '').trim())) {
      return { headerIdx: i, placeholderIdx: i + 1 };
    }
  }
  return null;
}

/**
 * Format file header (level-1 heading)
 * @param {string} title Session title
 * @returns {string}
 */
export function formatFileHeader(title) {
  return `# ${title}`;
}

/**
 * Format session guide section
 * @returns {string}
 */
export function formatSessionGuide() {
  return `This file contains a live debugging session. It allows you to execute JavaScript code in a remote browser or runtime environment and see the results in real-time.

## Short Guide

- **Plain-text notes:** Add context before each request explaining what you're trying to do and why.
- **Chain of thought:** Describe your hypothesis, what you're checking, and observations at any point of your work.
- **Section headers:** Use level-2 headers (\`##\`) to mark substantial debugging turns. Add a short note on your plan below the header.
- **Cleanup:** As sessions grow long, replace old irrelevant chunks between level-2 section headers with 1-paragraph summaries.
- **Simple requests:** Start with basic expressions like \`1+1\`, \`Object.keys(window)\` to verify connectivity
- **Test runs:** Use \`(await import('node:test')).run();\` to execute tests and review output
- **Async code:** Use \`async/await\` freely; the REPL supports top-level await
- **Timestamp:** When appending your JavaScript code snippet at the end of the file, immediately verify the timestamp. IT'S A CRITICAL SAFETY CHECK!
`;
}

/**
 * Ensure file has header and guide section (idempotent operation)
 * @param {string[]} lines File lines array
 * @param {string} defaultTitle Default title if header not found
 * @returns {string[]} Modified lines array with header/guide if needed
 */
export function ensureFileHeader(lines, defaultTitle) {
  // Scan first 20 lines for level-1 header
  const scanLimit = Math.min(20, lines.length);
  for (let i = 0; i < scanLimit; i++) {
    if (/^# /.test(lines[i])) {
      // Header found, return unchanged
      return lines;
    }
  }
  
  // No header found, prepend header and guide
  const headerLine = formatFileHeader(defaultTitle);
  const guideLines = formatSessionGuide().split('\n');
  const separator = '---';
  
  return [headerLine, '', ...guideLines, '', separator, '', ...lines];
}

/**
 * Format agent/sender header (for requests being sent to a page)
 * @param {string} agent Name of the agent/sender
 * @param {string} target Name of the target/page
 * @param {string} ts ISO timestamp string
 * @returns {string}
 */
export function formatAgentHeader(agent, target, ts) {
  return `### 🗣️${agent} to ${target} at ${clockFmt(ts)}`;
}

/**
 * Format reply header (response from a page)
 * @param {string} page Name of the page
 * @param {string} agent Name of the agent
 * @param {string} ts ISO timestamp string
 * @param {number} dur Duration in milliseconds
 * @param {boolean} err Whether there was an error
 * @returns {string}
 */
export function formatReplyHeader(page, agent, ts, dur, err) {
  const emoji = err ? '🚫' : '👍';
  return `#### ${emoji}${page} to ${agent} at ${clockFmt(ts)} (${durationFmt(dur)})`;
}

/**
 * Format a JS code block
 * @param {string} code
 * @returns {string}
 */
export function formatCodeBlock(code) {
  return `\`\`\`JS\n${code}\n\`\`\``;
}

/**
 * Format a single background event as a fenced block with level-5 header
 * @param {{type: string, level?: string, source?: string, eventAt?: string, message: string, stack?: string, caller?: string}} event
 * @returns {string}
 */
export function formatBackgroundEvent(event) {
  if (event.type === 'error') {
    const emoji = '🚫';
    const eventLabel = event.source || 'window.onerror';
    const fenceType = event.source || 'Error';
    let content = event.stack || event.message;
    // Only use canonical eventAt (ISO) for display. Presentation-only fields are not transported.
    if (event.eventAt && content) {
      const lines = content.split('\n');
      if (lines.length > 0 && lines[0].trim()) {
        lines[0] = lines[0].trimEnd() + ' ' + clockFmt(event.eventAt);
        content = lines.join('\n');
      }
    }

    return `##### ${emoji}${eventLabel}\n\`\`\`${fenceType}\n${content}\n\`\`\``;
  } else if (event.type === 'console') {
    const level = event.level || 'log';
    let emoji = '☑️'; // Default for console.log
    let fenceType = 'Text';
    
    // Select emoji based on console level
    if (level === 'error' || level === 'warn') {
      emoji = '🆘';
    } else if (level === 'info') {
      emoji = 'ℹ️';
    } else if (level === 'debug') {
      emoji = '🔢';
    }
    
    // Check if message is JSON
    try {
      JSON.parse(event.message);
      fenceType = 'JSON';
    } catch (e) {
      // Not JSON
    }
    if (level === 'error') fenceType = 'Error';
    
    const eventLabel = `console.${level}`;
    const metadata = `console.${level}`;
    
    let content = event.message;
    if (event.caller && event.caller.trim()) {
      content = `${event.caller}\n${event.message}`;
    }

    // Only use canonical eventAt for console metadata display
    if (event.eventAt) {
      const lines = content.split('\n');
      if (lines.length > 0 && lines[0].trim()) {
        lines[0] = lines[0].trimEnd() + ' ' + clockFmt(event.eventAt);
        content = lines.join('\n');
      }
    }

    return `##### ${emoji}${eventLabel}\n\`\`\`${fenceType} ${metadata}\n${content}\n\`\`\``;
  }
  
  return `##### 🔢event\n\`\`\`Text\n${event.message}\n\`\`\``;
}

/**
 * Format result blocks (value, error, or background events)
 * @param {{ok: boolean, value?: any, error?: any, errors?: string[], backgroundEvents?: any[]}} result
 * @returns {string[]} Array of formatted blocks
 */
export function formatResultBlocks(result) {
  const blocks = [];
  
  if (result.ok) {
    const val = result.value;
    const jsonStr = val && typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
    blocks.push(`\`\`\`JSON\n${jsonStr}\n\`\`\``);
  } else {
    const errorStr = String(result.error);
    blocks.push(`\`\`\`Error\n${errorStr}\n\`\`\``);
  }
  
  // Handle new backgroundEvents structure
  if (result.backgroundEvents?.length) {
    const events = result.backgroundEvents.length > 10
      ? [
          ...result.backgroundEvents.slice(0, 2),
          { type: 'ellipsis', message: `... (${result.backgroundEvents.length - 10} more background events omitted) ...` },
          ...result.backgroundEvents.slice(-8)
        ]
      : result.backgroundEvents;
    
    for (const event of events) {
      if (event.type === 'ellipsis') {
        blocks.push(`\n${event.message}\n`);
      } else {
        blocks.push(formatBackgroundEvent(event));
      }
    }
  }
  // Backward compatibility: handle old errors array
  else if (result.errors?.length) {
    const errs = result.errors.length > 10
      ? [...result.errors.slice(0, 2), `... (${result.errors.length - 10} more background events omitted) ...`, ...result.errors.slice(-8)]
      : result.errors;
    for (const err of errs) {
      blocks.push(err.includes('...') ? `\n${err}\n` : `\`\`\`Error\n${err}\n\`\`\``);
    }
  }
  
  return blocks;
}

/**
 * Format the footer separator with REPL instructions
 * @returns {string}
 */
export function formatFooter() {
  return (
    `----------------------------------------------------------------------
> Append your JavaScript snippet below to execute against this page.


`);
}

/**
 * @typedef {{
 *   agent: string,
 *   target: string,
 *   time: string,
 *   code: string,
 *   hasFooter: boolean
 * }} ParsedRequest
 */

/**
 * Parse a REPL request from markdown text
 * @param {string} text
 * @param {string} pageName
 * @returns {ParsedRequest | null}
 */
export function parseRequest(text, pageName) {
  const lines = text.split('\n');
  let footerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('> Append your JavaScript snippet below')) { 
      footerIdx = i; 
      break; 
    }
  }

  if (footerIdx >= 0) {
    const chunk = lines.slice(footerIdx + 1).join('\n');
    if (!chunk.trim()) return null;
    
    // Try new format first (level-3 heading with emoji)
    const newAgentRe = /^###\s*🗣️(\S+)\s+to\s+(\S+)\s+at\s+(\d{2}:\d{2}:\d{2})\s*$/;
    // Fall back to old format (blockquote)
    const oldAgentRe = /^>\s*\*\*(\S+)\*\*\s+to\s+(\S+)\s+at\s+(\d{2}:\d{2}:\d{2})\s*$/;
    
    let headerMatch = newAgentRe.exec(lines[footerIdx + 1]);
    if (!headerMatch) {
      headerMatch = oldAgentRe.exec(lines[footerIdx + 1]);
    }
    
    const codeChunk = lines.slice(footerIdx + 1 + (headerMatch ? 1 : 0)).join('\n');
    const codeMatch = /```(?:\s*(?:js|javascript))?\s*\n([\s\S]*?)```/i.exec(codeChunk);
    
    if (!codeMatch?.[1]?.trim()) return null;
    
    const code = codeMatch[1].endsWith('\n') ? codeMatch[1].slice(0, -1) : codeMatch[1];

    // Reject if code starts with a response header (old or new format)
    if (/^(>|\#{3,4})\s*(\*\*\S+\*\*|[👍🚫]\S+)\s+to\s+\S+/.test(code.trim())) return null;

    return {
      agent: headerMatch?.[1] || 'agent',
      target: headerMatch?.[2] || pageName,
      time: headerMatch?.[3] || '',
      code: code,
      hasFooter: true
    };
  }

  // No footer: seek last fenced block  
  const codeRe = /^```(?:[a-z]*)?$[\r\n]([\s\S]*?)^```\s*$/img;
  let lastMatch = null, m;
  while ((m = codeRe.exec(text)) !== null) {
    // Only accept JS/javascript fences or fences with no language tag
    const beforeCode = text.slice(Math.max(0, m.index - 100), m.index);
    const fenceLine = beforeCode.split(/[\r\n]/).pop() || '';
    const lang = fenceLine.replace(/^```/, '').trim().toLowerCase();
    if (!lang || lang === 'js' || lang === 'javascript') {
      lastMatch = { code: m[1], index: m.index };
    }
  }
  if (!lastMatch) return null;

  // Check for page reply header above (both old and new formats)
  const before = text.slice(0, lastMatch.index).split('\n');
  let idx = before.length - 1;
  while (idx >= 0 && !before[idx].trim()) idx--;
  if (idx >= 0) {
    const escName = pageName.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&');
    // Check for old format: > **page** to agent
    if (new RegExp('^>\\s*\\*\\*' + escName + '\\*\\*\\s+to\\s+\\S+\\s+at\\s+\\d{2}:\\d{2}:\\d{2}').test(before[idx].trim())) {
      return null;
    }
    // Check for new format: #### 👍page or #### 🚫page
    if (new RegExp('^#{4}\\s*[👍🚫]' + escName + '\\s+to\\s+\\S+\\s+at\\s+\\d{2}:\\d{2}:\\d{2}').test(before[idx].trim())) {
      return null;
    }
  }

  const code = lastMatch.code.endsWith('\n') ? lastMatch.code.slice(0, -1) : lastMatch.code;
  
  // Reject if code is empty or whitespace-only
  if (!code.trim()) return null;

  // Reject if code starts with a response header (old or new format)
  if (/^(>|\#{3,4})\s*(\*\*\S+\*\*|[👍🚫]\S+)\s+to\s+\S+/.test(code.trim())) return null;

  return { agent: 'agent', target: pageName, time: '', code: code, hasFooter: false };
}
