// @ts-check
/**
 * Test runner script exports for testing
 * The actual test runner code is in js/modules/test-runner.js
 * This file exists to satisfy tests that import from './test-runner.js'
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Load test-runner module content for testing */
export const testRunnerScript = readFileSync(join(__dirname, 'modules/test-runner.js'), 'utf8');
