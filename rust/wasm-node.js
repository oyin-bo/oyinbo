// Node.js bootstrap - loads WASM with 'node' context
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const wasmPath = join(__dirname, 'daebug.wasm');

let wasm;

export async function init() {
    const bytes = await readFile(wasmPath);
    const module = await WebAssembly.instantiate(bytes, {});
    wasm = module.instance.exports;
    wasm.init_runtime(0); // 0 = node context
    return wasm;
}

export default { init };
