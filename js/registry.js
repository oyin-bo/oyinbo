// @ts-check
import { join, relative } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { sanitizeName, randomId, clockFmt } from './utils.js';

const DEBUG_DIR = 'debug';
const MASTER_FILE = 'debug.md';

/**
 * @typedef {{
 *   name: string,
 *   url: string,
 *   file: string,
 *   state: 'idle' | 'executing',
 *   lastSeen: number
 * }} Page
 */

/** @type {Map<string, Page>} */
const pages = new Map();

/** @param {string} root */
export function init(root) {
  // Do not create `debug/` directory here - agents must create per-instance files.
  // Ensure the master registry exists and is managed by the server.
  const master = join(root, MASTER_FILE);
  if (!existsSync(master)) {
    writeFileSync(master,
      '# Connected pages:\n\n' +
      '> Master registry of connected pages and states.\n\n',
      'utf8');
  }
}

/** @param {string} root @param {string} name @param {string} url */
export function getOrCreate(root, name, url) {
  let page = pages.get(name);
  if (!page) {
    const sanitized = sanitizeName(name);
    const dir = join(root, DEBUG_DIR);

    // If a matching per-instance file already exists (created by an agent)
    // prefer that file and only register when it contains the canonical footer.
    let chosenFilename = null;
    if (existsSync(dir)) {
      try {
        for (const f of readdirSync(dir)) {
          if (!f.toLowerCase().startsWith(sanitized)) continue;
          const p = join(dir, f);
          try {
            const txt = readFileSync(p, 'utf8');
            if (txt.includes('> Write code in a fenced JS block')) {
              chosenFilename = f;
              break;
            }
          } catch (e) {
            // ignore unreadable files
          }
        }
      } catch (e) {
        // ignore directory read errors
      }
    }

  // If no agent-created file exists yet, prefer the sanitized filename
  // (per spec). If an agent later creates a suffixed filename we will
  // detect and adopt it on subsequent lookups.
  const filename = chosenFilename || `${sanitized}.md`;
    const file = join(root, DEBUG_DIR, filename);

    page = { name, url, file, state: 'idle', lastSeen: Date.now() };
    pages.set(name, page);

    // Persist the master registry link even when the per-instance file is missing.
    updateMaster(root);
  }
  page.lastSeen = Date.now();
  return page;
}

/** @param {string} root */
export function updateMaster(root) {
  const lines = [
    '# Connected pages:\n',
    '> Master registry of connected pages and states.\n'
  ];
  
  for (const p of Array.from(pages.values()).sort((a, b) => b.lastSeen - a.lastSeen)) {
    const path = relative(root, p.file).replace(/\\/g, '/');
    lines.push(`* [${p.name}](${path}) (${p.url}) last ${clockFmt(p.lastSeen)} state: ${p.state}`);
  }
  
  writeFileSync(join(root, MASTER_FILE), lines.join('\n') + '\n', 'utf8');
}

/** @param {string} name */
export function get(name) {
  return pages.get(name);
}

export function all() {
  return Array.from(pages.values());
}
