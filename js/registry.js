// @ts-check
import { join, relative } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const DEBUG_DIR = 'debug';
const MASTER_FILE = 'debug.md';

/** @param {string} name */
const sanitizeName = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** @param {number} ms */
const clockFmt = ms => {
  const d = new Date(ms);
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
};

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
  const master = join(root, MASTER_FILE);
  if (!existsSync(master)) 
    writeFileSync(master, '# Connected pages:\n\n> Master registry of connected pages and states.\n\n', 'utf8');
}

/** @param {string} root @param {string} name @param {string} url */
export function getOrCreate(root, name, url) {
  let page = pages.get(name);
  if (!page) {
    const sanitized = sanitizeName(name);
    const dir = join(root, DEBUG_DIR);
    let chosenFilename = null;
    
    if (existsSync(dir)) {
      try {
        for (const f of readdirSync(dir)) {
          if (!f.toLowerCase().startsWith(sanitized)) continue;
          try {
            if (readFileSync(join(dir, f), 'utf8').includes('> Write code in a fenced JS block')) {
              chosenFilename = f;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    const file = join(root, DEBUG_DIR, chosenFilename || `${sanitized}.md`);
    page = { name, url, file, state: 'idle', lastSeen: Date.now() };
    pages.set(name, page);
    
    try { console.log(`  ${url} connected for ${relative(root, file).replace(/\\/g, '/')}`); } catch {}
    updateMaster(root);
  }
  page.lastSeen = Date.now();
  return page;
}

/** @param {string} root */
export function updateMaster(root) {
  const lines = ['# Connected pages:\n', '> Master registry of connected pages and states.\n'];
  for (const p of Array.from(pages.values()).sort((a, b) => b.lastSeen - a.lastSeen)) {
    const path = relative(root, p.file).replace(/\\/g, '/');
    lines.push(`* [${p.name}](${path}) (${p.url}) last ${clockFmt(p.lastSeen)} state: ${p.state}`);
  }
  writeFileSync(join(root, MASTER_FILE), lines.join('\n') + '\n', 'utf8');
}

/** @param {string} name */
export const get = name => pages.get(name);
export const all = () => Array.from(pages.values());
