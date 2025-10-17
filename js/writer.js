// @ts-check
import { readFileSync, writeFileSync } from 'node:fs';
import { clockFmt, durationFmt } from './utils.js';

// Local helpers - everything inline, no external constants
// Make the footer very visible: wide divider, canonical footer line retained
const FOOTER = (
  '----------------------------------------------------------------------\n' +
  '> Write code in a fenced JS block below to execute against this page.\n' +
  '\n'
);

/** @param {string} agent @param {string} target @param {number} ts */
function agentHeader(agent, target, ts) {
  return `> **${agent}** to ${target} at ${clockFmt(ts)}`;
}

/** @param {string} page @param {string} agent @param {number} ts @param {number} dur @param {boolean} err */
function replyHeader(page, agent, ts, dur, err) {
  return `> **${page}** to ${agent} at ${clockFmt(ts)}${err ? ' (**ERROR**)' : ''} (${durationFmt(dur)})`;
}

/** @param {string[]} lines */
function findFooter(lines) {
  for (let i - lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('> Write code in a fenced JS block')) return i;
  }
  return -1;
}

/** @param {string[]} lines @param {string} page @param {string} agent */
function findExecutingBlock(lines, page, agent) {
  const footerIdx = findFooter(lines);
  if (footerIdx < 0) return null;
  
  for (let i = footerIdx - 1; i >= 0; i--) {
    if (lines[i].startsWith(`> **${page}** to ${agent} at `)) {
      const next = lines[i + 1] || '';
      if (/^executing \(/.test(next.trim())) {
        return { headerIdx: i, placeholderIdx: i + 1 };
      }
    }
  }
  return null;
}

/** @param {{ ok: boolean, value?: any, error?: any, errors?: string[] }} result */
function buildBlocks(result) {
  const blocks = [];
  
  if (result.ok) {
    const val = result.value;
    const isObj = val && typeof val === 'object';
    blocks.push('```JSON\n' + (isObj ? JSON.stringify(val, null, 2) : String(val)) + '\n```');
  } else {
    blocks.push('```Error\n' + String(result.error) + '\n```');
  }
  
  if (result.errors?.length) {
    const errs = result.errors.length > 10
      ? [...result.errors.slice(0, 2), `... (${result.errors.length - 10} more background events omitted) ...`, ...result.errors.slice(-8)]
      : result.errors;
    
    for (const err of errs) {
      blocks.push(err.includes('...') ? '\n' + err + '\n' : '```Error\n' + err + '\n```');
    }
  }
  
  return blocks;
}

/**
 * @param {import('./job.js').Job} job
 * @param {{ ok: boolean, value?: any, error?: any, errors?: string[] }} result
 */
export function writeReply(job, result) {
  const lines = readFileSync(job.page.file, 'utf8').split('\n');
  const execBlock = findExecutingBlock(lines, job.page.name, job.agent);
  const footerIdx = findFooter(lines);
  
  const now = Date.now();
  const duration = job.startedAt ? now - job.startedAt : 0;
  const reply = replyHeader(job.page.name, job.agent, now, duration, !result.ok);
  const blocks = buildBlocks(result);
  
  let output;
  if (execBlock) {
    // Replace executing block with reply
    output = [
      ...lines.slice(0, execBlock.headerIdx),
      '',
      reply,
      ...blocks,
      '',
      FOOTER
    ].join('\n');
  } else {
    // No executing block, append full request + reply
    const agent = agentHeader(job.agent, job.page.name, job.requestedAt || now);
    const code = '```JS\n' + job.code + '\n```';
    
    output = [
      ...lines.slice(0, footerIdx),
      '',
      agent,
      code,
      '',
      reply,
      ...blocks,
      '',
      FOOTER
    ].join('\n');
  }
  
  writeFileSync(job.page.file, output, 'utf8');
}

/**
 * Write an executing announcement and placeholder into the per-instance file.
 * @param {import('./job.js').Job} job
 */
export function writeExecuting(job) {
  const lines = readFileSync(job.page.file, 'utf8').split('\n');
  const footerIdx = findFooter(lines);
  
  const now = Date.now();
  const agent = agentHeader(job.agent, job.page.name, job.requestedAt || now);
  const code = '```JS\n' + job.code + '\n```';
  const executing = `> **${job.page.name}** to ${job.agent} at ${clockFmt(now)}`;
  
  const output = [
    ...lines.slice(0, footerIdx),
    '',
    agent,
    code,
    '',
    executing,
    'executing (0s)',
    '',
    FOOTER
  ].join('\n');
  
  writeFileSync(job.page.file, output, 'utf8');
}
