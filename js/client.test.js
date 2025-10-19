// @ts-check
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('clientScript exports valid string', async () => {
  const { clientScript } = await import('./client.js');
  assert.equal(typeof clientScript, 'string');
  assert.ok(clientScript.length > 100);
});

test('clientScript does not inject test runner inline', async () => {
  const { clientScript } = await import('./client.js');
  // Test runner should NOT be injected inline - it's available via import maps
  assert.ok(!clientScript.includes('globalThis.test'));
  assert.ok(!clientScript.includes('globalThis.oyinboRunTests'));
  assert.ok(!clientScript.includes('globalThis.assert'));
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

test('clientScript includes name sanitization for workers', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('sanitizeName'));
  assert.ok(clientScript.includes('toLowerCase'));
});

test('clientScript includes background event capture', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('backgroundEvents'));
  assert.ok(clientScript.includes('window.addEventListener'));
  assert.ok(clientScript.includes('error'));
  assert.ok(clientScript.includes('unhandledrejection'));
});

test('clientScript includes console monkeypatching', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('originalConsole'));
  assert.ok(clientScript.includes('console.log'));
  assert.ok(clientScript.includes('console.error'));
});

test('clientScript includes formatTime helper', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('formatTime'));
  assert.ok(clientScript.includes('getHours'));
  assert.ok(clientScript.includes('getMinutes'));
  assert.ok(clientScript.includes('getSeconds'));
});

test('clientScript includes serializeValue helper', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('serializeValue'));
  assert.ok(clientScript.includes('depth'));
});

test('clientScript handles worker creation failure', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('MAX_RESTART_ATTEMPTS'));
  assert.ok(clientScript.includes('worker creation failed'));
});

test('clientScript includes worker-init message', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('worker-init'));
  assert.ok(clientScript.includes('mainPage'));
});

test('clientScript includes ping/pong protocol', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('ping'));
  assert.ok(clientScript.includes('pong'));
  assert.ok(clientScript.includes('lastWorkerPong'));
});

test('clientScript includes sessionStorage for name', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('sessionStorage'));
  assert.ok(clientScript.includes('oyinbo-name'));
});

test('clientScript includes random word list for names', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('mint'));
  assert.ok(clientScript.includes('nova'));
  assert.ok(clientScript.includes('zen'));
});

test('clientScript includes worker termination logic', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('worker.terminate'));
  assert.ok(clientScript.includes('unresponsive'));
});

test('clientScript includes AsyncFunction for execution', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('AsyncFunction'));
  assert.ok(clientScript.includes('getPrototypeOf'));
});

test('clientScript includes job execution tracking', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('jobStartIdx'));
  assert.ok(clientScript.includes('jobEvents'));
  assert.ok(clientScript.includes('jobId'));
});

test('clientScript includes error retry logic', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('catch'));
  assert.ok(clientScript.includes('sleep'));
  assert.ok(clientScript.includes('3000'));
});

test('clientScript includes POST result payload', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('method: \'POST\''));
  assert.ok(clientScript.includes('Content-Type'));
  assert.ok(clientScript.includes('application/json'));
});

test('clientMainFunction is exported', async () => {
  const { clientMainFunction } = await import('./client.js');
  assert.equal(typeof clientMainFunction, 'function');
});

test('clientMainFunction name is preserved', async () => {
  const { clientMainFunction } = await import('./client.js');
  assert.equal(clientMainFunction.name, 'clientMainFunction');
});

test('clientScript is wrapped in IIFE', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.startsWith('('));
  assert.ok(clientScript.endsWith('();'));
});

test('clientScript includes import map support check', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('HTMLScriptElement.supports'));
  assert.ok(clientScript.includes('importmap'));
});

test('clientScript includes worker-bootstrap.js reference', async () => {
  const { clientScript } = await import('./client.js');
  assert.ok(clientScript.includes('worker-bootstrap.js'));
  assert.ok(clientScript.includes('type: \'module\''));
});
