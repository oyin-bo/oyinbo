// @ts-check
import * as writer from './writer.js';
import fs from 'node:fs';

/**
 * @typedef {{
 *   id: string,
 *   page: import('./registry.js').Page,
 *   agent: string,
 *   requestHasFooter?: boolean,
 *   code: string,
 *   requestedAt: string,
 *   startedAt: string | null,
 *   finishedAt: string | null,
 *   timeout: ReturnType<typeof setTimeout> | null,
 *   _placeholderInterval?: ReturnType<typeof setInterval>
 * }} Job
 */

/**
 * @typedef {{
 *   promise: Promise<Job | null>,
 *   resolve: (job: Job | null) => void
 * }} JobPromise
 */

/** @type {Map<string, Job>} */
const jobs = new Map();

/** @type {Map<string, JobPromise>} */
const waitingPromises = new Map();

let nextId = 1;
const TIMEOUT_MS = 60_000;

/** @param {import('./registry.js').Page} page @param {string} agent @param {string} code @param {boolean} requestHasFooter */
export function create(page, agent, code, requestHasFooter = true) {
  const job = {
    id: String(nextId++),
    page,
    agent,
    code,
    requestHasFooter,
  requestedAt: new Date().toISOString(),
  startedAt: null,
  finishedAt: null,
    timeout: null
  };
  jobs.set(page.name, job);
  page.state = 'executing';
  // @ts-ignore
  job.timeout = setTimeout(() => onTimeout(job), TIMEOUT_MS);
  // Don't keep the event loop alive for long-running timers in tests
  try { if (job.timeout && typeof job.timeout.unref === 'function') job.timeout.unref(); } catch {}
  
  // Resolve any waiting promise for this job
  const waiting = waitingPromises.get(page.name);
  if (waiting) {
    waiting.resolve(job);
    waitingPromises.delete(page.name);
  }
  
  return job;
}

/** @param {string} pageName */
export const get = pageName => jobs.get(pageName);

/** Wait for a job to be created for a page name with timeout */
export function waitForJob(pageName, timeoutMs = 25000) {
  // Check if job already exists
  const existingJob = jobs.get(pageName);
  if (existingJob) {
    return Promise.resolve(existingJob);
  }
  
  // Check if there's already a waiting promise for this page
  const existing = waitingPromises.get(pageName);
  if (existing) {
    return existing.promise;
  }
  
  // Create a new promise and cache it
  let resolveJob;
  const promise = new Promise((resolve) => {
    resolveJob = resolve;
  });
  
  // Set up timeout to resolve with null if no job arrives
  const timeoutHandle = setTimeout(() => {
    waitingPromises.delete(pageName);
    resolveJob(null);
  }, timeoutMs);
  
  waitingPromises.set(pageName, {
    promise,
    resolve: (job) => {
      clearTimeout(timeoutHandle);
      resolveJob(job);
    }
  });
  
  return promise;
}

/** @param {Job} job */
async function onTimeout(job) {
  if (job.finishedAt) return;
  try {
    writer.writeReply(job, { ok: false, error: `job timed out after ${TIMEOUT_MS}ms`, errors: [] });
  } catch (err) {
    console.warn('[job] onTimeout: writeReply failed', err);
  } finally {
    finish(job);
  }
}

/** @param {Job} job */
export function start(job) {
  if (job.startedAt) return;
  job.startedAt = new Date().toISOString();
  try { writer.writeExecuting(job); } 
  catch (err) { console.warn('[job] writeExecuting failed', err); }
  
  job._placeholderInterval = setInterval(() => {
    const startedMs = job.startedAt ? Date.parse(job.startedAt) : Date.now();
    const secs = Math.floor((Date.now() - startedMs) / 1000);
    try {
      const text = fs.readFileSync(job.page.file, 'utf8').replace(/executing \(\d+s\)/, `executing (${secs}s)`);
      fs.writeFileSync(job.page.file, text, 'utf8');
    } catch {}
  }, 5000);
  try { if (job._placeholderInterval && typeof job._placeholderInterval.unref === 'function') job._placeholderInterval.unref(); } catch {}
}

/** @param {Job} job */
export function finish(job) {
  if (job.timeout) clearTimeout(job.timeout);
  if (job._placeholderInterval) { clearInterval(job._placeholderInterval); delete job._placeholderInterval; }
  job.finishedAt = job.finishedAt || new Date().toISOString();
  job.page.state = 'idle';
  jobs.delete(job.page.name);
}
