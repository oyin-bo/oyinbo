// Web Worker bootstrap - loads WASM with 'worker' context
(async () => {
    const response = await fetch('./rust/daebug.wasm');
    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.instantiate(bytes, {});
    const wasm = module.instance.exports;
    wasm.init_runtime(2); // 2 = worker context
    
    self.addEventListener('message', (e) => {
        // All logic handled in Rust WASM
        wasm.handle_worker_message(JSON.stringify(e.data));
    });
    
    self.postMessage({ type: 'ready' });
})();
