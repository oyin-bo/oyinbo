// @ts-nocheck
import { testRunnerScript } from './test-runner.js';

/** Worker bootstrap script - runs inside Web Worker context */
export async function workerMainFunction() {
  console.log('[oyinbo-worker] initialized');
  
  // Extract worker name from self.name or location search
  const params = new URLSearchParams(self.location.search);
  const name = params.get('name') || self.name || 'worker-unknown';
  
  const endpoint = __ORIGIN__ + '/oyinbo?name=' + encodeURIComponent(name) + '&url=worker://' + encodeURIComponent(name);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  
  self.addEventListener('error', e => errors.push(e.error?.stack || e.message || String(e)));
  self.addEventListener('unhandledrejection', e => errors.push(e.reason?.stack || String(e.reason)));
  
  // Respond to heartbeat pings from main thread
  self.addEventListener('message', e => {
    if (e.data?.type === 'ping') {
      self.postMessage({ type: 'pong', timestamp: Date.now() });
    }
  });
  
  while (true) {
    try {
      const res = await fetch(endpoint, { cache: 'no-cache' });
      const script = await res.text();
      if (!script) { await sleep(500); continue; }
      
      errors.length = 0;
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      let payload;
      
      try {
        let result;
        try { result = await new AsyncFunction('return (' + script + ')')(); }
        catch { result = await new AsyncFunction(script)(); }
        payload = { ok: true, value: result, errors, jobId: res.headers.get('x-job-id') };
      } catch (err) {
        payload = { ok: false, error: err?.stack || String(err), errors, jobId: res.headers.get('x-job-id') };
      }
      
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      await sleep(100);
    } catch (err) {
      console.warn('[oyinbo-worker] fetch error:', err);
      await sleep(3000);
    }
  }
}

export const workerScript = 
  '(' + testRunnerScript + ')();\n' +
  '(' + workerMainFunction + ')();';
