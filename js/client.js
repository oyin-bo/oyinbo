// @ts-check

/** Browser injector script */
export const clientScript = `
(async function() {
  console.log('[oyinbo] injected');
  
  let name = sessionStorage.getItem('oyinbo-name');
    if (!name) {
      const words = 'mint,nova,ember,zen,lumen,oak,river,kite,moss,nook,sol,vibe'.split(',');
      const n = Math.floor(Math.random() * 15) + 5;
      const w = words[Math.floor(Math.random() * words.length)];
      // Form time suffix HHMM-ss using page load time
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const timeSuffix = \`\${hh}\${mm}-\${ss}\`;
      name = \`\${n}-\${w}-\${timeSuffix}\`;
      sessionStorage.setItem('oyinbo-name', name);
  }
  
  const endpoint = '/oyinbo?name=' + encodeURIComponent(name) + '&url=' + encodeURIComponent(location.href);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  
  const errors = [];
  window.addEventListener('error', e => {
    errors.push((e.error?.stack || e.message || String(e)));
  });
  window.addEventListener('unhandledrejection', e => {
    errors.push((e.reason?.stack || String(e.reason)));
  });
  
  while (true) {
    try {
      const res = await fetch(endpoint, { cache: 'no-cache' });
      const script = await res.text();
      const jobId = res.headers.get('x-job-id');
      
      if (!script) {
        await sleep(500);
        continue;
      }
      
      errors.length = 0;
      
      // Execute code and prepare result
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
      let payload;
      
      try {
        // Try as expression first, fallback to statement
        let result;
        try {
          result = await new AsyncFunction('return (' + script + ')')();
        } catch {
          result = await new AsyncFunction(script)();
        }
        payload = { ok: true, value: result, errors, jobId };
      } catch (err) {
        payload = { ok: false, error: err?.stack || String(err), errors, jobId };
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
})();
`;
