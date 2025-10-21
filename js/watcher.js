// @ts-check
import { watch, readFileSync, existsSync, writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { parseRequest } from './parser.js';
import * as job from './job.js';
import * as registry from './registry.js';
import { daebugMD_template } from './daebug.md.template.js';

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
  /** @type {ReturnType<typeof watch> | null} */
  let watcher = null;
  
  const check = () => {
    try {
      if (!existsSync(page.file)) {
        lastContent = '';
        return;
      }
      
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
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
        console.warn(`[${page.name}] error:`, err);
      }
    }
  };
  
  const debounce = () => {
    const t = timers.get(page.name);
    if (t) clearTimeout(t);
    timers.set(page.name, setTimeout(check, DEBOUNCE_MS));
  };
  
  const setupWatch = () => {
    if (watcher) watcher.close();
    
    try {
      if (existsSync(page.file)) {
        watcher = watch(page.file, (evt) => {
          if (evt === 'rename' && !existsSync(page.file)) setupWatch();
          debounce();
        });
      } else {
        const dir = page.file.replace(/[\\\/][^\\\/]+$/, '') || '.';
        const name = page.file.split(/[\\\/]/).pop();
        watcher = watch(dir, (evt, file) => {
          if (file === name) { setupWatch(); debounce(); }
        });
      }
    } catch (err) {
      if (err && typeof err === 'object' && 'code' in err && err.code !== 'ENOENT') {
        console.warn(`[${page.name}] watch failed:`, err);
      }
    }
  };
  
  setupWatch();
  check();
}

/**
 * Watch daebug.md for %%SHUTDOWN%% marker and shutdown server if found
 * @param {string} root
 */
export function watchForRestart(root) {
  const daebugFile = join(root, 'daebug.md');
  let lastContent = '';
  
  const check = () => {
    try {
      if (!existsSync(daebugFile)) return;
      const text = readFileSync(daebugFile, 'utf8');
      if (text === lastContent) return;
      lastContent = text;
      
      // Check for shutdown marker on its own line
      const lines = text.split('\n');
      const shutdownLine = lines.findIndex(line => line.trim() === '%%SHUTDOWN%%');
      
      if (shutdownLine !== -1) {
        const shutdownRequestedAt = new Date();
        console.log('👾' + shutdownRequestedAt.toLocaleTimeString() + ' %%SHUTDOWN%% detected in daebug.md - shutting down server...');
        
        // Get start time from registry module
        const startTime = registry.getStartTime();
        
        // Update daebug.md with shutdown template
        const downMessage = daebugMD_template({
          startTime: startTime,
          endTime: shutdownRequestedAt,
          isShutdown: true
        });
        writeFileSync(daebugFile, downMessage, 'utf8');
        
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
  
  if (existsSync(daebugFile)) {
    const watcher = watch(daebugFile, debounceCheck);
    watcher.on('error', (err) => {
      console.warn('👾𝗱𝗲𝗯𝘂𝗴.𝗺𝗱 watcher error:', err);
    });
    check(); // Initial check
  }
}
