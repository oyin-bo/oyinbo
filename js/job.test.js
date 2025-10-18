// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as job from './job.js';

test('create sets agent field correctly', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'alice', 'x + 1', true);
    
    assert.strictEqual(j.agent, 'alice');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create sets code field correctly', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'console.log(42)', true);
    
    assert.strictEqual(j.code, 'console.log(42)');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create sets requestHasFooter field correctly', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x', false);
    
    assert.strictEqual(j.requestHasFooter, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create defaults requestHasFooter to true', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    
    assert.strictEqual(j.requestHasFooter, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create sets page state to executing', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    job.create(page, 'agent', 'x');
    
    assert.strictEqual(page.state, 'executing');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create sets startedAt to null initially', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    
    assert.strictEqual(j.startedAt, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('create sets requestedAt timestamp', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const before = Date.now();
    const j = job.create(page, 'agent', 'x');
    const after = Date.now();
    
    assert.ok(j.requestedAt >= before && j.requestedAt <= after);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('get returns job by page name', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test-page', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    
    const retrieved = job.get('test-page');
    assert.strictEqual(retrieved, j);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('get returns undefined for non-existent job', () => {
  const result = job.get('non-existent-job');
  assert.strictEqual(result, undefined);
});

test('finish sets page state to idle', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    job.finish(j);
    
    assert.strictEqual(page.state, 'idle');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('finish sets finishedAt timestamp', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    job.finish(j);
    
    assert.ok(j.finishedAt !== null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('finish removes job from registry', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test-remove', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    job.finish(j);
    
    const retrieved = job.get('test-remove');
    assert.strictEqual(retrieved, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('start sets startedAt timestamp', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    job.start(j);
    
    assert.ok(j.startedAt !== null);
    // Cleanup
    job.finish(j);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('start is idempotent', () => {
  const root = mkdtempSync(join(tmpdir(), 'oyinbo-test-'));
  try {
    mkdirSync(join(root, 'debug'), { recursive: true });
    const file = join(root, 'debug', 'test.md');
    writeFileSync(file, '> Write code in a fenced JS block below\n', 'utf8');
    
    const page = { name: 'test', state: 'idle', file, url: 'http://localhost', lastSeen: Date.now() };
    const j = job.create(page, 'agent', 'x');
    job.start(j);
    const firstStartedAt = j.startedAt;
    
    // Call start again
    job.start(j);
    assert.strictEqual(j.startedAt, firstStartedAt);
    
    // Cleanup
    job.finish(j);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
