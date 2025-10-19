#!/usr/bin/env node
// @ts-check
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as registry from './registry.js';
import * as server from './server.js';
import * as watcher from './watcher.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const PORT = Number(process.env.PORT) || 8302;

export function run() {
  registry.init(ROOT);
  server.start(ROOT, PORT);
  watcher.watchForRestart(ROOT);
}