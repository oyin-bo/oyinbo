// @ts-check
import { join, relative } from 'node:path';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
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
  const dir = join(root, DEBUG_DIR);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  
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
    const filename = `${sanitized}.md`;
    const file = join(root, DEBUG_DIR, filename);
    
    page = { name, url, file, state: 'idle', lastSeen: Date.now() };
    pages.set(name, page);
    
    if (!existsSync(file)) {
      writeFileSync(file,
        `# ${name}\n\n` +
        `> This file is a REPL presented as a chat between you and a live page. ` +
        `Add a fenced JavaScript block at the bottom and the connected page will run it.\n\n` +
        `> Write code in a fenced JS block below to execute against this page.\n`,
        'utf8');
    }
    
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
