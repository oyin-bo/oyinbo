// @ts-check
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, resolve } from 'node:path';
import { readFileSync } from 'node:fs';
import * as registry from './registry.js';
import * as server from './server.js';
import * as watcher from './watcher.js';
import pkg from '../package.json' with { type: 'json' };

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Parse command-line arguments
 * @returns {{ root: string, port: number | null, help: boolean, version: boolean }}
 */
function parseArgs() {
  const args = process.argv.slice(2);
  let root = null;
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
  
  // If no root specified, use cwd
  if (root === null) {
    root = process.cwd();
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
 * Show help message
 */
function showHelp() {
  console.log(`
👾 Deabug - Remote REPL for debugging

Usage: daebug [options]

Options:
  --root, -r <path>    Root directory to serve (default: current directory)
  --port, -p <number>  Port to listen on (default: derived from directory name)
  --help, -h          Show this help message
  --version, -v       Show version number

Examples:
  daebug                        # Start in current directory
  daebug --root=/path/to/project
  daebug --port=9000
  daebug --root=/project --port=9000
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

  const finalPort = port !== null ? port : 
                     process.env.PORT ? Number(process.env.PORT) : 
                     derivePort(root);
  
  const bannerPrefix = `👾Daebug v${pkg.version} serving  ${root}  👉  `;
  const dirName = basename(root);

  registry.init(root);
  await server.start(root, finalPort, dirName, bannerPrefix);
  watcher.watchForRestart(root);
}