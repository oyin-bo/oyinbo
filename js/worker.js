// @ts-check
/**
 * Worker script exports for testing
 * The actual worker code is in js/modules/worker-bootstrap.js
 * This file exists to satisfy tests that import from './worker.js'
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Load worker bootstrap content for testing */
export const workerScript = readFileSync(join(__dirname, 'modules/worker-bootstrap.js'), 'utf8');
