// @ts-check
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
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
  for (let i = lines.length - 1; i >= 0; i--) {
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

/** @param {string[]} lines */
function findLastFencedBlock(lines) {
  // Find last closing fence ``` then find matching opening fence above it
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (/^```/.test(lines[i].trim())) { end = i; break; }
  }
  if (end < 0) return null;
  // find opening fence
  for (let i = end - 1; i >= 0; i--) {
    if (/^```(?:JS|js|javascript)?/.test(lines[i].trim())) return { start: i, end };
  }
  return null;
}

/** @param {string[]} lines @param {number} startIdx */
function findAgentHeaderAbove(lines, startIdx) {
  let idx = startIdx - 1;
  while (idx >= 0 && !lines[idx].trim()) idx--;
  if (idx < 0) return -1;
  if (/^>\s*\*\*/.test(lines[idx].trim())) return idx;
  return -1;
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
  if (!existsSync(job.page.file)) {
    console.warn(`[writer] writeReply: target file missing ${job.page.file}; skipping write`);
    return;
  }
  const lines = readFileSync(job.page.file, 'utf8').split('\n');
  const execBlock = findExecutingBlock(lines, job.page.name, job.agent);
  let footerIdx = findFooter(lines);
  if (footerIdx < 0) footerIdx = lines.length;
  
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
    // No executing block.
    if (job.requestHasFooter === false) {
      const lastFence = findLastFencedBlock(lines);
      if (lastFence) {
        const agentIdx = findAgentHeaderAbove(lines, lastFence.start);
        let prefixLines;
        if (agentIdx >= 0) {
          // Keep existing agent header and the fenced block as-is
          prefixLines = lines.slice(0, lastFence.end + 1);
        } else {
          // Insert agent header before the fenced block
          prefixLines = [
            ...lines.slice(0, lastFence.start),
            agentHeader(job.agent, job.page.name, job.requestedAt || now),
            lines.slice(lastFence.start, lastFence.end + 1).join('\n')
          ];
        }

        output = [
          ...prefixLines,
          '',
          reply,
          ...blocks,
          '',
          FOOTER
        ].join('\n');
      } else {
        // fallback: append normally
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
    } else {
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
  }
  
  writeFileSync(job.page.file, output, 'utf8');
}

/**
 * Write an executing announcement and placeholder into the per-instance file.
 * @param {import('./job.js').Job} job
 */
export function writeExecuting(job) {
  if (!existsSync(job.page.file)) {
    console.warn(`[writer] writeExecuting: target file missing ${job.page.file}; skipping write`);
    return;
  }
  const lines = readFileSync(job.page.file, 'utf8').split('\n');
  let footerIdx = findFooter(lines);
  if (footerIdx < 0) footerIdx = lines.length;
  
  const now = Date.now();
  const agent = agentHeader(job.agent, job.page.name, job.requestedAt || now);
  const code = '```JS\n' + job.code + '\n```';
  const executing = `> **${job.page.name}** to ${job.agent} at ${clockFmt(now)}`;
  let output;
  if (job.requestHasFooter === false) {
    const lastFence = findLastFencedBlock(lines);
    if (lastFence) {
      const agentIdx = findAgentHeaderAbove(lines, lastFence.start);
      let prefixLines;
      if (agentIdx >= 0) {
        prefixLines = lines.slice(0, lastFence.end + 1);
      } else {
        prefixLines = [
          ...lines.slice(0, lastFence.start),
          agent,
          lines.slice(lastFence.start, lastFence.end + 1).join('\n')
        ];
      }

      output = [
        ...prefixLines,
        '',
        executing,
        'executing (0s)',
        '',
        FOOTER
      ].join('\n');
    } else {
      // fallback
      output = [
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
    }
  } else {
    output = [
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
  }

  writeFileSync(job.page.file, output, 'utf8');
}
