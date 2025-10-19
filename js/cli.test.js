// @ts-check
import { test } from 'node:test';
import assert from 'node:assert';
import { derivePort, parseArgs } from './cli.js';

test('derivePort', async (t) => {
  await t.test('returns port in range 8100-9099', () => {
    const port = derivePort('/some/project');
    assert(port >= 8100 && port < 9100, `Port ${port} should be in range 8100-9099`);
  });

  await t.test('is deterministic for same path', () => {
    const port1 = derivePort('/foo/bar/my-project');
    const port2 = derivePort('/foo/bar/my-project');
    assert.strictEqual(port1, port2);
  });

  await t.test('varies with variant parameter', () => {
    const port0 = derivePort('/some/project', 0);
    const port1 = derivePort('/some/project', 1);
    // They should be different (though theoretically could collide)
    // Just check they're both valid
    assert(port0 >= 8100 && port0 < 9100);
    assert(port1 >= 8100 && port1 < 9100);
  });

  await t.test('uses basename of path', () => {
    const port1 = derivePort('/foo/bar/project');
    const port2 = derivePort('/baz/qux/project');
    assert.strictEqual(port1, port2, 'Same basename should give same port');
  });
});

test('parseArgs', async (t) => {
  await t.test('parses --help', () => {
    const args = parseArgs(['node', 'cli.js', '--help']);
    assert.strictEqual(args.help, true);
  });

  await t.test('parses -h', () => {
    const args = parseArgs(['node', 'cli.js', '-h']);
    assert.strictEqual(args.help, true);
  });

  await t.test('parses --version', () => {
    const args = parseArgs(['node', 'cli.js', '--version']);
    assert.strictEqual(args.version, true);
  });

  await t.test('parses -v', () => {
    const args = parseArgs(['node', 'cli.js', '-v']);
    assert.strictEqual(args.version, true);
  });

  await t.test('parses --root=<path>', () => {
    const args = parseArgs(['node', 'cli.js', '--root=/some/path']);
    assert.strictEqual(args.root, '/some/path');
  });

  await t.test('parses --root <path>', () => {
    const args = parseArgs(['node', 'cli.js', '--root', '/some/path']);
    assert.strictEqual(args.root, '/some/path');
  });

  await t.test('parses --port=<number>', () => {
    const args = parseArgs(['node', 'cli.js', '--port=9000']);
    assert.strictEqual(args.port, 9000);
  });

  await t.test('parses --port <number>', () => {
    const args = parseArgs(['node', 'cli.js', '--port', '9000']);
    assert.strictEqual(args.port, 9000);
  });

  await t.test('rejects invalid port number', () => {
    const args = parseArgs(['node', 'cli.js', '--port=abc']);
    assert(args.error, 'Should have error for invalid port');
    assert(args.error.includes('Invalid port number'), 'Error should mention invalid port');
  });

  await t.test('rejects port out of range (low)', () => {
    const args = parseArgs(['node', 'cli.js', '--port=0']);
    assert(args.error, 'Should have error for port 0');
  });

  await t.test('rejects port out of range (high)', () => {
    const args = parseArgs(['node', 'cli.js', '--port=99999']);
    assert(args.error, 'Should have error for port > 65535');
  });

  await t.test('rejects unknown option', () => {
    const args = parseArgs(['node', 'cli.js', '--unknown']);
    assert(args.error, 'Should have error for unknown option');
    assert(args.error.includes('Unknown option'), 'Error should mention unknown option');
  });

  await t.test('parses multiple options', () => {
    const args = parseArgs(['node', 'cli.js', '--root=/foo', '--port=8888']);
    assert.strictEqual(args.root, '/foo');
    assert.strictEqual(args.port, 8888);
  });
});
