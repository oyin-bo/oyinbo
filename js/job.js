// @ts-check
import { clockFmt, durationFmt } from './utils.js';
import * as writer from './writer.js';
import fs from 'node:fs';

/**
 * @typedef {{
 *   id: string,
 *   page: import('./registry.js').Page,
 *   agent: string,
 *   code: string,
 *   requestedAt: number,
 *   startedAt: number | null,
 *   finishedAt: number | null,
 *   timeout: ReturnType<typeof setTimeout> | null,
 *   _placeholderInterval?: ReturnType<typeof setInterval>
 * }} Job
 */

/** @type {Map<string, Job>} */
const jobs = new Map();

let nextId = 1;
const TIMEOUT_MS = 60_000;

/** @param {import('./registry.js').Page} page @param {string} agent @param {string} code */
export function create(page, agent, code) {
  const id = String(nextId++);
  const job = {
    id,
    page,
    agent,
    code,
    requestedAt: Date.now(),
    startedAt: null,
    finishedAt: null,
    timeout: null
  };
  
  jobs.set(page.name, job);
  page.state = 'executing';
  
  // @ts-ignore - timeout type mismatch between Node types
  job.timeout = setTimeout(() => onTimeout(job), TIMEOUT_MS);
  
  return job;
}

/** @param {string} pageName */
export function get(pageName) {
  return jobs.get(pageName);
}

/** @param {Job} job */
async function onTimeout(job) {
  if (job.finishedAt) return;
  
  writer.writeReply(job, {
    ok: false,
    error: `job timed out after ${TIMEOUT_MS}ms`,
    errors: []
  });
  
  finish(job);
}

/** @param {Job} job */
export function start(job) {
  // If start() is called multiple times (multiple polls), make this idempotent
  if (job.startedAt) {
    console.log(`[job] start called but already started for ${job.page.name}, skipping`);
    return;
  }

  job.startedAt = Date.now();
  // notify file that execution has started
  try {
    console.log(`[job] starting job for ${job.page.name}, writing executing placeholder`);
    writer.writeExecuting(job);
    console.log(`[job] executing placeholder written successfully`);
  } catch (err) {
    console.warn('[job] writeExecuting failed', err);
  }

  // update placeholder every 5s
  console.log(`[job] setting up placeholder interval for ${job.page.name}, will fire every 5000ms`);
  job._placeholderInterval = setInterval(() => {
    const now = Date.now();
    const elapsed = Math.max(0, Math.floor((now - (job.startedAt || now)) / 1000));
    const secs = `${elapsed}s`;
    try {
      const file = job.page.file;
      let text = fs.readFileSync(file, 'utf8');
      if (/executing \([^)]+\)/.test(text)) {
        console.log(`[job-interval] updating placeholder for ${job.page.name}: executing (${secs})`);
        text = text.replace(/executing \([^)]+\)/, `executing (${secs})`);
        fs.writeFileSync(file, text, 'utf8');
      } else {
        console.log(`[job-interval] no executing placeholder found in ${job.page.name}`);
      }
    } catch (err) {
      console.warn(`[job-interval] error updating placeholder: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, 5000);
}

/** @param {Job} job */
export function finish(job) {
  if (job.timeout) clearTimeout(job.timeout);
  job.finishedAt = job.finishedAt || Date.now();
  if (job._placeholderInterval) {
    clearInterval(job._placeholderInterval);
    delete job._placeholderInterval;
  }
  job.page.state = 'idle';
  jobs.delete(job.page.name);
}
