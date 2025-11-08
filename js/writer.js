// @ts-check
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { hasFileBeenSeen } from './watcher.js';
import { dirname } from 'node:path';
import {
  clockFmt,
  durationFmt,
  findFooter,
  findLastFencedBlock,
  findAgentHeaderAbove,
  findExecutingBlock,
  formatAgentHeader,
  formatReplyHeader,
  formatCodeBlock,
  formatResultBlocks,
  formatFooter,
  formatBackgroundEvent,
  ensureFileHeader
} from './repl.template.js';

/**
 * Write a system diagnostic message to a page's chat log
 * @param {string} file - Path to the page's chat file
 * @param {string} message - Diagnostic message
 */
export function writeDiagnostic(file, message) {
  if (!existsSync(file)) {
    // File doesn't exist yet, create it with diagnostic
    let lines = [];
    lines = ensureFileHeader(lines, 'System Diagnostic');
  const nowIso = new Date().toISOString();
  const timestamp = clockFmt(nowIso);
    
    const content = [
      ...lines,
      '',
      `### 🗣️System at ${timestamp}`,
      '```Text',
      message,
      '```',
      '',
      formatFooter()
    ].join('\n');
    
    writeFileSync(file, content, 'utf8');
    return;
  }
  
  let lines = readFileSync(file, 'utf8').split('\n');
  lines = ensureFileHeader(lines, 'System Diagnostic');
  
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  const nowIso = new Date().toISOString();
  const timestamp = clockFmt(nowIso);
  
  const output = [
    ...lines.slice(0, footerIdx),
    '',
    `### 🗣️System at ${timestamp}`,
    '```Text',
    message,
    '```',
    '',
    formatFooter()
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
    /** @type {string[]} */
    let lines = [];
    lines = ensureFileHeader(lines, 'Test Progress');
    
    const content = [
      ...lines,
      markdown,
      '',
      formatFooter()
    ].join('\n');
    
    writeFileSync(file, content, 'utf8');
    return;
  }
  
  let lines = readFileSync(file, 'utf8').split('\n');
  lines = ensureFileHeader(lines, 'Test Progress');
  
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  
  const output = [
    ...lines.slice(0, footerIdx),
    markdown,
    '',
    formatFooter()
  ].join('\n');
  
  writeFileSync(file, output, 'utf8');
}

/**
 * Write background events (orphaned events after job completion) to a page's chat log
 * @param {string} file - Path to the page's chat file
 * @param {Array<{type: string, level?: string, source?: string, eventAt: string, message: string, stack?: string, caller?: string}>} events - Background events
 * @param {string} timestamp - Timestamp of flush
 */
export function writeBackgroundEvents(file, events, timestamp) {
  if (!existsSync(file)) return; // No file yet, can't write background events
  
  let lines = readFileSync(file, 'utf8').split('\n');
  lines = ensureFileHeader(lines, 'Background Events');
  
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  
  const pageName = file.match(/([^/\\]+)\.md$/)?.[1] || 'page';
  const blocks = events.map(formatBackgroundEvent);
  
  const output = [
    ...lines.slice(0, footerIdx),
    '',
    `### 🗣️${pageName} background at ${timestamp}`,
    ...blocks,
    '',
    formatFooter()
  ].join('\n');
  
  writeFileSync(file, output, 'utf8');
}

// Export helper functions for testing (now from repl.template.js)
export { clockFmt, durationFmt, findFooter, findLastFencedBlock, findAgentHeaderAbove, formatBackgroundEvent, buildBlocks };

/**
 * @param {{ ok: boolean, value?: any, error?: any, errors?: string[], backgroundEvents?: any[] }} result
 * @returns {string[]} Array of formatted blocks
 */
const buildBlocks = result => {
  return formatResultBlocks(result);
};

/**
 * @param {import('./job.js').Job} job
 * @param {{ ok: boolean, value?: any, error?: any, errors?: string[], backgroundEvents?: any[] }} result
 */
export function writeReply(job, result) {
  const nowIso = new Date().toISOString();
  const duration = job.startedAt ? (Date.parse(nowIso) - Date.parse(job.startedAt)) : 0;

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
  
  let lines = readFileSync(job.page.file, 'utf8').split('\n');
  lines = ensureFileHeader(lines, job.page.name + ' Session');
  
  const execBlock = findExecutingBlock(lines, job.page.name, job.agent);
  let footerIdx = findFooter(lines);
  if (footerIdx < 0) footerIdx = lines.length;
  
  const reply = formatReplyHeader(job.page.name, job.agent, nowIso, duration, !result.ok);
  const blocks = buildBlocks(result);
  
  const agent = formatAgentHeader(job.agent, job.page.name, job.requestedAt || nowIso);
  const code = formatCodeBlock(job.code);
  
  let output;
  if (execBlock) {
    // Remove the executing block (header + placeholder lines)
    const beforeExec = lines.slice(0, execBlock.headerIdx);
    const afterPlaceholder = lines.slice(execBlock.placeholderIdx + 1);
    const combinedLines = [...beforeExec, ...afterPlaceholder];
    const newFooterIdx = findFooter(combinedLines);
    const finalFooterIdx = newFooterIdx >= 0 ? newFooterIdx : combinedLines.length;
    
    output = [
      ...combinedLines.slice(0, finalFooterIdx),
      '',
      reply,
      ...blocks,
      '',
      formatFooter()].join('\n');
  } else if (job.requestHasFooter === false) {
    const lastFence = findLastFencedBlock(lines);
    if (lastFence) {
      const agentIdx = findAgentHeaderAbove(lines, lastFence.start);
      const prefixLines = agentIdx >= 0 
        ? lines.slice(0, lastFence.end + 1)
        : [...lines.slice(0, lastFence.start), agent, lines.slice(lastFence.start, lastFence.end + 1).join('\n')];
      output = [...prefixLines, '', reply, ...blocks, '', formatFooter()].join('\n');
    } else {
      output = [...lines.slice(0, footerIdx), '', agent, code, '', reply, ...blocks, '', formatFooter()].join('\n');
    }
  } else {
    output = [...lines.slice(0, footerIdx), '', agent, code, '', reply, ...blocks, '', formatFooter()].join('\n');
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
  
  let lines = readFileSync(job.page.file, 'utf8').split('\n');
  lines = ensureFileHeader(lines, job.page.name + ' Session');
  
  const footerIdx = findFooter(lines) >= 0 ? findFooter(lines) : lines.length;
  const nowIso = new Date().toISOString();
  const agent = formatAgentHeader(job.agent, job.page.name, job.requestedAt || nowIso);
  const code = formatCodeBlock(job.code);
  const executing = `#### 👍${job.page.name} to ${job.agent} at ${clockFmt(nowIso)}`;
  
  let output;
  if (job.requestHasFooter === false) {
    const lastFence = findLastFencedBlock(lines);
    if (lastFence) {
      const agentIdx = findAgentHeaderAbove(lines, lastFence.start);
      const prefixLines = agentIdx >= 0 
        ? lines.slice(0, lastFence.end + 1)
        : [...lines.slice(0, lastFence.start), agent, lines.slice(lastFence.start, lastFence.end + 1).join('\n')];
      output = [...prefixLines, '', executing, 'executing (0s)', '', formatFooter()].join('\n');
    } else {
      output = [...lines.slice(0, footerIdx), '', agent, code, '', executing, 'executing (0s)', '', formatFooter()].join('\n');
    }
  } else {
    output = [...lines.slice(0, footerIdx), '', agent, code, '', executing, 'executing (0s)', '', formatFooter()].join('\n');
  }

  writeFileSync(job.page.file, output, 'utf8');
}
