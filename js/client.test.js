// @ts-check
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('clientScript exports valid string', async () => {
  const { clientScript } = await import('./client.js');
  assert.equal(typeof clientScript, 'string');
  assert.ok(clientScript.length > 100);
});

test('clientScript includes test runner injection', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('globalThis.test'));
  assert.ok(clientScript.includes('globalThis.oyinboRunTests'));
  assert.ok(clientScript.includes('globalThis.assert'));
});

test('clientScript includes worker creation logic', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('createWorker'));
  assert.ok(clientScript.includes('new Worker'));
  assert.ok(clientScript.includes('webworker'));
});

test('clientScript includes heartbeat monitoring', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('checkWorkerHealth'));
  assert.ok(clientScript.includes('WORKER_HEALTH_CHECK_INTERVAL'));
  assert.ok(clientScript.includes('WORKER_TIMEOUT'));
  assert.ok(clientScript.includes('worker-timeout'));
});

test('clientScript includes restart logic', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('workerRestartCount'));
  assert.ok(clientScript.includes('MAX_RESTART_ATTEMPTS'));
  assert.ok(clientScript.includes('worker.terminate'));
});

test('clientScript includes main thread polling loop', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('while (true)'));
  assert.ok(clientScript.includes('fetch(endpoint'));
  assert.ok(clientScript.includes('AsyncFunction'));
});
