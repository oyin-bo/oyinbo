// @ts-check
import { test } from 'node:test';
import assert from 'node:assert';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const INDEX_JS = join(ROOT, 'index.js');

/**
 * Helper to spawn oyinbo process
 * @param {string[]} args 
 * @param {string} cwd
 * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
 */
function spawnOyinbo(args, cwd) {
  return new Promise((resolve) => {
    const proc = spawn('node', [INDEX_JS, ...args], { cwd, timeout: 3000 });
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    // Kill after 2 seconds
    setTimeout(() => proc.kill(), 2000);
    
    proc.on('close', (code) => {
      resolve({ stdout, stderr, exitCode: code || 0 });
    });
  });
}

test('CLI integration', async (t) => {
  const tmpDir = join(ROOT, 'tmp-test-cli-integration');
  
  // Setup
  if (existsSync(tmpDir)) {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  mkdirSync(tmpDir, { recursive: true });
  
  // Cleanup
  t.after(() => {
    if (existsSync(tmpDir)) {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });
  
  await t.test('starts server in current directory', async () => {
    const result = await spawnOyinbo([], tmpDir);
    assert(result.stdout.includes('serving'), 'Should show serving message');
    assert(result.stdout.includes('http://localhost:'), 'Should show server URL');
    assert(result.stdout.includes('debug registry'), 'Should show debug registry');
  });
  
  await t.test('accepts custom port', async () => {
    const result = await spawnOyinbo(['--port=8765'], tmpDir);
    assert(result.stdout.includes('http://localhost:8765'), 'Should use custom port');
  });
  
  await t.test('shows help message', async () => {
    const proc = spawn('node', [INDEX_JS, '--help']);
    let stdout = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    await new Promise((resolve) => proc.on('close', resolve));
    
    assert(stdout.includes('Usage:'), 'Should show usage');
    assert(stdout.includes('--root'), 'Should document --root');
    assert(stdout.includes('--port'), 'Should document --port');
  });
  
  await t.test('shows version', async () => {
    const proc = spawn('node', [INDEX_JS, '--version']);
    let stdout = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    await new Promise((resolve) => proc.on('close', resolve));
    
    assert(stdout.includes('0.0.9'), 'Should show version number');
  });
  
  await t.test('rejects non-existent root', async () => {
    const proc = spawn('node', [INDEX_JS, '--root=/nonexistent/path/xyz']);
    let stderr = '';
    
    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    const exitCode = await new Promise((resolve) => proc.on('close', resolve));
    
    assert(stderr.includes('does not exist'), 'Should show error for missing directory');
    assert.strictEqual(exitCode, 1, 'Should exit with code 1');
  });
});
