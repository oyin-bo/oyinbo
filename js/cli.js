// @ts-check
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import * as registry from './registry.js';
import * as server from './server.js';
import * as watcher from './watcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command-line arguments
 * @returns {{ root: string, port: number | null, help: boolean, version: boolean }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let root = process.cwd();
  let port = null;
  let help = false;
  let version = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--version' || arg === '-v') {
      version = true;
    } else if (arg === '--root' || arg === '-r') {
      if (i + 1 < args.length) {
        root = resolve(args[++i]);
      }
    } else if (arg.startsWith('--root=')) {
      root = resolve(arg.slice(7));
    } else if (arg === '--port' || arg === '-p') {
      if (i + 1 < args.length) {
        port = Number(args[++i]);
      }
    } else if (arg.startsWith('--port=')) {
      port = Number(arg.slice(7));
    }
  }

  return { root, port, help, version };
}

/**
 * Simple string hash function
 * @param {string} str
 * @returns {number}
 */
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Derive port from directory name
 * @param {string} root
 * @returns {number}
 */
function derivePort(root) {
  const dirName = basename(root);
  const hash = hashString(dirName.toLowerCase());
  return 8100 + (hash % 1000);
}

/**
 * Try to bind to a port
 * @param {number} port
 * @returns {Promise<boolean>}
 */
function tryPort(port) {
  return new Promise((resolve) => {
    const testServer = createServer();
    testServer.once('error', () => resolve(false));
    testServer.once('listening', () => {
      testServer.close();
      resolve(true);
    });
    testServer.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port
 * @param {string} root
 * @param {number} preferredPort
 * @returns {Promise<number>}
 */
async function findAvailablePort(root, preferredPort) {
  // Try preferred port first
  if (await tryPort(preferredPort)) {
    return preferredPort;
  }

  // Try fallback ports based on hash variants
  const dirName = basename(root);
  for (let i = 1; i <= 19; i++) {
    const variant = dirName + i;
    const hash = hashString(variant.toLowerCase());
    const port = 8100 + (hash % 1000);
    if (await tryPort(port)) {
      return port;
    }
  }

  throw new Error('Could not find available port. Specify --port explicitly.');
}

/**
 * Show help message
 */
function showHelp() {
  console.log(`
👾 Oyinbo - Remote REPL for debugging

Usage: oyinbo [options]

Options:
  --root, -r <path>    Root directory to serve (default: current directory)
  --port, -p <number>  Port to listen on (default: derived from directory name)
  --help, -h          Show this help message
  --version, -v       Show version number

Examples:
  oyinbo                        # Start in current directory
  oyinbo --root=/path/to/project
  oyinbo --port=9000
  oyinbo --root=/project --port=9000
`);
}

/**
 * Show version
 */
function showVersion() {
  try {
    const packagePath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(packagePath, 'utf8'));
    console.log(`v${pkg.version}`);
  } catch (e) {
    console.log('version unknown');
  }
}

export async function run() {
  const { root, port, help, version } = parseArgs();

  if (help) {
    showHelp();
    return;
  }

  if (version) {
    showVersion();
    return;
  }

  // Determine port
  let finalPort;
  if (port !== null) {
    finalPort = port;
  } else if (process.env.PORT) {
    finalPort = Number(process.env.PORT);
  } else {
    const derivedPort = derivePort(root);
    finalPort = await findAvailablePort(root, derivedPort);
  }

  console.log(`[oyinbo] serving ${root} on http://localhost:${finalPort}/`);

  registry.init(root);
  server.start(root, finalPort);
  watcher.watchForRestart(root);
}