// @ts-check
/**
 * Test runner script exports for testing
 * The actual test runner code is in js/modules/test-runner.js
 * This file exists to satisfy tests that import from './test-runner.js'
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Load test-runner module content for testing */
export const testRunnerScript = readFileSync(join(__dirname, 'modules/test-runner.js'), 'utf8');

// The inline function below is DEPRECATED and should NOT be used
/** @deprecated Use import from 'node:test' instead */
export function testRunnerScriptDeprecated() {
  // Test registry
  const tests = [];
  const suites = [];
  let currentSuite = null;
  
  // Assertion library compatible with Node.js assert
  const assert = {
    ok: (value, message) => {
      if (!value) throw new AssertionError(message || 'Expected truthy value', value, true);
    },
    equal: (actual, expected, message) => {
      if (actual != expected) throw new AssertionError(message || 'Values not equal', actual, expected);
    },
    strictEqual: (actual, expected, message) => {
      if (actual !== expected) throw new AssertionError(message || 'Values not strictly equal', actual, expected);
    },
    notEqual: (actual, expected, message) => {
      if (actual == expected) throw new AssertionError(message || 'Values should not be equal', actual, expected);
    },
    notStrictEqual: (actual, expected, message) => {
      if (actual === expected) throw new AssertionError(message || 'Values should not be strictly equal', actual, expected);
    },
    deepEqual: (actual, expected, message) => {
      if (JSON.stringify(actual) !== JSON.stringify(expected)) {
        throw new AssertionError(message || 'Objects not deeply equal', actual, expected);
      }
    },
    throws: (fn, error, message) => {
      let threw = false;
      try { fn(); } catch (e) { threw = true; }
      if (!threw) throw new AssertionError(message || 'Function did not throw', null, 'error');
    },
    rejects: async (fn, error, message) => {
      let rejected = false;
      try { await fn(); } catch (e) { rejected = true; }
      if (!rejected) throw new AssertionError(message || 'Promise did not reject', null, 'rejection');
    },
    fail: (message) => {
      throw new AssertionError(message || 'Explicit fail');
    }
  };
  
  class AssertionError extends Error {
    constructor(message, actual, expected) {
      super(message);
      this.name = 'AssertionError';
      this.actual = actual;
      this.expected = expected;
    }
  }
  
  // Test registration functions
  function test(nameOrOptions, optionsOrFn, maybeFn) {
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
    
    tests.push({
      name,
      fn,
      suite: currentSuite,
      skip: options.skip,
      only: options.only,
      timeout: options.timeout || 30000
    });
  }
  
  function describe(name, fn) {
    const prevSuite = currentSuite;
    currentSuite = name;
    suites.push({ name, parent: prevSuite });
    try { fn(); }
    finally { currentSuite = prevSuite; }
  }
  
  const it = test;
  
  // Test execution engine
  async function oyinboRunTests(options = {}) {
    const { files = [], timeout = 60000, clear = true } = options;
    
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
      // Import test files (if any) - they will register tests via window.test/describe
      for (const file of files) {
        try {
          await import(file);
        } catch (err) {
          results.tests.push({
            name: 'Import: ' + file,
            passed: false,
            error: err?.stack || String(err),
            duration: 0
          });
          results.failed++;
          results.total++;
        }
      }
      
      // Execute registered tests
      for (const testCase of tests) {
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
            setTimeout(() => reject(new Error('Test timeout after ' + testCase.timeout + 'ms')), testCase.timeout)
          );
          
          await Promise.race([
            testCase.fn(),
            timeoutPromise
          ]);
          
          testResult.passed = true;
          results.passed++;
        } catch (err) {
          testResult.error = err?.stack || String(err);
          results.failed++;
        }
        
        testResult.duration = Date.now() - testStart;
        results.tests.push(testResult);
      }
      
    } catch (err) {
      results.tests.push({
        name: 'Test Runner Error',
        passed: false,
        error: err?.stack || String(err),
        duration: 0
      });
      results.failed++;
      results.total++;
    }
    
    results.duration = Date.now() - startTime;
    
    // Clear tests after execution if requested
    if (clear) {
      tests.length = 0;
      suites.length = 0;
      currentSuite = null;
    }
    
    return results;
  }
  
  // Inject into global scope
  globalThis.test = test;
  globalThis.describe = describe;
  globalThis.it = it;
  globalThis.assert = assert;
  globalThis.oyinboRunTests = oyinboRunTests;
  globalThis.AssertionError = AssertionError;
}
