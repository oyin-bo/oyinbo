// @ts-nocheck

import { testRunnerScript } from './test-runner.js';

/** Browser injector script */
export async function clientMainFunction() {
  console.log('[oyinbo] injected');
  
  let name = sessionStorage.getItem('oyinbo-name');
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
    sessionStorage.setItem('oyinbo-name', name);
  }
  
  // Worker management
  let worker = null;
  let workerHealthCheckInterval = null;
  let lastWorkerPong = Date.now();
  let workerRestartCount = 0;
  const MAX_RESTART_ATTEMPTS = 5;
  const WORKER_HEALTH_CHECK_INTERVAL = 10000;
  const WORKER_TIMEOUT = 20000;
  
  function createWorker() {
    if (workerRestartCount >= MAX_RESTART_ATTEMPTS) {
      console.warn('[oyinbo] max worker restart attempts reached');
      return null;
    }
    
    try {
      const workerName = name + '-webworker';
      
      // Create worker from served module (inherits import maps)
      const workerUrl = location.origin + '/oyinbo/worker-bootstrap.js';
      const w = new Worker(workerUrl, { name: workerName, type: 'module' });
      
      w.addEventListener('message', e => {
        if (e.data?.type === 'pong') lastWorkerPong = Date.now();
      });
      
      w.addEventListener('error', e => {
        console.warn('[oyinbo] worker error:', e.message);
      });
      
      console.log('[oyinbo] worker created:', workerName);
      workerRestartCount++;
      lastWorkerPong = Date.now();
      
      fetch('/oyinbo?name=' + encodeURIComponent(workerName) + '&url=worker://' + encodeURIComponent(workerName), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'worker-init', mainPage: name })
      }).catch(() => {});
      
      return w;
    } catch (err) {
      console.warn('[oyinbo] worker creation failed:', err.message);
      return null;
    }
  }
  
  function checkWorkerHealth() {
    if (!worker) return;
    const timeSinceLastPong = Date.now() - lastWorkerPong;
    
    if (timeSinceLastPong > WORKER_TIMEOUT) {
      console.warn('[oyinbo] worker unresponsive, restarting');
      const workerName = name + '-webworker';
      fetch('/oyinbo?name=' + encodeURIComponent(workerName) + '&url=worker://' + encodeURIComponent(workerName), {
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
        console.warn('[oyinbo] worker ping failed:', err.message);
      }
    }
  }
  
  worker = createWorker();
  if (worker) {
    workerHealthCheckInterval = setInterval(checkWorkerHealth, WORKER_HEALTH_CHECK_INTERVAL);
  }
  
  const endpoint = '/oyinbo?name=' + encodeURIComponent(name) + '&url=' + encodeURIComponent(location.href);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  
  window.addEventListener('error', e => errors.push(e.error?.stack || e.message || String(e)));
  window.addEventListener('unhandledrejection', e => errors.push(e.reason?.stack || String(e.reason)));
  
  // Test runner will be injected here
  
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
      console.warn('[oyinbo] fetch error:', err);
      await sleep(3000);
    }
  }
}

export const clientScript = 
  '(' + testRunnerScript + ')();\n' +
  'const testRunnerScript = ' + testRunnerScript + ';\n' +
  '(' + clientMainFunction + ')();';
