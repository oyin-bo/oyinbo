// @ts-check

/** Browser injector script */
export const clientScript = `
(async function() {
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
    name = \`\${Math.floor(Math.random() * 15) + 5}-\${words[Math.floor(Math.random() * words.length)]}-\${time[0]}\${time[1]}-\${time[2]}\`;
    sessionStorage.setItem('oyinbo-name', name);
  }
  
  const endpoint = '/oyinbo?name=' + encodeURIComponent(name) + '&url=' + encodeURIComponent(location.href);
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const errors = [];
  
  window.addEventListener('error', e => errors.push(e.error?.stack || e.message || String(e)));
  window.addEventListener('unhandledrejection', e => errors.push(e.reason?.stack || String(e.reason)));
  
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
})();
`;
