// @ts-check
import { watch, readFileSync, existsSync } from 'node:fs';
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
      if (!existsSync(page.file)) {
        // File not present yet; do nothing. The directory watch will detect creation.
        return;
      }
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
  job.create(page, req.agent, req.code, req.hasFooter);
      registry.updateMaster(root);
      
    } catch (err) {
      console.warn(`[${page.name}] parse error:`, err);
    }
  };
    // If file exists watch it directly; otherwise watch the debug directory for creation.
    if (existsSync(page.file)) {
      watch(page.file, () => {
        const t = timers.get(page.name);
        if (t) clearTimeout(t);
        timers.set(page.name, setTimeout(check, DEBOUNCE_MS));
      });
    } else {
      // Watch the debug directory for creation of the expected filename
      const debugDir = page.file.replace(/\\[^\\]+$/, '');
      try {
        watch(debugDir || '.', (eventType, filename) => {
          if (!filename) return;
          const candidate = debugDir ? filename : filename;
          if (candidate === debugDir.replace(/^.*\\/, '') ) return; // no-op
          // If the created filename matches page.file's basename, trigger check
          const base = page.file.split(/\\|\//).pop();
          if (filename === base) {
            const t = timers.get(page.name);
            if (t) clearTimeout(t);
            timers.set(page.name, setTimeout(check, DEBOUNCE_MS));
          }
        });
      } catch (e) {
        // directory may not exist yet; ignore
      }
    }
  // Initial check
  check();
}
