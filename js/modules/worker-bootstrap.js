// @ts-nocheck
/**
 * Web Worker bootstrap module
 * Served via import map: 'node:oyinbo/worker' -> '/oyinbo/worker-bootstrap.js'
 * This allows workers to inherit import maps and use top-level imports
 */

// Extract worker name from self.name (set by main thread)
const name = self.name || 'worker-unknown';

const __ORIGIN__ = location.origin;
const endpoint = __ORIGIN__ + '/oyinbo?name=' + encodeURIComponent(name) + '&url=worker://' + encodeURIComponent(name);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const backgroundEvents = [];

// Helper to format time as HH:MM:SS
const formatTime = () => {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(x => String(x).padStart(2, '0'))
    .join(':');
};

// Helper to serialize values for console output
const serializeValue = (val, depth = 0) => {
  if (depth > 3) return '[Deep Object]';
  if (val === null) return 'null';
  if (val === undefined) return 'undefined';
  if (typeof val === 'function') return val.name || '[Function]';
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (Array.isArray(val)) {
    try {
      return '[' + val.map(v => serializeValue(v, depth + 1)).join(', ') + ']';
    } catch (e) {
      return '[Array]';
    }
  }
  if (typeof val === 'object') {
    try {
      return JSON.stringify(val);
    } catch (e) {
      return String(val);
    }
  }
  return String(val);
};

// Capture global errors
self.addEventListener('error', e => {
  backgroundEvents.push({
    type: 'error',
    source: 'self.onerror',
    ts: formatTime(),
    message: e.message || String(e),
    stack: e.error?.stack || ''
  });
});

self.addEventListener('unhandledrejection', e => {
  backgroundEvents.push({
    type: 'error',
    source: 'unhandledrejection',
    ts: formatTime(),
    message: String(e.reason),
    stack: e.reason?.stack || ''
  });
});

// Monkeypatch console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error
};

['log', 'info', 'warn', 'error'].forEach(level => {
  console[level] = function(...args) {
    // Capture to background events
    const message = args.map(arg => serializeValue(arg)).join(' ');
    backgroundEvents.push({
      type: 'console',
      level: level,
      ts: formatTime(),
      message: message
    });
    // Call original console method
    originalConsole[level].apply(console, args);
  };
});

// Respond to heartbeat pings from main thread
self.addEventListener('message', e => {
  if (e.data?.type === 'ping') {
    self.postMessage({ type: 'pong', timestamp: Date.now() });
  }
});

console.log('[oyinbo-worker] initialized');

// Main polling loop
(async () => {
  while (true) {
    try {
      const res = await fetch(endpoint, { cache: 'no-cache' });
      const script = await res.text();
      if (!script) { await sleep(500); continue; }
      
      // Mark start of job execution for background event association
      const jobStartIdx = backgroundEvents.length;
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      let payload;
      
      try {
        let result;
        try { 
          result = await new AsyncFunction('return (' + script + ')')(); 
        } catch { 
          result = await new AsyncFunction(script)();
        }
        
        // Capture background events that occurred during execution
        const jobEvents = backgroundEvents.splice(jobStartIdx);
        payload = { ok: true, value: result, backgroundEvents: jobEvents, jobId: res.headers.get('x-job-id') };
      } catch (err) {
        // Capture background events even on error
        const jobEvents = backgroundEvents.splice(jobStartIdx);
        payload = { ok: false, error: err?.stack || String(err), backgroundEvents: jobEvents, jobId: res.headers.get('x-job-id') };
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
})();
