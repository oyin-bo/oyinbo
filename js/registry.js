// @ts-check
import { join, relative } from 'node:path';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { daebugMD_template } from './daebug.md.template.js';

const DAEBUG_DIR = 'daebug';
const MASTER_FILE = 'daebug.md';

const startTime = new Date();

/** @param {string} name */
const sanitizeName = name => name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

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
  if (!existsSync(master)) {
    const content = daebugMD_template({
      startTime: startTime,
      pageList: []
    });
    writeFileSync(master, content, 'utf8');
  }
}

/** @param {string} root @param {string} name @param {string} url */
export function getOrCreate(root, name, url) {
  let page = pages.get(name);
  if (!page) {
    const sanitized = sanitizeName(name);
    const dir = join(root, DAEBUG_DIR);
    let chosenFilename = null;
    
    if (existsSync(dir)) {
      try {
        for (const f of readdirSync(dir)) {
          // Check if filename matches exactly (without .md extension)
          const nameWithoutExt = f.replace(/\.md$/i, '');
          if (nameWithoutExt.toLowerCase() !== sanitized.toLowerCase()) continue;
          try {
            if (readFileSync(join(dir, f), 'utf8').includes('> Write code in a fenced JS block')) {
              chosenFilename = f;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    const file = join(root, DAEBUG_DIR, chosenFilename || `${sanitized}.md`);
    page = { name, url, file, state: 'idle', lastSeen: Date.now() };
    pages.set(name, page);
    
    const daebugReplFile = relative(root, file).replace(/\\/g, '/');
    console.log(`   📃 ${daebugReplFile}  for ${url}`);
    updateMaster(root);
  }
  page.lastSeen = Date.now();
  return page;
}

/** @param {string} root */
export function updateMaster(root) {
  const content = daebugMD_template({
    startTime: startTime,
    pageList: Array.from(pages.values()),
    root
  });
  
  writeFileSync(join(root, MASTER_FILE), content, 'utf8');
}

/** @param {string} name */
export const get = name => pages.get(name);
export const all = () => Array.from(pages.values());
export const getStartTime = () => startTime;
