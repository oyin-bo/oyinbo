// @ts-check
import { watch, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { parseRequest } from './parser.js';
import * as job from './job.js';
import * as registry from './registry.js';

const DEBOUNCE_MS = 150;

/** @type {Map<string, ReturnType<typeof setTimeout>>} */
const timers = new Map();

/** @type {Set<string>} */
const activeWatchers = new Set();

const seenFiles = new Set();

/** @param {string} file */
export const hasFileBeenSeen = file => seenFiles.has(file);
/** @param {string} file */
export const markFileSeen = file => seenFiles.add(file);

/** @param {string} root @param {import('./registry.js').Page} page */
export function watchPage(root, page) {
  if (activeWatchers.has(page.name)) return;
  activeWatchers.add(page.name);
  let lastContent = '';
  
  const check = () => {
    try {
      if (!existsSync(page.file)) return;
      markFileSeen(page.file);
      const text = readFileSync(page.file, 'utf8');
      if (text === lastContent) return;
      lastContent = text;
      const req = parseRequest(text, page.name);
      if (!req) return;
      const snippetRaw = (req.code || '').replace(/\s+/g, ' ').trim();
      const snippet = snippetRaw.length > 20 ? snippetRaw.slice(0, 20) + '...' : snippetRaw;
      console.info(`> ${req.agent} to ${page.name} "${snippet}"`);
      job.create(page, req.agent, req.code, req.hasFooter);
      registry.updateMaster(root);
    } catch (err) {
      console.warn(`[${page.name}] parse error:`, err);
    }
  };
  
  const debounceCheck = () => {
    const t = timers.get(page.name);
    if (t) clearTimeout(t);
    timers.set(page.name, setTimeout(check, DEBOUNCE_MS));
  };
  
  if (existsSync(page.file)) {
    watch(page.file, debounceCheck);
  } else {
    const debugDir = page.file.replace(/\\[^\\]+$/, '');
    try {
      watch(debugDir || '.', (eventType, filename) => {
        if (filename === page.file.split(/\\|\//).pop()) debounceCheck();
      });
    } catch {}
  }
  check();
}

/**
 * Watch debug.md for %%SHUTDOWN%% marker and shutdown server if found
 * @param {string} root
 */
export function watchForRestart(root) {
  const debugFile = join(root, 'debug.md');
  let lastContent = '';
  
  const check = () => {
    try {
      if (!existsSync(debugFile)) return;
      const text = readFileSync(debugFile, 'utf8');
      if (text === lastContent) return;
      lastContent = text;
      
      // Check for shutdown marker on its own line
      const lines = text.split('\n');
      const shutdownLine = lines.findIndex(line => line.trim() === '%%SHUTDOWN%%');
      
      if (shutdownLine !== -1) {
        const shutdownRequestedAt = new Date();
        console.log('👾' + shutdownRequestedAt.toLocaleTimeString() + ' %%SHUTDOWN%% detected in debug.md - shutting down server...');
        
        // Update debug.md with server down message
        const downMessage = `# Server has been shut down ${shutdownRequestedAt.toLocaleTimeString()}

> The server has been shut down with an explicit command. Run \`npm start\` to restart it.`;
        writeFileSync(debugFile, downMessage, 'utf8');
        
        // Clean shutdown
        console.log('👾Server shutdown complete');
        process.exit(0);
      }
    } catch (err) {
      console.warn('👾𝗱𝗲𝗯𝘂𝗴.𝗺𝗱 shutdown check error:', err);
    }
  };
  
  const debounceCheck = () => {
    const t = timers.get('__restart__');
    if (t) clearTimeout(t);
    timers.set('__restart__', setTimeout(check, DEBOUNCE_MS));
  };
  
  if (existsSync(debugFile)) {
    watch(debugFile, debounceCheck);
    check(); // Initial check
  }
}
