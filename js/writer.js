// @ts-check
import { readFileSync, writeFileSync } from 'node:fs';
import { clockFmt, durationFmt } from './utils.js';
import { removeFooterAndBelow } from './parser.js';

const FOOTER = '> Write code in a fenced JS block below to execute against this page.\n';

/**
 * @param {import('./job.js').Job} job
 * @param {{ ok: boolean, value?: any, error?: any, errors?: string[] }} result
 */
export function writeReply(job, result) {
  const file = job.page.file;
  let text = readFileSync(file, 'utf8');
  // Deterministically find the executing announcement header ("**page** to agent at ...")
  // and the executing placeholder line after it. Replace that whole section up to
  // the footer with the final reply. This is more robust than a single-line regex
  // and avoids reinserting the agent request block.
  const lines = text.split('\n');
  let footerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('> Write code in a fenced JS block')) {
      footerIdx = i;
      break;
    }
  }

  let replaced = false;
  if (footerIdx >= 0) {
    // Search upwards for the executing header line just above the placeholder
    for (let i = footerIdx - 1; i >= 0; i--) {
      const expectedHeader = `> **${job.page.name}** to ${job.agent} at `;
      if (lines[i].startsWith(expectedHeader)) {
        // Check the next non-empty line is the executing placeholder
        const nextLine = lines[i + 1] || '';
        if (/^executing \([^)]+\)/.test(nextLine.trim())) {
          // Build reply text
          const now = Date.now();
          const duration = job.startedAt ? now - job.startedAt : 0;
          const durStr = duration > 0 ? ` (${durationFmt(duration)})` : '';
          const errStr = result.ok ? '' : '**ERROR** after ';
          const replyHeader = `> **${job.page.name}** to ${job.agent} at ${clockFmt(now)}${errStr ? ' (' + errStr + durStr + ')' : durStr}`;

          const blocks = [];
          if (result.ok) {
            const val = result.value;
            const isObj = val && typeof val === 'object';
            blocks.push('```JSON\n' + (isObj ? JSON.stringify(val, null, 2) : String(val)) + '\n```');
          } else {
            blocks.push('```Error\n' + String(result.error) + '\n```');
          }

          if (result.errors && result.errors.length > 0) {
            const errs = result.errors.length > 10
              ? [...result.errors.slice(0, 2), `... (${result.errors.length - 10} more background events omitted) ...`, ...result.errors.slice(-8)]
              : result.errors;
            for (const err of errs) {
              if (err.includes('...')) {
                blocks.push('\n' + err + '\n');
              } else {
                blocks.push('```Error\n' + err + '\n```');
              }
            }
          }

          // Replace from the executing header line (i) through the line before footerIdx
          const head = lines.slice(0, i).join('\n');
          const body = '\n\n' + replyHeader + '\n' + blocks.join('\n\n') + '\n\n' + FOOTER;
          text = head + body;
          replaced = true;
          console.log(`[writeReply] replaced executing block for ${job.page.name} (lines ${i}-${footerIdx - 1})`);
          break;
        }
      }
    }
  }

  if (!replaced) {
    // No executing placeholder found, write the full response (old behavior)
    // Remove footer and everything below it (including the agent's appended code)
    text = removeFooterAndBelow(text);
    
    // Inject the agent request header if not already present
    const agentHeader = `> **${job.agent}** to ${job.page.name} at ${job.requestedAt ? clockFmt(job.requestedAt) : clockFmt(Date.now())}`;
    const codeBlock = '```JS\n' + job.code + '\n```';
    
    text += '\n' + agentHeader + '\n' + codeBlock + '\n';
    
    const now = Date.now();
    const duration = job.startedAt ? now - job.startedAt : 0;
    const durStr = duration > 0 ? ` (${durationFmt(duration)})` : '';
    const errStr = result.ok ? '' : '**ERROR** after ';
    
    const replyHeader = `> **${job.page.name}** to ${job.agent} at ${clockFmt(now)}${errStr ? ' (' + errStr + durStr + ')' : durStr}`;
    
    const blocks = [];
    
    if (result.ok) {
      const val = result.value;
      const isObj = val && typeof val === 'object';
      blocks.push('```JSON\n' + (isObj ? JSON.stringify(val, null, 2) : String(val)) + '\n```');
    } else {
      blocks.push('```Error\n' + String(result.error) + '\n```');
    }
    
    // Add error blocks
    if (result.errors && result.errors.length > 0) {
      const errs = result.errors.length > 10
        ? [...result.errors.slice(0, 2), `... (${result.errors.length - 10} more background events omitted) ...`, ...result.errors.slice(-8)]
        : result.errors;
      
      for (const err of errs) {
        if (err.includes('...')) {
          blocks.push('\n' + err + '\n');
        } else {
          blocks.push('```Error\n' + err + '\n```');
        }
      }
    }
    
    text += '\n' + replyHeader + '\n' + blocks.join('\n\n') + '\n\n' + FOOTER;
  }
  
  writeFileSync(file, text, 'utf8');
}

/**
 * Write an executing announcement and placeholder into the per-instance file.
 * This removes the footer and injects the agent header, code block, an executing
 * announcement header, and a short placeholder line. The footer IS re-appended
 * at the end to allow future requests to be parsed.
 * @param {import('./job.js').Job} job
 */
export function writeExecuting(job) {
  const file = job.page.file;
  let text = readFileSync(file, 'utf8');
  console.log(`[writeExecuting] read file, length=${text.length}`);

  // Remove footer and anything below it
  const lines = text.split('\n');
  let footerIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('> Write code in a fenced JS block')) {
      footerIdx = i;
      break;
    }
  }

  if (footerIdx >= 0) {
    text = lines.slice(0, footerIdx).join('\n') + '\n';
    console.log(`[writeExecuting] removed footer at line ${footerIdx}`);
  }

  // Ensure agent header + code block exist (inject if necessary)
  const agentHeader = `> **${job.agent}** to ${job.page.name} at ${clockFmt(job.requestedAt || Date.now())}`;
  const codeBlock = '```JS\n' + job.code + '\n```';

  // executing announcement + placeholder
  const executingHeader = `> **${job.page.name}** to ${job.agent} at ${clockFmt(Date.now())}`;
  const placeholder = 'executing (0s)';

  text += '\n' + agentHeader + '\n' + codeBlock + '\n\n' + executingHeader + '\n' + placeholder + '\n\n' + FOOTER;
  console.log(`[writeExecuting] writing to file, length=${text.length}`);

  writeFileSync(file, text, 'utf8');
  console.log(`[writeExecuting] written successfully`);
}
