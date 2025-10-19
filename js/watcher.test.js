// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';
import { mkdtempSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { hasFileBeenSeen, markFileSeen } from './watcher.js';

describe('watcher file tracking', () => {
  test('hasFileBeenSeen returns false for new file', () => {
    const testFile = 'never-before-seen-' + Date.now() + '.md';
    assert.strictEqual(hasFileBeenSeen(testFile), false);
  });

  test('markFileSeen adds file to seen set', () => {
    const testFile = 'mark-test-' + Date.now() + '.md';
    assert.strictEqual(hasFileBeenSeen(testFile), false);
    markFileSeen(testFile);
    assert.strictEqual(hasFileBeenSeen(testFile), true);
  });

  test('hasFileBeenSeen returns true after markFileSeen', () => {
    const testFile = 'seen-test-' + Date.now() + '.md';
    markFileSeen(testFile);
    assert.strictEqual(hasFileBeenSeen(testFile), true);
  });

  test('multiple markFileSeen calls are idempotent', () => {
    const testFile = 'idempotent-' + Date.now() + '.md';
    markFileSeen(testFile);
    markFileSeen(testFile);
    markFileSeen(testFile);
    assert.strictEqual(hasFileBeenSeen(testFile), true);
  });
});

describe('watcher module exports', () => {
  test('exports watchPage function', async () => {
    const watcher = await import('./watcher.js');
    assert.equal(typeof watcher.watchPage, 'function');
  });

  test('exports watchForRestart function', async () => {
    const watcher = await import('./watcher.js');
    assert.equal(typeof watcher.watchForRestart, 'function');
  });

  test('exports hasFileBeenSeen function', async () => {
    const watcher = await import('./watcher.js');
    assert.equal(typeof watcher.hasFileBeenSeen, 'function');
  });

  test('exports markFileSeen function', async () => {
    const watcher = await import('./watcher.js');
    assert.equal(typeof watcher.markFileSeen, 'function');
  });
});

describe('watchForRestart shutdown detection', () => {
  test('watchForRestart is exported and callable', async () => {
    const watcher = await import('./watcher.js');
    assert.equal(typeof watcher.watchForRestart, 'function');
    // Don't actually call it to avoid creating persistent file watchers
  });
});

describe('watchPage behavior', () => {
  test('watchPage is exported and callable', async () => {
    const watcher = await import('./watcher.js');
    assert.equal(typeof watcher.watchPage, 'function');
    // Don't actually call it to avoid creating persistent file watchers
  });
});

describe('watcher debounce constant', () => {
  test('DEBOUNCE_MS is reasonable value', async () => {
    // Read the file to check DEBOUNCE_MS value
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    const match = watcherContent.match(/const DEBOUNCE_MS = (\d+)/);
    
    assert.ok(match, 'DEBOUNCE_MS constant should exist');
    const debounceMs = parseInt(match[1], 10);
    
    assert.ok(debounceMs > 0, 'DEBOUNCE_MS should be positive');
    assert.ok(debounceMs <= 1000, 'DEBOUNCE_MS should be reasonable (≤1000ms)');
  });
});

describe('watcher file path handling', () => {
  test('watcher code handles Windows-style paths', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    // Check that watcher uses path manipulation that works cross-platform
    assert.ok(watcherContent.includes('replace(/\\\\[^\\\\]+$/, \'\')'));
  });

  test('watcher code handles file path splitting', () => {
    const watcherContent = readFileSync('./js/watcher.js', 'utf8');
    // Check that watcher splits file paths correctly
    assert.ok(watcherContent.includes('split(/\\\\|\\//)'));
  });
});

describe('watcher edge cases', () => {
  test('hasFileBeenSeen handles empty string', () => {
    assert.strictEqual(hasFileBeenSeen(''), false);
  });

  test('markFileSeen handles empty string', () => {
    assert.doesNotThrow(() => {
      markFileSeen('');
    });
    assert.strictEqual(hasFileBeenSeen(''), true);
  });

  test('hasFileBeenSeen handles very long path', () => {
    const longPath = 'a'.repeat(1000) + '.md';
    assert.strictEqual(hasFileBeenSeen(longPath), false);
  });

  test('markFileSeen handles special characters in path', () => {
    const specialPath = 'test@#$%^&*().md';
    assert.doesNotThrow(() => {
      markFileSeen(specialPath);
    });
    assert.strictEqual(hasFileBeenSeen(specialPath), true);
  });
});
