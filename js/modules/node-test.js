// @ts-check

function nodeTestBody() {

  /**
 * Test runner as ES module for use via import maps
 * Usage: import { test, describe } from 'node:test'
 * (mapped to /-daebug-node:test.js via import maps)
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
  function test(nameOrOptions, optionsOrFn, maybeFn) {
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
  function describe(name, fn) {
    const prevSuite = registry.currentSuite;
    registry.currentSuite = name;
    try {
      fn();
    } finally {
      registry.currentSuite = prevSuite;
    }
  }

  /**
  /** @typedef {{
   *  name: string,
   *  suite?: string,
   *  passed?: boolean,
   *  skipped?: boolean,
   *  error?: string | any,
   *  duration: number,
   *  completedAt: string
   * }} TestState
   */

  /**
   * Run registered tests
   * @param {{
  *  files?: string[],
  *  timeout?: number,
  *  streamProgress: (progress: {
  *    complete: boolean,
  *    reportedAt?: string,
  *    recentTests?: TestState[],
  *    allTests?: TestState[],
  *    totals: { pass: number, fail: number, skip: number, total: number },
  *    duration: number
  *  }) => void | Promise<any>
   * }} options
   */
  async function __daebugRunTests(options) {
    const files = options.files || [];
    // console.log(`   𒀸  __daebugRunTests called with files:`, files);
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
          // Resolve file path for import
          // Ensure leading slash for absolute path imports
          let resolvedFile = file.startsWith('/') ? file : '/' + file;
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
            completedAt: new Date().toISOString()
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
          const nowIso = new Date().toISOString();
          results.tests.push({
            name: testCase.name,
            suite: testCase.suite,
            skipped: true,
            duration: 0,
            completedAt: nowIso
          });
          continue;
        }

        if (testCase.skip) {
          results.skipped++;
          const nowIso = new Date().toISOString();
          results.tests.push({
            name: testCase.name,
            suite: testCase.suite,
            skipped: true,
            duration: 0,
            completedAt: nowIso
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
  const completedIso = new Date().toISOString();
  testResult.completedAt = completedIso;
        results.tests.push(testResult);

        // Ensure recentTests use the expected shape (status: 'pass'|'fail'|'skip')
          const recentTests = [{
          name: testResult.name,
          suite: testResult.suite,
          status: testResult.skipped ? 'skip' : (testResult.passed ? 'pass' : 'fail'),
          duration: testResult.duration,
          error: testResult.error,
          completedAt: testResult.completedAt
        }];

        streamProgress({
          complete: false,
          reportedAt: new Date().toISOString(),
          recentTests,
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
        completedAt: new Date().toISOString()
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
   * Node shim script - injected into iframe before test imports
   * Provides Node.js-compatible globals (global, process, setImmediate, Buffer)
   */
  const NODE_SHIM_SCRIPT = `
(function() {
  // Provide global binding for legacy code
  window.global = window;
  
  // Minimal process object with nextTick
  window.process = {
    env: {},
    argv: [],
    nextTick: function(callback) {
      Promise.resolve().then(callback);
    }
  };
  
  // setImmediate support
  let immediateId = 0;
  const immediateMap = new Map();
  
  window.setImmediate = function(callback) {
    const id = ++immediateId;
    const timeoutId = setTimeout(() => {
      immediateMap.delete(id);
      callback();
    }, 0);
    immediateMap.set(id, timeoutId);
    return id;
  };
  
  window.clearImmediate = function(id) {
    if (immediateMap.has(id)) {
      clearTimeout(immediateMap.get(id));
      immediateMap.delete(id);
    }
  };
  
  // Lightweight Buffer stub - prevents ReferenceError without heavy binary support
  window.Buffer = {
    isBuffer: () => false
  };
})();
`;

  /**
   * Extract import maps from parent document and return as script elements
   * @param {Document} parentDoc
   * @returns {HTMLScriptElement[]}
   */
  function extractImportMaps(parentDoc) {
    const maps = [];
    const scripts = parentDoc.querySelectorAll('script[type="importmap"], script[type="importmap-shim"]');

    for (const script of scripts) {
      const clone = parentDoc.createElement('script');
      /** @type {any} */
      const scriptEl = script;
      clone.type = scriptEl.type;

      if (scriptEl.src) {
        // Handle src-based import map
        clone.src = scriptEl.src;
      } else {
        // Handle inline import map
        try {
          const mapData = JSON.parse(scriptEl.textContent || '{}');
          clone.textContent = JSON.stringify(mapData);
        } catch (e) {
          console.warn('Failed to parse import map:', e);
        }
      }

      maps.push(clone);
    }

    return maps;
  }

  /**
   * Create and prepare iframe for test execution
   * @param {object} options
   * @returns {Promise<{iframe: HTMLIFrameElement, bridge: any}>}
   */
  async function createTestIframe(options) {
    const origin = typeof location !== 'undefined' ? location.origin : '';
    const iframeUrlBase = origin ? `${origin}/-daebug-iframe.html` : '/-daebug-iframe.html';

    // Create iframe with cache-busting timestamp
    const iframe = document.createElement('iframe');
    iframe.src = `${iframeUrlBase}?ts=${Date.now()}`;
    iframe.style.pointerEvents = 'none';
    iframe.style.opacity = '0.00001';
    iframe.style.position = 'absolute';
    iframe.style.width = '1px';
    iframe.style.height = '1px';

    // Wait for iframe to load
    return new Promise((resolve, reject) => {
      iframe.onload = async () => {
        try {
          /** @type {any} */
          const iframeWindow = iframe.contentWindow;
          const iframeDoc = iframe.contentDocument || (iframeWindow && iframeWindow.document);

          if (!iframeDoc || !iframeWindow) {
            throw new Error('Failed to access iframe document or window');
          }

          // Record diagnostic info for error reporting
          iframeWindow.__daebug_lastIframeInfo = {
            baseURI: iframeDoc.baseURI,
            readyState: iframeDoc.readyState,
            timestamp: Date.now()
          };

          // Inject Node.js shim before any imports
          const shimScript = iframeDoc.createElement('script');
          shimScript.textContent = NODE_SHIM_SCRIPT;
          iframeDoc.head.appendChild(shimScript);

          // Replicate parent import maps
          const importMaps = extractImportMaps(document);
          for (const map of importMaps) {
            iframeDoc.head.appendChild(iframeDoc.adoptNode(map.cloneNode(true)));
          }

          // Create bridge object for parent-iframe communication
          /** @type {any} */
          const bridge = {
            getConfig: () => {
            /** @type {any} */ const opts = options;
              return { files: opts.files || [], ...options };
            },
            streamProgress: null, // Set by parent
            resolve: null,        // Set by parent
            reject: null,         // Set by parent
            notifyError: null     // Set by parent
          };

          iframeWindow.__daebugBridge = bridge;

          // Inject module bootstrap script
          const bootstrapScript = iframeDoc.createElement('script');
          bootstrapScript.type = 'module';

          async function bootstrapScriptBody() {
            const bridge = /** @type {*} */ (window).__daebugBridge;
            try {
              const config = bridge.getConfig();

              window.addEventListener('error', (event) => {
                if (bridge.notifyError) {
                  bridge.notifyError({
                    type: 'error',
                    message: event.message,
                    filename: event.filename,
                    lineno: event.lineno
                  });
                }
              });

              window.addEventListener('unhandledrejection', (event) => {
                if (bridge.notifyError) {
                  bridge.notifyError({
                    type: 'unhandledrejection',
                    reason: event.reason
                  });
                }
              });

              const results = await __daebugRunTests({
                files: config.files,
                streamProgress: bridge.streamProgress
              });

              // Send final test summary (not awaited)
              bridge.streamProgress({
                complete: true,
                reportedAt: new Date().toISOString(),
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
                  completedAt: t.completedAt
                }))
              });

              bridge.resolve(results);
            } catch (err) {
              if (bridge && bridge.reject) {
                bridge.reject({
                  message: /** @type {*} */(err).message,
                  stack: /** @type {*} */(err).stack,
                  name: /** @type {*} */(err).name
                });
              }
            }
          }

          bootstrapScript.textContent = `
import { __daebugRunTests } from '/-daebug-node:test.js';
${bootstrapScriptBody}

bootstrapScriptBody();
`;
          iframeDoc.body.appendChild(bootstrapScript);

          resolve({ iframe, bridge });
        } catch (err) {
          reject(err);
        }
      };

      iframe.onerror = () => {
        reject(new Error('Failed to load iframe'));
      };

      // Append iframe to DOM to trigger load
      document.body.appendChild(iframe);
    });
  }

  /**
   * Destroy iframe and clean up resources
   * @param {HTMLIFrameElement} iframe
   */
  function destroyTestIframe(iframe) {
    if (iframe && iframe.parentNode) {
      iframe.parentNode.removeChild(iframe);
    }
  }

  /**
   * Normalize errors from iframe bridge into proper Error objects
   * @param {any} payload
   * @returns {Error}
   */
  function normalizeIframeError(payload) {
    if (!payload) {
      return new Error('Unknown iframe error');
    }

    const err = new Error(payload.message || 'Test execution failed in iframe');
    err.name = payload.name || 'Error';
    if (payload.stack) {
      err.stack = payload.stack;
    }
    return err;
  }

  /**
   * Run tests in page realm (browser) using iframe sandbox
   * @param {object} options
   * @returns {Promise<object>}
   */
  async function runTestsInPageRealm(options) {
    const MIN_IFRAME_WATCHDOG_MS = 15000;
    const DEFAULT_WATCHDOG_MS = 120000;
    /** @type {any} */
    const opts = options;
    const watchdogMs = Math.max(
      MIN_IFRAME_WATCHDOG_MS,
      Math.min(opts.timeout || DEFAULT_WATCHDOG_MS, DEFAULT_WATCHDOG_MS)
    );

    /** @type {any} */
    let iframe = null;
    /** @type {any} */
    let watchdogTimer = null;
    /** @type {any} */
    let resolvePromise = null;
    /** @type {any} */
    let rejectPromise = null;
    const executionPromise = new Promise((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });

    const finalize = () => {
      if (watchdogTimer) {
        clearTimeout(watchdogTimer);
        watchdogTimer = null;
      }
      if (iframe && iframe.contentWindow) {
        delete iframe.contentWindow.__daebugBridge;
      }
      if (iframe) {
        destroyTestIframe(iframe);
        iframe = null;
      }
    };

    try {
      // Create iframe and set up bridge
      const { iframe: newIframe, bridge } = await createTestIframe(options);
      iframe = newIframe;

      // Set up bridge methods
      /** @type {any} */
      const bridgeImpl = bridge;
      bridgeImpl.streamProgress = opts.streamProgress || (async () => { });
      bridgeImpl.resolve = (/** @type {any} */ results) => {
        finalize();
        resolvePromise(results);
      };
      bridgeImpl.reject = (/** @type {any} */ error) => {
        finalize();
        rejectPromise(normalizeIframeError(error));
      };
      bridgeImpl.notifyError = (/** @type {any} */ payload) => {
        console.error('   𒀸  iframe error:', payload);
      };

      // Set watchdog timer
      watchdogTimer = setTimeout(() => {
        const err = new Error(`Test execution timeout after ${watchdogMs}ms in iframe`);
        err.name = 'TimeoutError';
        finalize();
        rejectPromise(err);
      }, watchdogMs);

      // Wait for execution to complete
      const results = await executionPromise;
      return results;
    } catch (err) {
      finalize();
      let msg = 'Failed to execute tests in iframe';
      if (err && typeof err === 'object' && 'message' in err) {
        msg = String(((/** @type {any} */ (err)).message)) || msg;
      }
      /** @type {any} */
      const error = new Error(msg);
      error.daebugError = true;
      throw error;
    }
  }

  /**
   * Node.js-compatible run() function with test discovery and streaming
   * @param {object} options
   * @returns {Promise<object>}
   */
  async function run(options = {}) {
    /** @type {any} */
    const opt = options || {};
    const files = opt.files || ['**/*.test.js'];
    const realmId = getRealmId();

    // Check if we're in browser MAIN THREAD (not a worker) - if so, use iframe sandbox
    // In workers, self !== window. In main page, self === window
    const isMainBrowserPage = typeof window !== 'undefined' && typeof document !== 'undefined' && typeof self !== 'undefined' && self === window;

    // Always loop to server for discovery BEFORE the realm fork.
    // This ensures both page/iframe and worker branches receive concrete file lists.
    let testFiles = [];
    try {
      const fileList = Array.isArray(files) ? files : [files];
      const resp = await fetch('/-daebug-discover-tests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: fileList })
      });
      if (resp.ok) {
        const data = await resp.json();
        testFiles = Array.isArray(data.files) ? data.files : [];
      } else {
        console.warn('   𒀸  discovery failed:', resp.status);
        // Fallback: use explicit files (non-pattern inputs) if provided
        testFiles = fileList.filter(f => typeof f === 'string' && !f.includes('*'));
      }
    } catch (err) {
      console.error('   𒀸  discovery error:', err);
      testFiles = (Array.isArray(files) ? files : [files]).filter(f => typeof f === 'string' && !f.includes('*'));
    }

    if (isMainBrowserPage) {
      // We're in a browser main page, use iframe sandbox
      const progressDebounceMs = 2000;
      /** @type {TestState[]} */
      let bufferedTests = [];
      let lastProgressTime = Date.now();

      /**
       * @type {Parameters<typeof __daebugRunTests>[0]['streamProgress']} 
       */
      const streamProgress = async (progressData) => {
        const now = Date.now();
        const timeSinceLastProgress = now - lastProgressTime;

        // Always send complete results immediately
        if (progressData.complete) {
          lastProgressTime = now;
          try {
            await fetch('/-daebug-test-progress', {
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
          return;
        }

        // Buffer recent tests
        if (progressData.recentTests) {
          bufferedTests.push(...progressData.recentTests);
        }

        // Send if debounce period elapsed
        if (timeSinceLastProgress >= progressDebounceMs) {
          lastProgressTime = now;
          if (bufferedTests.length > 0) {
            try {
              await fetch('/-daebug-test-progress', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  realmName: realmId,
                  recentTests: bufferedTests,
                  totals: progressData.totals,
                  duration: progressData.duration,
                  complete: false
                })
              });
              bufferedTests = [];
            } catch (err) {
              console.error('   𒀸  failed to stream progress:', err);
            }
          }
        }
      };

      return runTestsInPageRealm({ ...opt, files: testFiles, streamProgress });
    }
    // Fallback to traditional worker-based execution (we already discovered files above)
    try {
      if (!Array.isArray(testFiles)) testFiles = [];

      if (testFiles.length === 0) {
        console.warn('   𒀸  no test files found');
        return { passed: 0, failed: 0, skipped: 0, total: 0, duration: 0, tests: [] };
      }

      // Create streaming handler with buffering
      let lastProgressTime = Date.now();
      const progressDebounceMs = 2000;
      /** @type {TestState[]} */
      let bufferedTests = [];

      /**
       * @type {Parameters<typeof __daebugRunTests>[0]['streamProgress']} 
       */
      const streamProgress = async (progressData) => {
        const now = Date.now();
        const timeSinceLastProgress = now - lastProgressTime;

        // Always send complete results immediately
        if (progressData.complete) {
          lastProgressTime = now;
          try {
            await fetch('/-daebug-test-progress', { // TODO: covert to root-relative, avoid nested directories
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
          return;
        }

        // Buffer recent tests
        if (progressData.recentTests) {
          bufferedTests.push(...progressData.recentTests);
        }

        // Send if debounce period elapsed
        if (timeSinceLastProgress >= progressDebounceMs) {
          lastProgressTime = now;
          if (bufferedTests.length > 0) {
            try {
              await fetch('/-daebug-test-progress', { // TODO: covert to root-relative, avoid nested directories
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  realmName: realmId,
                  recentTests: bufferedTests,
                  totals: progressData.totals,
                  duration: progressData.duration,
                  complete: false
                })
              });
              bufferedTests = [];
            } catch (err) {
              console.error('   𒀸  failed to stream progress:', err);
            }
          }
        }
      };

      // Run tests with __daebugRunTests and pass streaming handler
      const results = await __daebugRunTests({ ...options, files: testFiles, streamProgress });

      // Stream final results - include ALL tests, not just recent
      streamProgress({
        complete: true,
        reportedAt: new Date().toISOString(),
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
          completedAt: t.completedAt
        }))
      });

      return results;
    } catch (err) {
      console.error('   𒀸  run() failed:', err);
      throw err;
    }
  }

  return {
    test,
    describe,
    it: test,
    __daebugRunTests,
    run
  };

}

const exports = nodeTestBody();

export const test = exports.test;
export const describe = exports.describe;
export const it = exports.it;
export const __daebugRunTests = exports.__daebugRunTests;
export const run = exports.run;
export default exports;

export const nodeTestContent = `
// @ts-check

${nodeTestBody}

const exports = nodeTestBody();

export const test = exports.test;
export const describe = exports.describe;
export const it = exports.it;
export const __daebugRunTests = exports.__daebugRunTests;
export const run = exports.run;
export default exports;

`.trim();
