// @ts-nocheck

/** Browser injector script */
export async function clientMainFunction() {
  console.log('👾injected');
  
  // Check import map support
  if (!HTMLScriptElement.supports || !HTMLScriptElement.supports('importmap')) {
    console.warn('👾𝘄𝗮𝗿𝗻𝗶𝗻𝗴 Import maps not supported in this browser');
  } else {
    const importMaps = document.querySelectorAll('script[type="importmap"]');
    console.log(`👾Found ${importMaps.length} import map(s)`);
    if (importMaps.length > 0) {
      try {
        const map = JSON.parse(importMaps[0].textContent);
        console.log('👾Import map:', map);
      } catch(e) {
        console.error('👾𝗳𝗮𝗶𝗹𝗲𝗱 to parse import map:', e);
      }
    }
  }
  
  let name = sessionStorage.getItem('daebug-name');
  if (!name) {
    const words = [
      'mint,nova,ember,zen,lumen,oak,river,kite,moss,nook,sol,vibe',
      'dune,opal,brim,echo,fern,halo,iris,loom,meadow,pulse,quill,reef',
      'sage,tide,veil,willow,flare,hearth,drift,grove,haze,ivy,knoll,lark',
      'mist,nest,pebble,quartz,rift,spire,trail,vale,whisper,yarn,zephyr,glow'
    ].join(',').split(',');
    const now = new Date();
    const time = [now.getHours(), now.getMinutes(), now.getSeconds()].map(x => String(x).padStart(2, '0'));
    name = (Math.floor(Math.random() * 15) + 5) + '-' + words[Math.floor(Math.random() * words.length)] + '-' + time[0] + time[1] + '-' + time[2];
    sessionStorage.setItem('daebug-name', name);
  }
  
  // Worker management
  let worker = null;
  let workerHealthCheckInterval = null;
  let lastWorkerPong = Date.now();
  let workerRestartCount = 0;
  const MAX_RESTART_ATTEMPTS = 5;
  const WORKER_HEALTH_CHECK_INTERVAL = 10000;
  const WORKER_TIMEOUT = 20000;
  
  // Sanitize name to match registry expectations
  const sanitizeName = n => n.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  
  function createWorker() {
    if (workerRestartCount >= MAX_RESTART_ATTEMPTS) {
      console.warn('👾𝗺𝗮𝘅 worker restart attempts reached');
      return null;
    }
    
    try {
      const workerName = sanitizeName(name + '-webworker');
      
      // Create worker from served module (inherits import maps)
      const workerUrl = location.origin + '/daebug/worker-bootstrap.js'; // TODO: serve from root path, not directory
      const w = new Worker(workerUrl, { name: workerName, type: 'module' });
      
      w.addEventListener('message', e => {
        if (e.data?.type === 'pong') lastWorkerPong = Date.now();
      });
      
      w.addEventListener('error', e => {
        console.warn('👾𝘄𝗼𝗿𝗸𝗲𝗿 𝗲𝗿𝗿𝗼𝗿 ', e.message);
      });
      
      console.log('👾worker created:', workerName);
      workerRestartCount++;
      lastWorkerPong = Date.now();
      
      fetch('/daebug?name=' + encodeURIComponent(workerName) + '&url=worker://' + encodeURIComponent(workerName), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'worker-init', mainPage: name })
      }).catch(() => {});
      
      return w;
    } catch (err) {
      console.warn('👾𝗳𝗮𝗶𝗹𝗲𝗱 to create worker ', err.message);
      return null;
    }
  }
  
  function checkWorkerHealth() {
    if (!worker) return;
    const timeSinceLastPong = Date.now() - lastWorkerPong;
    
    if (timeSinceLastPong > WORKER_TIMEOUT) {
  console.warn('👾𝘂𝗻𝗿𝗲𝘀𝗽𝗼𝗻𝘀𝗶𝘃𝗲 worker, restarting');
      const workerName = sanitizeName(name + '-webworker');
      fetch('/daebug?name=' + encodeURIComponent(workerName) + '&url=worker://' + encodeURIComponent(workerName), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'worker-timeout', duration: timeSinceLastPong })
      }).catch(() => {});
      
      worker.terminate();
      worker = createWorker();
      
      if (!worker && workerRestartCount >= MAX_RESTART_ATTEMPTS) {
        clearInterval(workerHealthCheckInterval);
        workerHealthCheckInterval = null;
      }
    } else {
      try {
        worker.postMessage({ type: 'ping' });
      } catch (err) {
        console.warn('👾𝗳𝗮𝗶𝗹𝗲𝗱 to ping worker:', err.message);
        console.warn('failed to ping worker: ' + (err && err.message ? err.message : String(err)));
      }
    }
  }
  
  worker = createWorker();
  if (worker) {
    workerHealthCheckInterval = setInterval(checkWorkerHealth, WORKER_HEALTH_CHECK_INTERVAL);
  }
  
  const endpoint = '/daebug?name=' + encodeURIComponent(name) + '&url=' + encodeURIComponent(location.href);
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
  window.addEventListener('error', e => {
    backgroundEvents.push({
      type: 'error',
      source: 'window.onerror',
      ts: formatTime(),
      message: e.message || String(e),
      stack: e.error?.stack || ''
    });
  });
  
  window.addEventListener('unhandledrejection', e => {
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
      console.warn('👾𝗳𝗲𝘁𝗰𝗵 error ', err);
      await sleep(3000);
    }
  }
}

export const clientScript = '(' + clientMainFunction + ')();';
