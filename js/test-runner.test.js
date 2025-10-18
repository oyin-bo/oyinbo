// @ts-check
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

test('testRunnerScript exports valid string', async () => {
  const { testRunnerScript } = await import('./test-runner.js');
  assert.equal(typeof testRunnerScript, 'string');
  assert.ok(testRunnerScript.length > 100);
  // Module exports test/describe, not globalThis injection
  assert.ok(testRunnerScript.includes('export function test'));
  assert.ok(testRunnerScript.includes('export function describe'));
  assert.ok(testRunnerScript.includes('export async function oyinboRunTests'));
});

test('testRunnerScript includes assertion library', async () => {
  const { testRunnerScript } = await import('./test-runner.js');
  assert.ok(testRunnerScript.includes('const assert'));
  assert.ok(testRunnerScript.includes('ok:'));
  assert.ok(testRunnerScript.includes('equal:'));
  assert.ok(testRunnerScript.includes('strictEqual:'));
  assert.ok(testRunnerScript.includes('AssertionError'));
});

test('testRunnerScript includes test execution logic', async () => {
  const { testRunnerScript } = await import('./test-runner.js');
  assert.ok(testRunnerScript.includes('async function oyinboRunTests'));
  assert.ok(testRunnerScript.includes('await import(file)'));
  assert.ok(testRunnerScript.includes('passed'));
  assert.ok(testRunnerScript.includes('failed'));
});
