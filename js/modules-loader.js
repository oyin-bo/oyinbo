// @ts-check

// Import the ES module content and export as strings
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Load test-runner module content */
export const testRunnerModule = readFileSync(join(__dirname, 'modules/test-runner.js'), 'utf8');

/** Load assert module content (re-export from test-runner) */
export const assertModule = `
// Re-export assert from test-runner
import { assert, AssertionError } from '/daebug/test-runner.js'; // TODO: use rooted path, not subdirectory
export { assert, AssertionError };
export default assert;
`;

/** Load worker bootstrap module content */
export const workerBootstrapModule = readFileSync(join(__dirname, 'modules/worker-bootstrap.js'), 'utf8');
