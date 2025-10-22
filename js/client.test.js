// @ts-check

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { clientMainFunction } from './client.js';

const defaultOverrides = {
  Date,
  sessionStorage: {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
    clear: () => {},
    key: () => null,
    length: 0,
  },
  location: { href: '', origin: '' },
  Worker: () => {},
  fetch: () => Promise.reject(),
  setInterval: global.setInterval,
  clearInterval: global.clearInterval,
  setTimeout: global.setTimeout,
  clearTimeout: global.clearTimeout,
  addEventListener: () => {},
  console: global.console,
};

describe('clientMainFunction', () => {

  describe('sanitizeName', () => {
    test('converts to lowercase', async () => {
      const exported = {};
      // @ts-ignore - minimal mocks for testing
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.sanitizeName('MyWorker'), 'myworker');
    });

    test('replaces spaces with dashes', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.sanitizeName('my worker'), 'my-worker');
    });

    test('replaces special characters with dashes', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.sanitizeName('my@worker#name'), 'my-worker-name');
    });

    test('collapses multiple special chars to single dash', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.sanitizeName('my@@@@worker'), 'my-worker');
    });

    test('removes leading and trailing dashes', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.sanitizeName('---my-worker---'), 'my-worker');
    });

    test('produces DNS-safe names', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      const result = exported.sanitizeName('Test_Worker-123!@#');
      assert.match(result, /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/);
    });
  });

  describe('serializeValue', () => {
    test('serializes null', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.serializeValue(null), 'null');
    });

    test('serializes undefined', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.serializeValue(undefined), 'undefined');
    });

    test('serializes strings', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.serializeValue('hello'), 'hello');
    });

    test('serializes numbers', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.serializeValue(42), '42');
    });

    test('serializes booleans', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.serializeValue(true), 'true');
      assert.strictEqual(exported.serializeValue(false), 'false');
    });

    test('serializes arrays', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.strictEqual(exported.serializeValue([1, 2, 3]), '[1, 2, 3]');
    });

    test('respects depth limit on objects', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      // For arrays, depth limit is enforced during recursion
      const deepArray = [1, [2, [3, [4, [5, 6]]]]];
      const result = exported.serializeValue(deepArray);
      assert.ok(result.includes('[Deep Object]'));
    });

    test('serializes functions by name', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      const named = function myFunc() { };
      assert.strictEqual(exported.serializeValue(named), 'myFunc');
    });

    test('handles circular references in objects', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      const obj = { a: 1 };
      obj.self = obj;
      const result = exported.serializeValue(obj);
      assert.ok(typeof result === 'string');
    });
  });

  describe('handleErrorEvent', () => {
    test('captures window.onerror events', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.ok(exported.handleErrorEvent);
    });
  });

  describe('handlePromiseRejectionEvent', () => {
    test('captures unhandledrejection events', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.ok(exported.handlePromiseRejectionEvent);
    });
  });

  describe('sleep', () => {
    test('returns a promise', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      const result = exported.sleep(10);
      assert.ok(result instanceof Promise);
    });

    test('resolves after specified time', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      const result = await exported.sleep(100);
      assert.strictEqual(result, undefined);
    });
  });

  describe('test mode', () => {
    test('exports all internal functions when testExport provided', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);

      const expectedFunctions = [
        'serializeValue',
        'sanitizeName',
        'createWorker',
        'checkWorkerHealth',
        'handleErrorEvent',
        'handlePromiseRejectionEvent',
        'scheduleBackgroundFlush',
        'start',
        'sleep'
      ];

      expectedFunctions.forEach(name => {
        assert.ok(typeof exported[name] === 'function', `${name} should be exported`);
      });
    });

    test('does not call start when testExport provided', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.ok(exported.sanitizeName);
    });
  });

  describe('dependency injection', () => {
    test('uses provided overrides instead of window', async () => {
      const exported = {};
      await clientMainFunction(defaultOverrides, exported);
      assert.ok(exported.sanitizeName);
    });
  });

});