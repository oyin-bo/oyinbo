// @ts-check

/**
 * Test runner as ES module for use via import maps
 * Usage: import { test, describe } from 'node:test'
 * (mapped to /daebug/test-runner.js via import maps)
 */

// Realm-based test registry (supports main thread + workers)
function getTestRegistry(/** @type {string} */ realmId) {
  const g = /** @type {any} */ (globalThis);
  if (!g.__daebug_test_registries) {
    g.__daebug_test_registries = {};
  }
  if (!g.__daebug_test_registries[realmId]) {
    g.__daebug_test_registries[realmId] = {
      tests: [],
      currentSuite: null
    };
  }
  return g.__daebug_test_registries[realmId];
}

// Get realm ID from URL or sessionStorage
function getRealmId() {
  try {
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      return sessionStorage.getItem('daebug-name') || 'main';
    }
  } catch (e) {
    // sessionStorage might not be accessible
  }
  if (typeof self !== 'undefined' && self.name) {
    return self.name;
  }
  return 'unknown';
}

const registry = /** @type {any} */ (getTestRegistry(getRealmId()));

/** Format timestamp with milliseconds: HH:MM:SS.mmm */
/** @param {number} ms */
const fullTsFmt = ms => {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  const ms3 = String(d.getMilliseconds()).padStart(3, '0');
  return `${hh}:${mm}:${ss}.${ms3}`;
};

/**
 * Register a test
 * @param {string|object} nameOrOptions
 * @param {any} optionsOrFn
 * @param {any} maybeFn
 */
export function test(nameOrOptions, optionsOrFn, maybeFn) {
  let name, options = /** @type {any} */ ({}), fn;
  if (typeof nameOrOptions === 'string') {
    name = nameOrOptions;
    if (typeof optionsOrFn === 'function') {
      fn = optionsOrFn;
    } else {
      options = optionsOrFn || {};
      fn = maybeFn;
    }
  } else {
    options = /** @type {any} */ (nameOrOptions || {});
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
 * @typedef {{
 *  name: string,
 *  suite?: string,
 *  passed?: boolean,
 *  skipped?: boolean,
 *  error?: string | any,
 *  duration: number,
 *  completedAt: number
 * }} TestState
 */

/**
 * Run registered tests
 * @param {{
 *  files?: string[],
 *  timeout?: number,
 *  streamProgress: (progress: {
 *    complete: boolean,
 *    recentTests?: TestState[],
 *    allTests?: TestState[],
 *    totals: { pass: number, fail: number, skip: number, total: number },
 *    duration: number
 *  }) => void | Promise<any>
 * }} options
 */
export async function daebugRunTests(options) {
  const files = options.files || [];
  const streamProgress = options.streamProgress;
  const realmId = getRealmId();
  const reg = getTestRegistry(realmId);
  
  const results = {
    passed: 0,
    failed: 0,
    skipped: 0,
    total: 0,
    duration: 0,
    tests:/** @type {TestState[]}*/([])
  };
  
  const startTime = Date.now();
  
  try {
    // Import test files
    for (const file of files) {
      try {
        // Normalize file path to be absolute from root
        // If relative path, make it absolute from root (/)
        let resolvedFile = file;
        if (!file.startsWith('/') && !file.startsWith('http')) {
          resolvedFile = '/' + file.replace(/^\.\//, '');
        }
        // Add cache-busting query parameter to force re-import on each test run
        resolvedFile += `?t=${Date.now()}`;
        await import(resolvedFile);
      } catch (err) {
        const now = Date.now();
        results.tests.push({
          name: `Import: ${file.replace(/^\//, '')}`,
          passed: false,
          error: (err && typeof err === 'object' && 'stack' in err) ? (err.stack || String(err)) : String(err),
          duration: 0,
          completedAt: now
        });
        results.failed++;
        results.total++;
      }
    }
    
    // Check if there are any 'only' tests
  const hasOnly = reg.tests.some((/** @type {any} */ t) => t.only);
    
    // Execute tests
    for (const testCase of reg.tests) {
      // Yield to message loop before each test to allow progress reporting
      await new Promise(resolve => setTimeout(resolve, 1));
      results.total++;
      
      // Skip tests if there are 'only' tests and this isn't one
      if (hasOnly && !testCase.only) {
        results.skipped++;
        const now = Date.now();
        results.tests.push({
          name: testCase.name,
          suite: testCase.suite,
          skipped: true,
          duration: 0,
          completedAt: now
        });
        continue;
      }
      
      if (testCase.skip) {
        results.skipped++;
        const now = Date.now();
        results.tests.push({
          name: testCase.name,
          suite: testCase.suite,
          skipped: true,
          duration: 0,
          completedAt: now
        });
        continue;
      }
      
      const testStart = Date.now();
      /** @type {any} */
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
        const _err = /** @type {any} */ (err);
        testResult.error = (_err && typeof _err === 'object' && 'stack' in _err) ? (_err.stack || String(_err)) : String(_err);
        results.failed++;
      }
      
      testResult.duration = Date.now() - testStart;
      const completed = Date.now();
      testResult.completedAt = completed;
      testResult.fullTs = fullTsFmt(completed);
      results.tests.push(testResult);
      
      await streamProgress({
        complete: false,
        recentTests: [testResult],
        totals: { pass: results.passed, fail: results.failed, skip: results.skipped, total: results.total },
        duration: Date.now() - startTime
      });
    }
    
  } catch (err) {
    const now = Date.now();
    results.tests.push({
      name: 'Test Runner Error',
      passed: false,
      error: (err && typeof err === 'object' && 'stack' in err) ? (err.stack || String(err)) : String(err),
      duration: 0,
      completedAt: now
    });
    results.failed++;
    results.total++;
  }
  
  results.duration = Date.now() - startTime;
  
  // Clear test registry after run
  reg.tests.length = 0;
  reg.currentSuite = null;
  
  // Make results available globally for REPL capture
  const g = /** @type {any} */ (globalThis);
  if (typeof globalThis !== 'undefined') {
    g.__daebug_test_results = results;
  }
  
  return results;
}

/**
 * Node.js-compatible run() function with test discovery and streaming
 * @param {object} options
 * @returns {Promise<object>}
 */
export async function run(options = {}) {
  /** @type {any} */
  const opt = options || {};
  const files = opt.files || ['**/*.test.js'];
  const realmId = getRealmId();
  
  try {
    // Determine if files are explicit paths or patterns
    let testFiles = [];
    const explicitFiles = [];
    const patterns = [];
    
    const fileList = Array.isArray(files) ? files : [files];
    for (const file of fileList) {
      if (file.includes('*')) {
        patterns.push(file);
      } else {
        explicitFiles.push(file);
      }
    }
    
    // If we have patterns, discover files from server
    if (patterns.length > 0 && typeof fetch !== 'undefined') {
      const response = await fetch('/daebug/discover-tests', { // TODO: covert to root-relative, avoid nested directories
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: patterns })
      });
      
      if (!response.ok) {
        throw new Error(`Test discovery failed: ${response.status}`);
      }
      
      const data = await response.json();
      testFiles = data.files || [];
      
      console.log(`   𒀸  discovered ${testFiles.length} test files`);
    }
    
    // Add explicit files
    testFiles = [...testFiles, ...explicitFiles];
    
    if (testFiles.length === 0) {
      console.warn('   𒀸  no test files found');
      return { passed: 0, failed: 0, skipped: 0, total: 0, duration: 0, tests: [] };
    }
    
    // Create streaming handler
    let lastProgressTime = Date.now();
    const progressDebounceMs = 2000;
    
    /**
     * @type {Parameters<typeof daebugRunTests>[0]['streamProgress']} 
     */
    const streamProgress = async (progressData) => {
      const now = Date.now();
      if (now - lastProgressTime < progressDebounceMs && !progressData.complete) {
        return; // Debounce
      }
      lastProgressTime = now;
      
      try {
        await fetch('/daebug/test-progress', { // TODO: covert to root-relative, avoid nested directories
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            realmName: realmId,
            ...progressData
          })
        });
      } catch (err) {
        console.error('   𒀸  failed to stream progress:', err);
      }
    };
    
    // Run tests with daebugRunTests and pass streaming handler
    const results = await daebugRunTests({ files: testFiles, streamProgress, ...options });
    
    // Stream final results - include ALL tests, not just recent
    await streamProgress({
      complete: true,
      totals: {
        pass: results.passed,
        fail: results.failed,
        skip: results.skipped,
        total: results.total
      },
      duration: results.duration,
      allTests: results.tests.map((/** @type {any} */ t) => ({
          name: t.name,
          suite: t.suite,
          status: t.skipped ? 'skip' : (t.passed ? 'pass' : 'fail'),
          duration: t.duration,
          error: t.error,
          fullTs: t.fullTs,
          completedAt: t.completedAt
        }))
    });
    
    return results;
  } catch (err) {
    console.error('   𒀸  run() failed:', err);
    throw err;
  }
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
 * Assert methods object - shared between default export and strict namespace
 */
const assertMethods = {
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
    if (!deepEqualImpl(actual, expected)) {
      throw new AssertionError(message || 'Objects not deeply equal', actual, expected);
    }
  },
  deepStrictEqual: (/** @type {any} */ actual, /** @type {any} */ expected, /** @type {any} */ message) => {
    if (!deepStrictEqualImpl(actual, expected)) {
      throw new AssertionError(message || 'Objects not deeply equal', actual, expected);
    }
  },
  match: (/** @type {any} */ string, /** @type {RegExp} */ regexp, /** @type {any} */ message) => {
    if (!regexp.test(String(string))) {
      throw new AssertionError(
        message || `String does not match pattern ${regexp}`,
        string,
        regexp
      );
    }
  },
  doesNotMatch: (/** @type {any} */ string, /** @type {RegExp} */ regexp, /** @type {any} */ message) => {
    if (regexp.test(String(string))) {
      throw new AssertionError(
        message || `String matches pattern ${regexp}`,
        string,
        regexp
      );
    }
  },
  throws: (/** @type {any} */ fn, /** @type {any} */ errorValidator, /** @type {any} */ message) => {
    let threw = false;
    let caughtError = null;
    try { fn(); } catch (e) { threw = true; caughtError = e; }
    if (!threw) throw new AssertionError(message || 'Function did not throw', null, 'error');
    
    // Validate error if validator provided
    if (errorValidator) {
      const _caught = /** @type {any} */ (caughtError);
      if (typeof errorValidator === 'function') {
        // Constructor check
        if (!(_caught instanceof errorValidator)) {
          throw new AssertionError(
            message || `Expected error to be instance of ${errorValidator.name}`,
            caughtError,
            errorValidator
          );
        }
      } else if (errorValidator instanceof RegExp) {
        // Regex check on message
        if (!errorValidator.test(_caught?.message || String(_caught))) {
          throw new AssertionError(
            message || `Expected error message to match ${errorValidator}`,
            _caught?.message,
            errorValidator
          );
        }
      }
    }
  },
  doesNotThrow: (/** @type {any} */ fn, /** @type {any} */ message) => {
    try {
      fn();
    } catch (e) {
      throw new AssertionError(
        message || `Function threw unexpectedly: ${e}`,
        e,
        null
      );
    }
  },
  rejects: async (/** @type {any} */ fn, /** @type {any} */ errorValidator, /** @type {any} */ message) => {
    let rejected = false;
    let caughtError = null;
    try { await fn(); } catch (e) { rejected = true; caughtError = e; }
    if (!rejected) throw new AssertionError(message || 'Promise did not reject', null, 'rejection');
    
    // Validate error if validator provided
    if (errorValidator) {
      const _caught = /** @type {any} */ (caughtError);
      if (typeof errorValidator === 'function') {
        // Constructor check
        if (!(_caught instanceof errorValidator)) {
          throw new AssertionError(
            message || `Expected rejection to be instance of ${errorValidator.name}`,
            caughtError,
            errorValidator
          );
        }
      } else if (errorValidator instanceof RegExp) {
        // Regex check on message
        if (!errorValidator.test(_caught?.message || String(_caught))) {
          throw new AssertionError(
            message || `Expected rejection message to match ${errorValidator}`,
            _caught?.message,
            errorValidator
          );
        }
      }
    }
  },
  doesNotReject: async (/** @type {any} */ fn, /** @type {any} */ message) => {
    try {
      await fn();
    } catch (e) {
      throw new AssertionError(
        message || `Promise rejected unexpectedly: ${e}`,
        e,
        null
      );
    }
  },
  fail: (/** @type {any} */ message) => {
    throw new AssertionError(message || 'Explicit fail', undefined, undefined);
  }
};

/**
 * Assert module - Node.js compatible
 */
export const assert = assertMethods;

/**
 * Strict assert namespace - all strict mode assertions
 * In Node.js, strict mode uses strict equality (===) for all comparisons
 */
export const strict = assertMethods;

/**
 * Deep equality check implementation
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function deepEqualImpl(a, b) {
  // Strict equality check
  if (a === b) return true;
  
  // Handle null/undefined
  if (a == null || b == null) return a === b;
  
  // Type check
  if (typeof a !== typeof b) return false;
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle regex
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqualImpl(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqualImpl(a[key], b[key])) return false;
    }
    return true;
  }
  
  // Primitives that didn't match in strict equality
  return false;
}

/**
 * Deep strict equality check implementation
 * Uses strict (===) equality for primitives
 * @param {any} a
 * @param {any} b
 * @returns {boolean}
 */
function deepStrictEqualImpl(a, b) {
  // Strict equality check
  if (a === b) return true;
  
  // Handle null/undefined with strict equality
  if (a == null || b == null) return a === b;
  
  // Type check - strict comparison requires same type
  if (typeof a !== typeof b) return false;
  
  // Handle dates
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  
  // Handle regex
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  
  // Handle arrays
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepStrictEqualImpl(a[i], b[i])) return false;
    }
    return true;
  }
  
  // Handle objects
  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    
    if (keysA.length !== keysB.length) return false;
    
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepStrictEqualImpl(a[key], b[key])) return false;
    }
    return true;
  }
  
  // Primitives that didn't match in strict equality
  return false;
}

// Default export for assert module mapping
export default assert;
