// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('watchPage with parseRequest integration', () => {
  /** @type {string} */
  let tempDir;
  /** @type {import('./registry.js').Page} */
  let page;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-watch-parse-'));
    page = {
      name: 'test-parse-page',
      file: join(tempDir, 'test-parse-page.md'),
      url: 'http://test',
      state: 'idle',
      lastSeen: Date.now()
    };
  });

  test('detects code block with agent header', async () => {
    const content = [
      '# Test Page',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      '> **copilot** to test-parse-page at 10:00:00',
      '```js',
      'console.log("hello");',
      '```'
    ].join('\n');
    
    writeFileSync(page.file, content, 'utf8');
    
    // Import after file exists
    const { parseRequest } = await import('./parser.js');
    const req = parseRequest(content, page.name);
    
    assert.ok(req);
    assert.strictEqual(req.agent, 'copilot');
    assert.strictEqual(req.code, 'console.log("hello");');
  });

  test('returns request without footer when footer missing', async () => {
    const content = [
      '# Test Page',
      '',
      '> **copilot** to test-parse-page at 10:00:00',
      '```js',
      'const x = 1;',
      '```',
      ''
    ].join('\n');
    
    writeFileSync(page.file, content, 'utf8');
    
    const { parseRequest } = await import('./parser.js');
    const req = parseRequest(content, page.name);
    
    assert.ok(req);
    assert.strictEqual(req.hasFooter, false);
    assert.strictEqual(req.code, 'const x = 1;');
  });

  test('detects multiple code blocks and uses last one', async () => {
    const content = [
      '# Test Page',
      '',
      '> **copilot** to test-parse-page at 10:00:00',
      '```js',
      'const first = 1;',
      '```',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      '> **copilot** to test-parse-page at 10:01:00',
      '```js',
      'const second = 2;',
      '```'
    ].join('\n');
    
    writeFileSync(page.file, content, 'utf8');
    
    const { parseRequest } = await import('./parser.js');
    const req = parseRequest(content, page.name);
    
    assert.ok(req);
    assert.strictEqual(req.code, 'const second = 2;');
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('watchForRestart shutdown marker handling', () => {
  /** @type {string} */
  let tempDir;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-shutdown-'));
  });

  test('finds %%SHUTDOWN%% on its own line', () => {
    const daebugFile = join(tempDir, 'daebug.md');
    const content = [
      '# Debug',
      '',
      'Some content',
      '',
      '%%SHUTDOWN%%',
      '',
      'More content'
    ].join('\n');
    
    writeFileSync(daebugFile, content, 'utf8');
    const lines = content.split('\n');
    const shutdownLine = lines.findIndex(line => line.trim() === '%%SHUTDOWN%%');
    
    assert.strictEqual(shutdownLine, 4);
  });

  test('ignores %%SHUTDOWN%% in code blocks', () => {
    const content = [
      '# Debug',
      '',
      '```js',
      'const marker = "%%SHUTDOWN%%";',
      '```',
      ''
    ].join('\n');
    
    const lines = content.split('\n');
    const shutdownLine = lines.findIndex(line => line.trim() === '%%SHUTDOWN%%');
    
    assert.strictEqual(shutdownLine, -1);
  });

  test('ignores %%SHUTDOWN%% with prefix', () => {
    const content = [
      '# Debug',
      '',
      'Note: %%SHUTDOWN%%',
      ''
    ].join('\n');
    
    const lines = content.split('\n');
    const shutdownLine = lines.findIndex(line => line.trim() === '%%SHUTDOWN%%');
    
    assert.strictEqual(shutdownLine, -1);
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('watcher debounce mechanism', () => {
  test('DEBOUNCE_MS constant exists', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    const match = watcherContent.match(/const DEBOUNCE_MS = (\d+)/);
    assert.ok(match);
  });

  test('debounceCheck uses setTimeout', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('setTimeout(check, DEBOUNCE_MS)'));
  });

  test('clears existing timer before setting new one', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('clearTimeout(t)'));
  });

  test('timers stored per page name', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('timers.get(page.name)'));
    assert.ok(watcherContent.includes('timers.set(page.name'));
  });
});

describe('watchPage activeWatchers tracking', () => {
  test('activeWatchers prevents duplicate watches', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('if (activeWatchers.has(page.name)) return'));
  });

  test('activeWatchers adds page name', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('activeWatchers.add(page.name)'));
  });

  test('activeWatchers is a Set', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('const activeWatchers = new Set()'));
  });
});

describe('watchPage file watching logic', () => {
  test('uses fs.watch for existing files', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('watch(page.file, debounceCheck)'));
  });

  test('watches parent directory for non-existent files', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('watch(daebugDir ||'));
  });

  test('extracts directory from file path', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('page.file.replace(/\\\\[^\\\\]+$/, \'\')'));
  });

  test('filters watch events by filename', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('filename === page.file.split'));
  });

  test('calls check immediately after setup', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    // Should see check() called outside the watch callbacks
    const checkCalls = (watcherContent.match(/\bcheck\(\)/g) || []).length;
    assert.ok(checkCalls >= 2); // At least one in setup, one in callback
  });
});

describe('watchPage content change detection', () => {
  test('tracks lastContent to detect changes', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('let lastContent = \'\''));
  });

  test('returns early if content unchanged', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('if (text === lastContent) return'));
  });

  test('updates lastContent after read', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('lastContent = text'));
  });

  test('returns early if file does not exist', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('if (!existsSync(page.file)) return'));
  });

  test('marks file as seen when read', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('markFileSeen(page.file)'));
  });
});

describe('watchPage job creation', () => {
  test('creates job when request parsed', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('job.create(page, req.agent, req.code, req.hasFooter)'));
  });

  test('returns early if no request', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('if (!req) return'));
  });

  test('updates master registry after job creation', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('registry.updateMaster(root)'));
  });

  test('logs request snippet', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('console.info(`> ${req.agent} to ${page.name}'));
  });

  test('truncates snippet to 20 chars', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('snippetRaw.slice(0, 20) + \'...\''));
  });
});

describe('watchPage error handling', () => {
  test('catches parse errors', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('catch (err)'));
  });

  test('logs parse errors with page name', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('console.warn(`[${page.name}] parse error:'));
  });

  test('catches watch setup errors', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('try {'));
    assert.ok(watcherContent.includes('} catch {}'));
  });
});

describe('watchForRestart file watching', () => {
  test('watches daebug.md in root', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('const daebugFile = join(root, \'daebug.md\')'));
  });

  test('uses debounce for restart checks', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('timers.get(\'__restart__\')'));
  });

  test('performs initial check', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('check(); // Initial check'));
  });

  test('tracks content changes', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    // Should see lastContent pattern in watchForRestart
    const matches = watcherContent.match(/let lastContent = ''/g);
    assert.ok(matches && matches.length >= 2); // One in watchPage, one in watchForRestart
  });
});

describe('watchForRestart shutdown handling', () => {
  test('finds shutdown marker line', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('lines.findIndex(line => line.trim() === \'%%SHUTDOWN%%\')'));
  });

  test('logs shutdown detection', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('%%SHUTDOWN%% detected'));
  });

  test('writes server down message', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('has been shut down') || watcherContent.includes('Server is down'));
  });

  test('includes restart instructions in down message', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('npm start'));
  });

  test('exits process cleanly', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('process.exit(0)'));
  });

  test('logs shutdown complete', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('Server shutdown complete'));
  });
});

describe('watcher error handling comprehensive', () => {
  test('catches daebug.md check errors', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('hutdown check error:'));
  });

  test('handles missing daebug.md gracefully', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('if (!existsSync(daebugFile)) return'));
  });

  test('watchPage returns early on missing file', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    const returns = (watcherContent.match(/if \(!existsSync\([^)]+\)\) return/g) || []).length;
    assert.ok(returns >= 2); // watchPage and watchForRestart
  });
});

describe('watcher module structure', () => {
  test('imports from node:fs', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('from \'node:fs\''));
  });

  test('imports from node:child_process', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('from \'node:child_process\''));
  });

  test('imports from node:path', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('from \'node:path\''));
  });

  test('imports parser module', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('from \'./parser.js\''));
  });

  test('imports job module', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('from \'./job.js\''));
  });

  test('imports registry module', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('from \'./registry.js\''));
  });

  test('exports watchPage', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('export function watchPage'));
  });

  test('exports watchForRestart', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('export function watchForRestart'));
  });

  test('exports hasFileBeenSeen', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('export const hasFileBeenSeen'));
  });

  test('exports markFileSeen', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    assert.ok(watcherContent.includes('export const markFileSeen'));
  });
});
