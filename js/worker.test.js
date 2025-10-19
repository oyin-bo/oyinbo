// @ts-check
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('workerScript exports valid string', async () => {
  const { workerScript } = await import('./worker.js');
  assert.equal(typeof workerScript, 'string');
  assert.ok(workerScript.length > 100);
});

test('workerScript includes worker initialization', async () => {
  const { workerScript } = await import('./worker.js');
  assert.ok(workerScript.includes('initialized'));
  assert.ok(workerScript.includes('self.addEventListener'));
});

test('workerScript includes heartbeat response', async () => {
  const { workerScript } = await import('./worker.js');
  assert.ok(workerScript.includes('ping'));
  assert.ok(workerScript.includes('pong'));
  assert.ok(workerScript.includes('self.postMessage'));
});

test('workerScript does not inject test runner inline', async () => {
  const { workerScript } = await import('./worker.js');
  // Worker uses import maps, not globalThis injection
  assert.ok(!workerScript.includes('globalThis.test'));
  assert.ok(!workerScript.includes('globalThis.daebugRunTests'));
});

test('workerScript includes polling loop', async () => {
  const { workerScript } = await import('./worker.js');
  assert.ok(workerScript.includes('while (true)'));
  assert.ok(workerScript.includes('fetch(endpoint'));
  assert.ok(workerScript.includes('AsyncFunction'));
});
