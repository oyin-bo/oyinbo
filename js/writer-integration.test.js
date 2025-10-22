// @ts-check
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeReply, writeExecuting } from './writer.js';

describe('writeReply with requestHasFooter false', () => {
  /** @type {string} */
  let tempDir;
  /** @type {string} */
  let testFile;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-writer-reply-'));
    testFile = join(tempDir, 'test-page.md');
  });

  test('appends reply when last fence has no agent header', () => {
    const content = [
      '# Test',
      '',
      '```js',
      'const x = 1;',
      '```'
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'test-1',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const x = 1;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: false
    };
    
    const result = { ok: true, value: 42 };
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('### 🗣️copilot to test-page at'));
    assert.ok(output.includes('#### 👍test-page to copilot at'));
    assert.ok(output.includes('```JSON\n42\n```'));
    assert.ok(output.includes('Write code in a fenced JS block'));
  });

  test('preserves agent header when present above last fence', () => {
    const content = [
      '# Test',
      '',
      '### 🗣️copilot to test-page at 10:00:00',
      '```js',
      'const y = 2;',
      '```'
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'test-2',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const y = 2;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: false
    };
    
    const result = { ok: true, value: 100 };
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    const agentHeaders = (output.match(/### 🗣️copilot to test-page at/g) || []).length;
    assert.strictEqual(agentHeaders, 1); // Should not duplicate
  });

  test('adds agent header when none exists', () => {
    const content = [
      '# Test',
      '',
      '```js',
      'const z = 3;',
      '```'
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'test-3',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const z = 3;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: false
    };
    
    const result = { ok: false, error: 'Test error' };
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('### 🗣️copilot to test-page at'));
    assert.ok(output.includes('```Error\nTest error\n```'));
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeReply with executing block', () => {
  /** @type {string} */
  let tempDir;
  /** @type {string} */
  let testFile;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-writer-exec-'));
    testFile = join(tempDir, 'test-page.md');
  });

  test('replaces executing placeholder with result', () => {
    const content = [
      '# Test',
      '',
      '### 🗣️copilot to test-page at 10:00:00',
      '```JS',
      'await sleep(1000);',
      '```',
      '',
      '#### 👍test-page to copilot at 10:00:01',
      'executing (0s)',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      ''
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'exec-1',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'await sleep(1000);',
      requestedAt: Date.now() - 1000,
      startedAt: Date.now() - 1000,
      requestHasFooter: true
    };
    
    const result = { ok: true, value: 'done' };
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(!output.includes('executing'));
    assert.ok(output.includes('```JSON\ndone\n```'));
  });

  test('removes executing block entirely', () => {
    const content = [
      '# Test',
      '',
      '#### 👍test-page to copilot at 10:00:00',
      'executing (0s)',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      ''
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'exec-2',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const x = 1;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: true
    };
    
    const result = { ok: false, error: 'Execution failed' };
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    const lines = output.split('\n');
    const executingLines = lines.filter(l => l.includes('executing'));
    assert.strictEqual(executingLines.length, 0);
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeExecuting with requestHasFooter false', () => {
  /** @type {string} */
  let tempDir;
  /** @type {string} */
  let testFile;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-writer-exec2-'));
    testFile = join(tempDir, 'test-page.md');
  });

  test('appends executing when last fence has agent header', () => {
    const content = [
      '# Test',
      '',
      '### 🗣️copilot to test-page at 10:00:00',
      '```js',
      'const x = 1;',
      '```'
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'exec-3',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const x = 1;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: false
    };
    
    writeExecuting(job);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('#### 👍test-page to copilot at'));
    assert.ok(output.includes('executing (0s)'));
    assert.ok(output.includes('Write code in a fenced JS block'));
  });

  test('adds agent header when missing', () => {
    const content = [
      '# Test',
      '',
      '```js',
      'const y = 2;',
      '```'
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'exec-4',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const y = 2;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: false
    };
    
    writeExecuting(job);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('### 🗣️copilot to test-page at'));
    assert.ok(output.includes('#### 👍test-page to copilot at'));
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeReply with backgroundEvents', () => {
  /** @type {string} */
  let tempDir;
  /** @type {string} */
  let testFile;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-writer-bg-'));
    testFile = join(tempDir, 'test-page.md');
  });

  test('includes console log events', () => {
    const content = [
      '# Test',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      ''
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'bg-1',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'console.log("test");',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: true
    };
    
    const result = {
      ok: true,
      value: null,
      backgroundEvents: [
        { type: 'console', level: 'log', ts: '10:00:00', message: 'test' }
      ]
    };
    
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('```Text console.log'));
    assert.ok(output.includes('test'));
  });

  test('includes error events', () => {
    const content = [
      '# Test',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      ''
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'bg-2',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'throw new Error("oops");',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: true
    };
    
    const result = {
      ok: false,
      error: 'Error: oops',
      backgroundEvents: [
        { type: 'error', source: 'window.onerror', ts: '10:00:00', message: 'oops', stack: 'Error: oops\n  at line 1' }
      ]
    };
    
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('```window.onerror'));
    assert.ok(output.includes('Error: oops'));
  });

  test('truncates backgroundEvents when more than 10', () => {
    const content = [
      '# Test',
      '',
      '----------------------------------------------------------------------',
      '> Write code in a fenced JS block below to execute against this page.',
      ''
    ].join('\n');
    
    writeFileSync(testFile, content, 'utf8');
    
    const events = Array.from({ length: 15 }, (_, i) => ({
      type: 'console',
      level: 'log',
      ts: '10:00:00',
      message: `Event ${i}`
    }));
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'bg-3',
      page: { name: 'test-page', file: testFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'for(let i=0; i<15; i++) console.log(i);',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: true
    };
    
    const result = { ok: true, value: null, backgroundEvents: events };
    writeReply(job, result);
    
    const output = readFileSync(testFile, 'utf8');
    assert.ok(output.includes('more background events omitted'));
    assert.ok(output.includes('Event 0'));
    assert.ok(output.includes('Event 14'));
    assert.ok(!output.includes('Event 5')); // Should be in omitted range
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeReply file missing handling', () => {
  /** @type {string} */
  let tempDir;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-writer-miss-'));
  });

  test('skips write when file does not exist', () => {
    const missingFile = join(tempDir, 'missing.md');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'miss-1',
      page: { name: 'test-page', file: missingFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const x = 1;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: true
    };
    
    const result = { ok: true, value: 42 };
    
    // Should not throw
    assert.doesNotThrow(() => {
      writeReply(job, result);
    });
    
    // File should still not exist
    assert.strictEqual(existsSync(missingFile), false);
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writeExecuting file missing handling', () => {
  /** @type {string} */
  let tempDir;

  test('setup', () => {
    tempDir = mkdtempSync(join(tmpdir(), 'daebug-writer-miss2-'));
  });

  test('skips write when file does not exist', () => {
    const missingFile = join(tempDir, 'missing.md');
    
    /** @type {import('./job.js').Job} */
    const job = {
      id: 'miss-2',
      page: { name: 'test-page', file: missingFile, url: 'http://test', state: 'executing', lastSeen: Date.now() },
      agent: 'copilot',
      code: 'const x = 1;',
      requestedAt: Date.now(),
      startedAt: Date.now(),
      requestHasFooter: true
    };
    
    // Should not throw
    assert.doesNotThrow(() => {
      writeExecuting(job);
    });
    
    // File should still not exist
    assert.strictEqual(existsSync(missingFile), false);
  });

  test('cleanup', () => {
    if (tempDir && existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});

describe('writer console logging', () => {
  test('writeReply logs success', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('console.info(`> ${job.page.name} to ${job.agent} ${result.ok ? \'succeeded\' : \'failed\'}'));
  });

  test('writeReply truncates result for logging', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('resultText.slice(0, 100) + \'...\''));
  });

  test('writeReply normalizes whitespace in log', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('replace(/\\s+/g, \' \')'));
  });

  test('writeReply includes duration in log', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('durationFmt(duration)'));
  });
});

describe('writer watcher integration', () => {
  test('writeReply checks hasFileBeenSeen', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('hasFileBeenSeen(job.page.file)'));
  });

  test('writeReply warns on missing seen file', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('[writer] writeReply: target file missing'));
  });

  test('writeExecuting checks hasFileBeenSeen', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    const matches = writerContent.match(/hasFileBeenSeen/g);
    assert.ok(matches && matches.length >= 2);
  });

  test('writeExecuting warns on missing seen file', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('[writer] writeExecuting: target file missing'));
  });
});

describe('writer module structure', () => {
  test('imports from node:fs', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('from \'node:fs\''));
  });

  test('imports from watcher.js', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('from \'./watcher.js\''));
  });

  test('exports writeReply', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('export function writeReply'));
  });

  test('exports writeExecuting', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('export function writeExecuting'));
  });

  test('exports writeDiagnostic', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('export function writeDiagnostic'));
  });

  test('exports helper functions', () => {
    const writerContent = readFileSync('./js/writer.js', 'utf8');
    assert.ok(writerContent.includes('export { clockFmt, durationFmt, findFooter'));
  });
});
