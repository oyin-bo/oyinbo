// @ts-check
import { clockFmt, durationFmt } from './utils.js';
import * as writer from './writer.js';
import fs from 'node:fs';

/**
 * @typedef {{
 *   id: string,
 *   page: import('./registry.js').Page,
 *   agent: string,
 *   requestHasFooter?: boolean,
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

/** @param {import('./registry.js').Page} page @param {string} agent @param {string} code @param {boolean} requestHasFooter */
export function create(page, agent, code, requestHasFooter = true) {
  const id = String(nextId++);
  const job = {
    id,
    page,
    agent,
    code,
    requestHasFooter,
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
  try {
    writer.writeReply(job, {
      ok: false,
      error: `job timed out after ${TIMEOUT_MS}ms`,
      errors: []
    });
  } catch (err) {
    console.warn('[job] onTimeout: writeReply failed', err);
  } finally {
    finish(job);
  }
}

/** @param {Job} job */
export function start(job) {
  if (job.startedAt) return; // idempotent
  
  job.startedAt = Date.now();
  
  try {
    writer.writeExecuting(job);
  } catch (err) {
    console.warn('[job] writeExecuting failed', err);
  }
  
  // Update placeholder every 5s
  job._placeholderInterval = setInterval(() => {
    const secs = Math.floor((Date.now() - (job.startedAt || Date.now())) / 1000);
    try {
      const text = fs.readFileSync(job.page.file, 'utf8')
        .replace(/executing \(\d+s\)/, `executing (${secs}s)`);
      fs.writeFileSync(job.page.file, text, 'utf8');
    } catch {}
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
