// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

describe('test-runner module exports', () => {
  test('testRunnerScript exports valid string', async () => {
    const { testRunnerScript } = await import('./test-runner.js');
    assert.equal(typeof testRunnerScript, 'string');
    assert.ok(testRunnerScript.length > 100);
    // Module exports test/describe, not globalThis injection
    assert.ok(testRunnerScript.includes('export function test'));
    assert.ok(testRunnerScript.includes('export function describe'));
    assert.ok(testRunnerScript.includes('export async function daebugRunTests'));
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
    assert.ok(testRunnerScript.includes('async function daebugRunTests'));
    assert.ok(testRunnerScript.includes('await import('));
    assert.ok(testRunnerScript.includes('passed'));
    assert.ok(testRunnerScript.includes('failed'));
  });
});

describe('test-runner functionality', () => {
  // Import the actual test runner functions from modules
  let testFn, describeFn, itFn, daebugRunTests, assertLib, AssertionError;
  
  test('load test runner module', async () => {
    const module = await import('./modules/test-runner.js');
    testFn = module.test;
    describeFn = module.describe;
    itFn = module.it;
    daebugRunTests = module.daebugRunTests;
    assertLib = module.assert;
    AssertionError = module.AssertionError;
    
    assert.ok(testFn, 'test function exported');
    assert.ok(describeFn, 'describe function exported');
    assert.ok(itFn, 'it function exported');
    assert.ok(daebugRunTests, 'daebugRunTests function exported');
    assert.ok(assertLib, 'assert object exported');
    assert.ok(AssertionError, 'AssertionError class exported');
  });
});

describe('assertion library', () => {
  /** @type {any} */ let assertLib;
  /** @type {any} */ let AssertionError;
  
  test('setup', async () => {
    const module = await import('./modules/test-runner.js');
    assertLib = module.assert;
    AssertionError = module.AssertionError;
  });
  
  test('assert.ok passes for truthy values', () => {
    assertLib.ok(true);
    assertLib.ok(1);
    assertLib.ok('string');
    assertLib.ok({});
    assertLib.ok([]);
  });
  
  test('assert.ok fails for falsy values', () => {
    assert.throws(() => assertLib.ok(false));
    assert.throws(() => assertLib.ok(0));
    assert.throws(() => assertLib.ok(''));
    assert.throws(() => assertLib.ok(null));
    assert.throws(() => assertLib.ok(undefined));
  });
  
  test('assert.equal passes for loose equality', () => {
    assertLib.equal(1, 1);
    assertLib.equal('hello', 'hello');
    assertLib.equal(1, '1');
    assertLib.equal(true, 1);
  });
  
  test('assert.equal fails for non-equal values', () => {
    assert.throws(() => assertLib.equal(1, 2));
    assert.throws(() => assertLib.equal('a', 'b'));
  });
  
  test('assert.strictEqual passes for strict equality', () => {
    assertLib.strictEqual(1, 1);
    assertLib.strictEqual('hello', 'hello');
    assertLib.strictEqual(true, true);
  });
  
  test('assert.strictEqual fails for loose equality', () => {
    assert.throws(() => assertLib.strictEqual(1, '1'));
    assert.throws(() => assertLib.strictEqual(true, 1));
  });
  
  test('assert.notEqual passes for non-equal values', () => {
    assertLib.notEqual(1, 2);
    assertLib.notEqual('a', 'b');
  });
  
  test('assert.notEqual fails for equal values', () => {
    assert.throws(() => assertLib.notEqual(1, 1));
    assert.throws(() => assertLib.notEqual(1, '1')); // loose equality
  });
  
  test('assert.notStrictEqual passes for non-strict-equal values', () => {
    assertLib.notStrictEqual(1, '1');
    assertLib.notStrictEqual(true, 1);
  });
  
  test('assert.notStrictEqual fails for strict equal values', () => {
    assert.throws(() => assertLib.notStrictEqual(1, 1));
  });
  
  test('assert.deepEqual passes for equal primitives', () => {
    assertLib.deepEqual(1, 1);
    assertLib.deepEqual('hello', 'hello');
    assertLib.deepEqual(true, true);
  });
  
  test('assert.deepEqual passes for equal arrays', () => {
    assertLib.deepEqual([1, 2, 3], [1, 2, 3]);
    assertLib.deepEqual(['a', 'b'], ['a', 'b']);
  });
  
  test('assert.deepEqual fails for different arrays', () => {
    assert.throws(() => assertLib.deepEqual([1, 2], [1, 3]));
    assert.throws(() => assertLib.deepEqual([1, 2], [1, 2, 3]));
  });
  
  test('assert.deepEqual passes for equal objects', () => {
    assertLib.deepEqual({ x: 1, y: 2 }, { x: 1, y: 2 });
    assertLib.deepEqual({ a: 'hello' }, { a: 'hello' });
  });
  
  test('assert.deepEqual fails for different objects', () => {
    assert.throws(() => assertLib.deepEqual({ x: 1 }, { x: 2 }));
    assert.throws(() => assertLib.deepEqual({ x: 1 }, { x: 1, y: 2 }));
  });
  
  test('assert.deepEqual passes for nested objects', () => {
    assertLib.deepEqual(
      { a: { b: { c: 1 } } },
      { a: { b: { c: 1 } } }
    );
  });
  
  test('assert.deepEqual passes for dates', () => {
    const d = new Date('2025-01-01');
    assertLib.deepEqual(d, new Date('2025-01-01'));
  });
  
  test('assert.deepEqual fails for different dates', () => {
    assert.throws(() => 
      assertLib.deepEqual(new Date('2025-01-01'), new Date('2025-01-02'))
    );
  });
  
  test('assert.deepEqual passes for regex', () => {
    assertLib.deepEqual(/test/gi, /test/gi);
  });
  
  test('assert.deepEqual fails for different regex', () => {
    assert.throws(() => assertLib.deepEqual(/test/i, /test/g));
    assert.throws(() => assertLib.deepEqual(/test/, /other/));
  });
  
  test('assert.throws passes when function throws', () => {
    assertLib.throws(() => { throw new Error('test'); });
  });
  
  test('assert.throws fails when function does not throw', () => {
    assert.throws(() => assertLib.throws(() => {}));
  });
  
  test('assert.throws validates error constructor', () => {
    assertLib.throws(() => { throw new TypeError('test'); }, TypeError);
  });
  
  test('assert.throws fails when wrong error constructor', () => {
    assert.throws(() => 
      assertLib.throws(() => { throw new Error('test'); }, TypeError)
    );
  });
  
  test('assert.throws validates error message with regex', () => {
    assertLib.throws(() => { throw new Error('test message'); }, /test/);
  });
  
  test('assert.throws fails when message does not match regex', () => {
    assert.throws(() => 
      assertLib.throws(() => { throw new Error('test'); }, /other/)
    );
  });
  
  test('assert.rejects passes when promise rejects', async () => {
    await assertLib.rejects(async () => { throw new Error('test'); });
  });
  
  test('assert.rejects fails when promise resolves', async () => {
    await assert.rejects(async () => 
      await assertLib.rejects(async () => {})
    );
  });
  
  test('assert.rejects validates error constructor', async () => {
    await assertLib.rejects(
      async () => { throw new TypeError('test'); },
      TypeError
    );
  });
  
  test('assert.rejects validates error message with regex', async () => {
    await assertLib.rejects(
      async () => { throw new Error('test message'); },
      /test/
    );
  });
  
  test('assert.fail always throws', () => {
    assert.throws(() => assertLib.fail());
    assert.throws(() => assertLib.fail('custom message'));
  });
  
  test('AssertionError has correct properties', () => {
    try {
      assertLib.strictEqual(1, 2);
      assert.fail('Should have thrown');
    } catch (/** @type {any} */ err) {
      assert.ok(err instanceof AssertionError);
      assert.strictEqual(err.name, 'AssertionError');
      assert.ok(err.message);
      assert.strictEqual(err.actual, 1);
      assert.strictEqual(err.expected, 2);
    }
  });
});

describe('test execution', () => {
  test('executes and returns results structure', async () => {
    const module = await import('./modules/test-runner.js');
    const results = /** @type {any} */ (await module.daebugRunTests({ files: [] }));
    
    assert.ok(typeof results.passed === 'number');
    assert.ok(typeof results.failed === 'number');
    assert.ok(typeof results.skipped === 'number');
    assert.ok(typeof results.total === 'number');
    assert.ok(typeof results.duration === 'number');
    assert.ok(Array.isArray(results.tests));
  });
});
