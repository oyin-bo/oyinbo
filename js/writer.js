// @ts-check
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { hasFileBeenSeen } from './watcher.js';
import { dirname } from 'node:path';

const FOOTER = '----------------------------------------------------------------------\n> Write code in a fenced JS block below to execute against this page.\n\n';

/** @param {number} ms */
const clockFmt = ms => {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
};

/** @param {number} ms */
const durationFmt = ms => ms >= 2000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;

/** @param {string[]} lines */
const findFooter = lines => {
  for (let i = lines.length - 1; i >= 0; i--) 
    if (lines[i].startsWith('> Write code in a fenced JS block')) return i;
  return -1;
};

/**
 * Write a system diagnostic message to a page's chat log
 * @param {string} file - Path to the page's chat file
 * @param {string} message - Diagnostic message
 */
export function writeDiagnostic(file, message) {
  if (!existsSync(file)) {
    // File doesn't exist yet, create it with diagnostic
    const content = `# Worker Diagnostics\n\n> ${message}\n\n${FOOTER}`;
    writeFileSync(file, content, 'utf8');
    return;
  }
  
  const lines = readFileSync(file, 'utf8').split('\n');
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  const now = Date.now();
  const timestamp = clockFmt(now);
  
  const output = [
    ...lines.slice(0, footerIdx),
    '',
    `> **System** at ${timestamp}`,
    '```Text',
    message,
    '```',
    '',
    FOOTER
  ].join('\n');
  
  writeFileSync(file, output, 'utf8');
}

/**
 * Write test progress markdown to a page's chat log
 * @param {string} file - Path to the page's chat file
 * @param {string} markdown - Test progress markdown
 */
export function writeTestProgress(file, markdown) {
  if (!existsSync(file)) {
    // Create parent directory if it doesn't exist
    const dir = dirname(file);
    if (dir && !existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const content = `${markdown}\n\n${FOOTER}`;
    writeFileSync(file, content, 'utf8');
    return;
  }
  
  const lines = readFileSync(file, 'utf8').split('\n');
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  
  const output = [
    ...lines.slice(0, footerIdx),
    '',
    markdown,
    '',
    FOOTER
  ].join('\n');
  
  writeFileSync(file, output, 'utf8');
}

// Export helper functions for testing
export { clockFmt, durationFmt, findFooter, findLastFencedBlock, findAgentHeaderAbove, buildBlocks, formatBackgroundEvent };

/** @param {string} agent @param {string} target @param {number} ts */
const agentHeader = (agent, target, ts) => `> **${agent}** to ${target} at ${clockFmt(ts)}`;
/** @param {string} page @param {string} agent @param {number} ts @param {number} dur @param {boolean} err */
const replyHeader = (page, agent, ts, dur, err) => `> **${page}** to ${agent} at ${clockFmt(ts)}${err ? ' (**ERROR**)' : ''} (${durationFmt(dur)})`;

/** @param {string[]} lines @param {string} page @param {string} agent */
const findExecutingBlock = (lines, page, agent) => {
  const footerIdx = findFooter(lines);
  if (footerIdx < 0) return null;
  for (let i = footerIdx - 1; i >= 0; i--) {
    if (lines[i].startsWith(`> **${page}** to ${agent} at `) && /^executing \(/.test((lines[i + 1] || '').trim())) 
      return { headerIdx: i, placeholderIdx: i + 1 };
  }
  return null;
};

/** @param {string[]} lines */
const findLastFencedBlock = lines => {
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) 
    if (/^```/.test(lines[i].trim())) { end = i; break; }
  if (end < 0) return null;
  for (let i = end - 1; i >= 0; i--) 
    if (/^```(?:\s*(?:js|javascript))?/.test(lines[i].trim())) return { start: i, end };
  return null;
};

/** @param {string[]} lines @param {number} startIdx */
const findAgentHeaderAbove = (lines, startIdx) => {
  let idx = startIdx - 1;
  while (idx >= 0 && !lines[idx].trim()) idx--;
  return idx >= 0 && /^>\s*\*\*/.test(lines[idx].trim()) ? idx : -1;
};

/**
 * Format background event as a fenced block with specialized metadata
 * @param {{ type: string, level?: string, source?: string, ts: string, message: string, stack?: string }} event
 */
const formatBackgroundEvent = event => {
  if (event.type === 'error') {
    const fenceType = event.source || 'Error';
    const content = event.stack || event.message;
    return '```' + fenceType + '\n' + content + '\n```';
  } else if (event.type === 'console') {
    const level = event.level || 'log';
    // Try to determine if message is JSON-serializable
    let fenceType = 'Text';
    try {
      JSON.parse(event.message);
      fenceType = 'JSON';
    } catch (e) {
      // Not JSON, use Text
    }
    if (level === 'error') fenceType = 'Error';
    const metadata = 'console.' + level;
    return '```' + fenceType + ' ' + metadata + '\n' + event.message + '\n```';
  }
  return '```Text\n' + event.message + '\n```';
};

/** @param {{ ok: boolean, value?: any, error?: any, errors?: string[], backgroundEvents?: any[] }} result */
const buildBlocks = result => {
  const blocks = [];
  if (result.ok) {
    const val = result.value;
    blocks.push('```JSON\n' + (val && typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val)) + '\n```');
  } else {
    blocks.push('```Error\n' + String(result.error) + '\n```');
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
        blocks.push('\n' + event.message + '\n');
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
    for (const err of errs) 
      blocks.push(err.includes('...') ? '\n' + err + '\n' : '```Error\n' + err + '\n```');
  }
  return blocks;
};

/**
 * @param {import('./job.js').Job} job
 * @param {{ ok: boolean, value?: any, error?: any, errors?: string[], backgroundEvents?: any[] }} result
 */
export function writeReply(job, result) {
  const now = Date.now();
  const duration = job.startedAt ? now - job.startedAt : 0;

  const v = result.value;
  let resultText = result.ok 
    ? (v && typeof v === 'object' ? JSON.stringify(v) : String(v))
    : (result.error ?? '');
  resultText = (resultText || '').replace(/\s+/g, ' ').trim();
  if (resultText.length > 100) resultText = resultText.slice(0, 100) + '...';
  console.info(`> ${job.page.name} to ${job.agent} ${result.ok ? 'succeeded' : 'failed'} in ${durationFmt(duration)} "${resultText}"`);

  if (!existsSync(job.page.file)) {
    if (hasFileBeenSeen(job.page.file)) 
      console.warn(`[writer] writeReply: target file missing ${job.page.file}; skipping write`);
    return;
  }
  const lines = readFileSync(job.page.file, 'utf8').split('\n');
  const execBlock = findExecutingBlock(lines, job.page.name, job.agent);
  let footerIdx = findFooter(lines);
  if (footerIdx < 0) footerIdx = lines.length;
  
  const reply = replyHeader(job.page.name, job.agent, now, duration, !result.ok);
  const blocks = buildBlocks(result);
  
  const agent = agentHeader(job.agent, job.page.name, job.requestedAt || now);
  const code = '```JS\n' + job.code + '\n```';
  
  let output;
  if (execBlock) {
    output = [...lines.slice(0, execBlock.headerIdx), '', reply, ...blocks, '', FOOTER].join('\n');
  } else if (job.requestHasFooter === false) {
    const lastFence = findLastFencedBlock(lines);
    if (lastFence) {
      const agentIdx = findAgentHeaderAbove(lines, lastFence.start);
      const prefixLines = agentIdx >= 0 
        ? lines.slice(0, lastFence.end + 1)
        : [...lines.slice(0, lastFence.start), agent, lines.slice(lastFence.start, lastFence.end + 1).join('\n')];
      output = [...prefixLines, '', reply, ...blocks, '', FOOTER].join('\n');
    } else {
      output = [...lines.slice(0, footerIdx), '', agent, code, '', reply, ...blocks, '', FOOTER].join('\n');
    }
  } else {
    output = [...lines.slice(0, footerIdx), '', agent, code, '', reply, ...blocks, '', FOOTER].join('\n');
  }
  
  writeFileSync(job.page.file, output, 'utf8');
}

/**
 * Write an executing announcement and placeholder into the per-instance file.
 * @param {import('./job.js').Job} job
 */
export function writeExecuting(job) {
  if (!existsSync(job.page.file)) {
    if (hasFileBeenSeen(job.page.file)) 
      console.warn(`[writer] writeExecuting: target file missing ${job.page.file}; skipping write`);
    return;
  }
  const lines = readFileSync(job.page.file, 'utf8').split('\n');
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  const now = Date.now();
  const agent = agentHeader(job.agent, job.page.name, job.requestedAt || now);
  const code = '```JS\n' + job.code + '\n```';
  const executing = `> **${job.page.name}** to ${job.agent} at ${clockFmt(now)}`;
  
  let output;
  if (job.requestHasFooter === false) {
    const lastFence = findLastFencedBlock(lines);
    if (lastFence) {
      const agentIdx = findAgentHeaderAbove(lines, lastFence.start);
      const prefixLines = agentIdx >= 0 
        ? lines.slice(0, lastFence.end + 1)
        : [...lines.slice(0, lastFence.start), agent, lines.slice(lastFence.start, lastFence.end + 1).join('\n')];
      output = [...prefixLines, '', executing, 'executing (0s)', '', FOOTER].join('\n');
    } else {
      output = [...lines.slice(0, footerIdx), '', agent, code, '', executing, 'executing (0s)', '', FOOTER].join('\n');
    }
  } else {
    output = [...lines.slice(0, footerIdx), '', agent, code, '', executing, 'executing (0s)', '', FOOTER].join('\n');
  }

  writeFileSync(job.page.file, output, 'utf8');
}
