// @ts-check
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import * as registry from './registry.js';
import * as server from './server.js';
import * as watcher from './watcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Simple string hash function for port derivation
 * @param {string} str - String to hash
 * @returns {number} - Hash value
 */
function simpleHash(str) {
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
 * @param {string} dirPath - Directory path
 * @param {number} variant - Variant number for collision handling (0-19)
 * @returns {number} - Port number in range 8100-9099
 */
export function derivePort(dirPath, variant = 0) {
  const dirName = basename(dirPath);
  const hashInput = (dirName + (variant > 0 ? variant : '')).toLowerCase();
  const hash = simpleHash(hashInput);
  return 8100 + (hash % 1000);
}

/**
 * Parse CLI arguments
 * @param {string[]} argv - Process arguments
 * @returns {{ root?: string, port?: number, help?: boolean, version?: boolean, error?: string }}
 */
export function parseArgs(argv) {
  const args = { };
  
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--version' || arg === '-v') {
      args.version = true;
    } else if (arg.startsWith('--root=')) {
      args.root = arg.substring('--root='.length);
    } else if (arg === '--root' && i + 1 < argv.length) {
      args.root = argv[++i];
    } else if (arg.startsWith('--port=')) {
      const portStr = arg.substring('--port='.length);
      const port = Number(portStr);
      if (isNaN(port) || port < 1 || port > 65535) {
        args.error = `Invalid port number: ${portStr}`;
      } else {
        args.port = port;
      }
    } else if (arg === '--port' && i + 1 < argv.length) {
      const portStr = argv[++i];
      const port = Number(portStr);
      if (isNaN(port) || port < 1 || port > 65535) {
        args.error = `Invalid port number: ${portStr}`;
      } else {
        args.port = port;
      }
    } else {
      args.error = `Unknown option: ${arg}`;
    }
  }
  
  return args;
}

/**
 * Show help text
 */
function showHelp() {
  console.log(`oyinbo — File-based REPL for JavaScript

Usage:
  npx oyinbo [options]

Options:
  --root <path>     Project root directory (default: current directory)
  --port <number>   HTTP server port (default: derived from project name)
  --help, -h        Show this help
  --version, -v     Show version

Examples:
  npx oyinbo
  npx oyinbo --port=9000
  npx oyinbo --root=/path/to/project

Documentation: https://github.com/oyin-bo/oyinbo`);
}

/**
 * Show version
 */
function showVersion() {
  // Read version from package.json
  const packageJsonPath = join(__dirname, '..', 'package.json');
  try {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    console.log(packageJson.version || '0.0.9');
  } catch (err) {
    console.log('0.0.9');
  }
}

/**
 * Try to start server on a port, with retry logic
 * @param {string} root - Root directory
 * @param {number} initialPort - Initial port to try
 * @returns {Promise<number>} - Port that was successfully bound
 */
async function startWithRetry(root, initialPort) {
  let lastError;
  
  // Try initial port
  try {
    await server.start(root, initialPort);
    return initialPort;
  } catch (err) {
    if (err.code !== 'EADDRINUSE') {
      throw err;
    }
    lastError = err;
  }
  
  // Try up to 19 fallback ports
  for (let variant = 1; variant <= 19; variant++) {
    const fallbackPort = derivePort(root, variant);
    console.log(`[oyinbo] port ${initialPort} in use, trying ${fallbackPort}...`);
    
    try {
      await server.start(root, fallbackPort);
      return fallbackPort;
    } catch (err) {
      if (err.code !== 'EADDRINUSE') {
        throw err;
      }
      lastError = err;
      initialPort = fallbackPort;
    }
  }
  
  throw new Error('Could not find available port. Specify --port explicitly.');
}

export async function run() {
  const args = parseArgs(process.argv);
  
  // Handle help and version
  if (args.help) {
    showHelp();
    return;
  }
  
  if (args.version) {
    showVersion();
    return;
  }
  
  // Handle parsing errors
  if (args.error) {
    console.error(`[oyinbo] error: ${args.error}`);
    console.error(`Run 'npx oyinbo --help' for usage.`);
    process.exit(1);
  }
  
  // Resolve root directory
  const root = args.root ? resolve(args.root) : process.cwd();
  
  // Validate root exists
  if (!existsSync(root)) {
    console.error(`[oyinbo] error: root directory does not exist: ${root}`);
    console.error('Use --root to specify a valid directory.');
    process.exit(1);
  }
  
  // Determine port
  const port = args.port || derivePort(root);
  
  // Initialize and start
  registry.init(root);
  
  try {
    const actualPort = args.port 
      ? (await server.start(root, args.port), args.port)
      : await startWithRetry(root, port);
    
    console.log(`[oyinbo] serving ${root}`);
    console.log(`[oyinbo] http://localhost:${actualPort}/`);
    console.log(`[oyinbo] debug registry: debug.md`);
    console.log(`[oyinbo] watching: debug/*.md`);
    
    watcher.watchForRestart(root);
  } catch (err) {
    if (err.code === 'EADDRINUSE') {
      console.error(`[oyinbo] error: could not bind to port ${port}`);
      console.error(`Try --port=<number> to specify a different port.`);
      process.exit(1);
    }
    throw err;
  }
}