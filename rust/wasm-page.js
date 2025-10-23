// Browser page bootstrap - loads WASM with 'page' context
export async function init() {
    const response = await fetch('./rust/daebug.wasm');
    const bytes = await response.arrayBuffer();
    const module = await WebAssembly.instantiate(bytes, {});
    const wasm = module.instance.exports;
    wasm.init_runtime(1); // 1 = page context
    return wasm;
}

export default { init };
