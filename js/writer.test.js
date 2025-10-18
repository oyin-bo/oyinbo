// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clockFmt, durationFmt, findFooter, findLastFencedBlock, findAgentHeaderAbove, buildBlocks } from './writer.js';

// clockFmt tests
test('clockFmt pads single digit hours', () => {
  const ms = new Date('2025-01-01T03:45:12').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '03:45:12');
});

test('clockFmt pads single digit minutes', () => {
  const ms = new Date('2025-01-01T10:04:56').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '10:04:56');
});

test('clockFmt pads single digit seconds', () => {
  const ms = new Date('2025-01-01T15:30:05').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '15:30:05');
});

test('clockFmt handles double digit values', () => {
  const ms = new Date('2025-01-01T23:59:58').getTime();
  const result = clockFmt(ms);
  assert.strictEqual(result, '23:59:58');
});

// durationFmt tests
test('durationFmt returns ms for values under 2000', () => {
  assert.strictEqual(durationFmt(500), '500ms');
});

test('durationFmt returns ms for 1999', () => {
  assert.strictEqual(durationFmt(1999), '1999ms');
});

test('durationFmt returns seconds for 2000', () => {
  assert.strictEqual(durationFmt(2000), '2.0s');
});

test('durationFmt returns seconds for values 2000 and above', () => {
  assert.strictEqual(durationFmt(2500), '2.5s');
});

test('durationFmt formats seconds with one decimal', () => {
  assert.strictEqual(durationFmt(3750), '3.8s');
});

test('durationFmt returns ms for 0', () => {
  assert.strictEqual(durationFmt(0), '0ms');
});

// findFooter tests
test('findFooter returns index of footer line', () => {
  const lines = ['line1', 'line2', '> Write code in a fenced JS block below', 'line4'];
  const result = findFooter(lines);
  assert.strictEqual(result, 2);
});

test('findFooter returns -1 when footer not found', () => {
  const lines = ['line1', 'line2'];
  const result = findFooter(lines);
  assert.strictEqual(result, -1);
});

test('findFooter finds footer from bottom', () => {
  const lines = [
    '> Write code in a fenced JS block below',
    'middle',
    '> Write code in a fenced JS block below'
  ];
  const result = findFooter(lines);
  assert.strictEqual(result, 2);
});

test('findFooter returns -1 for empty array', () => {
  const lines = /** @type {string[]} */ ([]);
  const result = findFooter(lines);
  assert.strictEqual(result, -1);
});

test('findFooter handles partial match', () => {
  const lines = ['> Write code in', 'other'];
  const result = findFooter(lines);
  assert.strictEqual(result, -1);
});

// findLastFencedBlock tests
test('findLastFencedBlock finds simple JS fence', () => {
  const lines = ['```js', 'code', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

test('findLastFencedBlock finds javascript fence', () => {
  const lines = ['```javascript', 'code', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

test('findLastFencedBlock finds fence without language tag', () => {
  const lines = ['```', 'code', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

test('findLastFencedBlock returns last fence when multiple exist', () => {
  const lines = ['```js', 'first', '```', 'text', '```js', 'second', '```'];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 4, end: 6 });
});

test('findLastFencedBlock returns null when no fence found', () => {
  const lines = ['just', 'text'];
  const result = findLastFencedBlock(lines);
  assert.strictEqual(result, null);
});

test('findLastFencedBlock returns null when only opening fence', () => {
  const lines = ['```js', 'code'];
  const result = findLastFencedBlock(lines);
  assert.strictEqual(result, null);
});

test('findLastFencedBlock returns null when only closing fence', () => {
  const lines = ['code', '```'];
  const result = findLastFencedBlock(lines);
  assert.strictEqual(result, null);
});

test('findLastFencedBlock handles trimmed fence markers', () => {
  const lines = ['  ```js  ', 'code', '  ```  '];
  const result = findLastFencedBlock(lines);
  assert.deepStrictEqual(result, { start: 0, end: 2 });
});

// findAgentHeaderAbove tests
test('findAgentHeaderAbove finds header directly above', () => {
  const lines = ['> **agent** to page', 'next'];
  const result = findAgentHeaderAbove(lines, 1);
  assert.strictEqual(result, 0);
});

test('findAgentHeaderAbove skips blank lines', () => {
  const lines = ['> **agent** to page', '', '', 'target'];
  const result = findAgentHeaderAbove(lines, 3);
  assert.strictEqual(result, 0);
});

test('findAgentHeaderAbove returns -1 when no header found', () => {
  const lines = ['just text', 'target'];
  const result = findAgentHeaderAbove(lines, 1);
  assert.strictEqual(result, -1);
});

test('findAgentHeaderAbove returns -1 at start of file', () => {
  const lines = ['first'];
  const result = findAgentHeaderAbove(lines, 0);
  assert.strictEqual(result, -1);
});

test('findAgentHeaderAbove handles whitespace-only lines', () => {
  const lines = ['> **agent** to page', '  \t  ', 'target'];
  const result = findAgentHeaderAbove(lines, 2);
  assert.strictEqual(result, 0);
});

// buildBlocks tests
test('buildBlocks creates JSON block for successful primitive result', () => {
  const result = { ok: true, value: 42 };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0], '```JSON\n42\n```');
});

test('buildBlocks creates JSON block for successful object result', () => {
  const result = { ok: true, value: { x: 1, y: 2 } };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
  assert.match(blocks[0], /```JSON\n/);
  assert.match(blocks[0], /"x": 1/);
});

test('buildBlocks creates Error block for failed result', () => {
  const result = { ok: false, error: 'Test error message' };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
  assert.strictEqual(blocks[0], '```Error\nTest error message\n```');
});

test('buildBlocks includes background errors when present', () => {
  const result = { ok: true, value: 1, errors: ['Error 1', 'Error 2'] };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 3);
  assert.match(blocks[1], /Error 1/);
  assert.match(blocks[2], /Error 2/);
});

test('buildBlocks truncates background errors when more than 10', () => {
  const errors = Array.from({ length: 15 }, (_, i) => `Error ${i}`);
  const result = { ok: true, value: 1, errors };
  const blocks = buildBlocks(result);
  assert.ok(blocks.some(b => b.includes('more background events omitted')));
});

test('buildBlocks handles empty errors array', () => {
  const result = { ok: true, value: 1, errors: [] };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks.length, 1);
});

test('buildBlocks handles null value', () => {
  const result = { ok: true, value: null };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks[0], '```JSON\nnull\n```');
});

test('buildBlocks handles undefined value', () => {
  const result = { ok: true, value: undefined };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks[0], '```JSON\nundefined\n```');
});

test('buildBlocks handles string value', () => {
  const result = { ok: true, value: 'hello' };
  const blocks = buildBlocks(result);
  assert.strictEqual(blocks[0], '```JSON\nhello\n```');
});
