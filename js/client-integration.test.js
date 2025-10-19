// @ts-check
import { strict as assert } from 'node:assert';
import { test, describe } from 'node:test';

describe('clientMainFunction deep inspection', () => {
  test('includes proper AsyncFunction construction', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('Object.getPrototypeOf(async function(){}).constructor'));
  });

  test('handles both function and expression evaluation', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('return (\' + script + \')'));
    assert.ok(clientScript.includes('new AsyncFunction(script)'));
  });

  test('includes result serialization with jobId', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('jobId: res.headers.get(\'x-job-id\')'));
  });

  test('includes backgroundEvents array management', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('backgroundEvents = []'));
    assert.ok(clientScript.includes('backgroundEvents.push'));
    assert.ok(clientScript.includes('backgroundEvents.splice(jobStartIdx)'));
  });

  test('captures error stack trace', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('err?.stack || String(err)'));
  });

  test('includes sleep utility function', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('const sleep = ms => new Promise'));
    assert.ok(clientScript.includes('setTimeout(r, ms)'));
  });

  test('includes cache bypass for fetch', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('cache: \'no-cache\''));
  });

  test('handles empty script response', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('if (!script)'));
    assert.ok(clientScript.includes('await sleep(500)'));
  });

  test('includes error recovery with delay', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('await sleep(3000)'));
  });

  test('logs fetch errors', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('[oyinbo] fetch error:'));
  });
});

describe('worker management integration', () => {
  test('includes worker URL construction from location.origin', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('location.origin + \'/oyinbo/worker-bootstrap.js\''));
  });

  test('includes worker name in Worker constructor', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('name: workerName'));
  });

  test('includes worker error handler', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('w.addEventListener(\'error\''));
  });

  test('includes worker message handler for pong', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('w.addEventListener(\'message\''));
    assert.ok(clientScript.includes('e.data?.type === \'pong\''));
  });

  test('includes worker-init POST notification', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('type: \'worker-init\''));
  });

  test('includes worker-timeout POST notification', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('type: \'worker-timeout\''));
  });

  test('includes timeSinceLastPong calculation', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('timeSinceLastPong = Date.now() - lastWorkerPong'));
  });

  test('includes restart count tracking', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('workerRestartCount++'));
  });

  test('includes interval cleanup on max restarts', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('clearInterval(workerHealthCheckInterval)'));
  });

  test('includes ping message sending', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('worker.postMessage({ type: \'ping\' })'));
  });
});

describe('name generation and storage', () => {
  test('checks sessionStorage first', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('sessionStorage.getItem(\'oyinbo-name\')'));
  });

  test('generates name with random number 5-19', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('Math.floor(Math.random() * 15) + 5'));
  });

  test('generates name with current time components', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('now.getHours()'));
    assert.ok(clientScript.includes('now.getMinutes()'));
    assert.ok(clientScript.includes('now.getSeconds()'));
  });

  test('includes time padding in name', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('String(x).padStart(2, \'0\')'));
  });

  test('includes word list array with multiple words', async () => {
    const { clientScript } = await import('./client.js');
    const words = ['mint', 'nova', 'ember', 'zen', 'oak', 'willow', 'sage', 'meadow'];
    for (const word of words) {
      assert.ok(clientScript.includes(word));
    }
  });

  test('saves generated name to sessionStorage', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('sessionStorage.setItem(\'oyinbo-name\', name)'));
  });

  test('includes name sanitization logic', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('toLowerCase()'));
    assert.ok(clientScript.includes('replace(/[^a-z0-9]+/g, \'-\')'));
    assert.ok(clientScript.includes('replace(/^-|-$/g, \'\')'));
  });
});

describe('console monkeypatching details', () => {
  test('preserves original console methods', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('const originalConsole = {'));
    assert.ok(clientScript.includes('log: console.log'));
    assert.ok(clientScript.includes('info: console.info'));
    assert.ok(clientScript.includes('warn: console.warn'));
    assert.ok(clientScript.includes('error: console.error'));
  });

  test('patches all console levels', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('[\'log\', \'info\', \'warn\', \'error\'].forEach'));
  });

  test('calls original method after capture', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('originalConsole[level].apply(console, args)'));
  });

  test('maps args through serializeValue', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('args.map(arg => serializeValue(arg))'));
  });

  test('joins serialized args with space', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('.join(\' \')'));
  });
});

describe('serializeValue helper details', () => {
  test('includes depth limit check', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('if (depth > 3) return \'[Deep Object]\''));
  });

  test('handles null explicitly', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('if (val === null) return \'null\''));
  });

  test('handles undefined explicitly', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('if (val === undefined) return \'undefined\''));
  });

  test('handles functions with name fallback', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('if (typeof val === \'function\')'));
    assert.ok(clientScript.includes('val.name || \'[Function]\''));
  });

  test('handles arrays recursively', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('if (Array.isArray(val))'));
    assert.ok(clientScript.includes('val.map(v => serializeValue(v, depth + 1))'));
  });

  test('handles objects with JSON.stringify', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('JSON.stringify(val)'));
  });

  test('includes catch blocks for serialization errors', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('catch (e)'));
    assert.ok(clientScript.includes('return \'[Array]\''));
  });
});

describe('error handling integration', () => {
  test('captures window.onerror with all fields', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('window.addEventListener(\'error\''));
    assert.ok(clientScript.includes('type: \'error\''));
    assert.ok(clientScript.includes('source: \'window.onerror\''));
    assert.ok(clientScript.includes('ts: formatTime()'));
    assert.ok(clientScript.includes('e.message || String(e)'));
    assert.ok(clientScript.includes('e.error?.stack'));
  });

  test('captures unhandledrejection with reason', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('window.addEventListener(\'unhandledrejection\''));
    assert.ok(clientScript.includes('String(e.reason)'));
    assert.ok(clientScript.includes('e.reason?.stack'));
  });

  test('includes console type background events', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('type: \'console\''));
    assert.ok(clientScript.includes('level: level'));
  });
});

describe('endpoint construction', () => {
  test('includes encoded name parameter', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('encodeURIComponent(name)'));
  });

  test('includes encoded URL parameter', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('encodeURIComponent(location.href)'));
  });

  test('constructs full endpoint path', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('/oyinbo?name='));
    assert.ok(clientScript.includes('&url='));
  });

  test('uses same endpoint for GET and POST', async () => {
    const { clientScript } = await import('./client.js');
    // Should see endpoint used in both fetch calls
    const getCount = (clientScript.match(/fetch\(endpoint/g) || []).length;
    assert.ok(getCount >= 2);
  });
});

describe('import map support check', () => {
  test('checks HTMLScriptElement.supports', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('HTMLScriptElement.supports'));
  });

  test('warns if import maps not supported', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('WARNING: Import maps not supported'));
  });

  test('queries for importmap script tags', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('querySelectorAll(\'script[type="importmap"]\')'));
  });

  test('logs import map count', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('Found ${importMaps.length} import map(s)'));
  });

  test('parses and logs import map JSON', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('JSON.parse(importMaps[0].textContent)'));
  });

  test('catches import map parse errors', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('Failed to parse import map:'));
  });
});

describe('clientScript structure validation', () => {
  test('is self-executing IIFE', async () => {
    const { clientScript } = await import('./client.js');
    assert.strictEqual(clientScript[0], '(');
    assert.ok(clientScript.endsWith('();'));
  });

  test('contains async main loop', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('async function'));
    assert.ok(clientScript.includes('while (true)'));
  });

  test('exports are not leaked', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(!clientScript.includes('export '));
  });
});

describe('constants validation', () => {
  test('MAX_RESTART_ATTEMPTS is 5', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('MAX_RESTART_ATTEMPTS = 5'));
  });

  test('WORKER_HEALTH_CHECK_INTERVAL is 10000', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('WORKER_HEALTH_CHECK_INTERVAL = 10000'));
  });

  test('WORKER_TIMEOUT is 20000', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('WORKER_TIMEOUT = 20000'));
  });

  test('empty script sleep is 500ms', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('await sleep(500)'));
  });

  test('error recovery sleep is 3000ms', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('await sleep(3000)'));
  });

  test('success loop sleep is 100ms', async () => {
    const { clientScript } = await import('./client.js');
    assert.ok(clientScript.includes('await sleep(100)'));
  });
});
