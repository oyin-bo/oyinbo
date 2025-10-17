// @ts-check
import { watch, readFileSync } from 'node:fs';
import { parseRequest } from './parser.js';
import * as job from './job.js';
import * as registry from './registry.js';

const DEBOUNCE_MS = 150;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const timers = new Map();

/** @param {string} root @param {import('./registry.js').Page} page */
export function watchPage(root, page) {
  let lastContent = '';
  
  const check = () => {
    try {
      const text = readFileSync(page.file, 'utf8');
      if (text === lastContent) return;
      lastContent = text;
      
      // Skip if job already running
      if (job.get(page.name)) {
        console.log(`[${page.name}] skipping: job already running`);
        return;
      }
      
      const req = parseRequest(text, page.name);
      if (!req) {
        console.log(`[${page.name}] no new request found (parseRequest returned null)`);
        return;
      }
      
      console.log(`[${page.name}] new request from ${req.agent}`);
      job.create(page, req.agent, req.code);
      registry.updateMaster(root);
      
    } catch (err) {
      console.warn(`[${page.name}] parse error:`, err);
    }
  };
  
  watch(page.file, () => {
    const t = timers.get(page.name);
    if (t) clearTimeout(t);
    timers.set(page.name, setTimeout(check, DEBOUNCE_MS));
  });
  
  // Initial check
  check();
}
