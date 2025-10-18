// @ts-check

/**
 * Test runner as ES module for use via import maps
 * Usage: import { test, describe } from 'node:test'
 * (mapped to /oyinbo/test-runner.js via import maps)
 */

// Realm-based test registry (supports main thread + workers)
function getTestRegistry(/** @type {string} */ realmId) {
  const g = /** @type {any} */ (globalThis);
  if (!g.__oyinbo_test_registries) {
    g.__oyinbo_test_registries = {};
  }
  if (!g.__oyinbo_test_registries[realmId]) {
    g.__oyinbo_test_registries[realmId] = {
      tests: [],
      currentSuite: null
    };
  }
  return g.__oyinbo_test_registries[realmId];
}

// Get realm ID from URL or sessionStorage
function getRealmId() {
  if (typeof window !== 'undefined') {
    return sessionStorage.getItem('oyinbo-name') || 'main';
  }
  if (typeof self !== 'undefined' && self.name) {
    return self.name;
  }
  return 'unknown';
}

const registry = getTestRegistry(getRealmId());

/**
 * Register a test
 * @param {string|object} nameOrOptions
 * @param {any} optionsOrFn
 * @param {any} maybeFn
 */
export function test(nameOrOptions, optionsOrFn, maybeFn) {
  let name, options = {}, fn;
  if (typeof nameOrOptions === 'string') {
    name = nameOrOptions;
    if (typeof optionsOrFn === 'function') {
      fn = optionsOrFn;
    } else {
      options = optionsOrFn || {};
      fn = maybeFn;
    }
  } else {
    options = nameOrOptions || {};
    name = options.name || 'unnamed test';
    fn = optionsOrFn;
  }
  
  registry.tests.push({
    name,
    fn,
    suite: registry.currentSuite,
    skip: options.skip,
    only: options.only,
    timeout: options.timeout || 30000
  });
}

/**
 * Register a test suite
 * @param {string} name
 * @param {function} fn
 */
export function describe(name, fn) {
  const prevSuite = registry.currentSuite;
  registry.currentSuite = name;
  try {
    fn();
  } finally {
    registry.currentSuite = prevSuite;
  }
}

/**
 * Alias for test
 */
export const it = test;

/**
 * Run registered tests
 * @param {object} options
 * @returns {Promise<object>} results
 */
export async function oyinboRunTests(options = {}) {
  const files = options.files || [];
  const timeout = options.timeout || 60000;
  const realmId = getRealmId();
  const reg = getTestRegistry(realmId);
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    tests: []
  };
  
  const startTime = Date.now();
  
  try {
    // Import test files
    for (const file of files) {
      try {
        await import(file);
      } catch (err) {
        results.tests.push({
          name: `Import: ${file}`,
          passed: false,
          error: (err && typeof err === 'object' && 'stack' in err) ? (err.stack || String(err)) : String(err),
          duration: 0
        });
        results.failed++;
        results.total++;
      }
    }
    
    // Execute tests
    for (const testCase of reg.tests) {
      results.total++;
      
      if (testCase.skip) {
        results.skipped++;
        results.tests.push({
          name: testCase.name,
          suite: testCase.suite,
          skipped: true,
          duration: 0
        });
        continue;
      }
      
      const testStart = Date.now();
      const testResult = {
        name: testCase.name,
        suite: testCase.suite,
        passed: false,
        error: null,
        duration: 0
      };
      
      try {
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`Test timeout after ${testCase.timeout}ms`)), testCase.timeout)
        );
        
        await Promise.race([
          testCase.fn(),
          timeoutPromise
        ]);
        
        testResult.passed = true;
        results.passed++;
      } catch (err) {
        testResult.error = (err && typeof err === 'object' && 'stack' in err) ? (err.stack || String(err)) : String(err);
        results.failed++;
      }
      
      testResult.duration = Date.now() - testStart;
      results.tests.push(testResult);
    }
    
  } catch (err) {
    results.tests.push({
      name: 'Test Runner Error',
      passed: false,
      error: (err && typeof err === 'object' && 'stack' in err) ? (err.stack || String(err)) : String(err),
      duration: 0
    });
    results.failed++;
    results.total++;
  }
  
  results.duration = Date.now() - startTime;
  
  // Make results available globally for REPL capture
  const g = /** @type {any} */ (globalThis);
  if (typeof globalThis !== 'undefined') {
    g.__oyinbo_test_results = results;
  }
  
  return results;
}

/**
 * AssertionError - matches Node.js assert module
 */
export class AssertionError extends Error {
  constructor(/** @type {any} */ message, /** @type {any} */ actual, /** @type {any} */ expected) {
    super(message);
    this.name = 'AssertionError';
    this.actual = actual;
    this.expected = expected;
  }
}

/**
 * Assert module - Node.js compatible
 */
export const assert = {
  ok: (/** @type {any} */ value, /** @type {any} */ message) => {
    if (!value) throw new AssertionError(message || 'Expected truthy value', value, true);
  },
  equal: (/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) => {
    if (actual != expected) throw new AssertionError(message || 'Values not equal', actual, expected);
  },
  strictEqual: (/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) => {
    if (actual !== expected) throw new AssertionError(message || 'Values not strictly equal', actual, expected);
  },
  notEqual: (/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) => {
    if (actual == expected) throw new AssertionError(message || 'Values should not be equal', actual, expected);
  },
  notStrictEqual: (/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) => {
    if (actual === expected) throw new AssertionError(message || 'Values should not be strictly equal', actual, expected);
  },
  deepEqual: (/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new AssertionError(message || 'Objects not deeply equal', actual, expected);
    }
  },
  throws: (/** @type {any} */ fn, /** @type {any} */ error, /** @type {any} */ message) => {
    let threw = false;
    try { fn(); } catch (e) { threw = true; }
    if (!threw) throw new AssertionError(message || 'Function did not throw', null, 'error');
  },
  rejects: async (/** @type {any} */ fn, /** @type {any} */ error, /** @type {any} */ message) => {
    let rejected = false;
    try { await fn(); } catch (e) { rejected = true; }
    if (!rejected) throw new AssertionError(message || 'Promise did not reject', null, 'rejection');
  },
  fail: (/** @type {any} */ message) => {
    throw new AssertionError(message || 'Explicit fail', undefined, undefined);
  }
};

// Default export for assert module mapping
export default assert;
