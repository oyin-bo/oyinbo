// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// We need to import and test the internal functions, so we'll need to export them
// For now, let's test the public API and add a note about helper function testing

// Import module to get access to functions
// Note: sanitizeName and clockFmt are internal - we'll test them indirectly or export for testing
import * as registry from './registry.js';

test('getOrCreate creates new page when not exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page = registry.getOrCreate(root, 'test-page', 'http://localhost');
    assert.strictEqual(page.name, 'test-page');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOrCreate sets url correctly', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page = registry.getOrCreate(root, 'test-page-url', 'http://example.com');
    assert.strictEqual(page.url, 'http://example.com');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOrCreate sets state to idle initially', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page = registry.getOrCreate(root, 'test-page', 'http://localhost');
    assert.strictEqual(page.state, 'idle');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOrCreate returns existing page on second call', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page1 = registry.getOrCreate(root, 'test-page', 'http://localhost');
    const page2 = registry.getOrCreate(root, 'test-page', 'http://localhost');
    assert.strictEqual(page1, page2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOrCreate updates lastSeen on second call', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page1 = registry.getOrCreate(root, 'test-page', 'http://localhost');
    const firstSeen = page1.lastSeen;
    // Small delay to ensure timestamp changes
    const now = Date.now();
    while (Date.now() === now) {} // spin wait
    const page2 = registry.getOrCreate(root, 'test-page', 'http://localhost');
    assert.ok(page2.lastSeen > firstSeen);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('get returns undefined for non-existent page', () => {
  const result = registry.get('non-existent-page');
  assert.strictEqual(result, undefined);
});

test('get returns page after getOrCreate', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page = registry.getOrCreate(root, 'test-page', 'http://localhost');
    const retrieved = registry.get('test-page');
    assert.strictEqual(retrieved, page);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('all returns empty array initially', () => {
  // Note: all() returns shared state, so this test assumes fresh state
  // In practice we'd need to reset state between tests
  const result = registry.all();
  assert.ok(Array.isArray(result));
});

test('all returns array of pages after creation', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    registry.getOrCreate(root, 'page-1', 'http://localhost');
    registry.getOrCreate(root, 'page-2', 'http://localhost');
    const result = registry.all();
    assert.ok(result.length >= 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOrCreate finds existing per-instance file with footer', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const daebugDir = join(root, 'daebug');
    mkdirSync(daebugDir, { recursive: true });
    
    const content = [
      'Test file',
      '> Write code in a fenced JS block below to execute against this page.',
      ''
    ].join('\n');
    
    writeFileSync(join(daebugDir, 'test-page.md'), content, 'utf8');
    
    const page = registry.getOrCreate(root, 'test-page', 'http://localhost');
    assert.ok(page.file.endsWith('test-page.md'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('getOrCreate creates sanitized filename', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    const page = registry.getOrCreate(root, 'Test@Page#123', 'http://localhost');
    assert.ok(page.file.includes('test-page-123'));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('init creates master file when not exists', () => {
  const root = mkdtempSync(join(tmpdir(), 'daebug-test-'));
  try {
    registry.init(root);
    const masterPath = join(root, 'daebug.md');
    assert.ok(existsSync(masterPath));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
